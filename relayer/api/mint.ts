import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  parseEventLogs
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { applyCors } from "./_cors";
import { PSK26_ABI } from "./_abi";
import { getValue, incrValue, setValue } from "./_store";
import { getClientIp, getTapKey, readJsonBody } from "./_utils";

const MAX_MINTS_PER_ADDRESS = 3;
const REQUEST_PREFIX = "psk26:req:";
const COUNT_PREFIX = "psk26:count:";
const RATE_PREFIX = "psk26:rate:";
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 120;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const tapKeyExpected = process.env.TAP_KEY || "";
  const tapKey = getTapKey(req);
  if (!tapKeyExpected || tapKey !== tapKeyExpected) {
    res.status(403).json({ error: "Invalid tap key" });
    return;
  }

  const clientIp = getClientIp(req);
  const rateKey = `${RATE_PREFIX}${clientIp}`;
  const now = Date.now();
  const rateState =
    (await getValue<{ count: number; resetAt: number }>(rateKey)) || null;
  if (!rateState || now > rateState.resetAt) {
    await setValue(rateKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
  } else if (rateState.count >= RATE_MAX) {
    res.status(429).json({ error: "Rate limit exceeded. Try again shortly." });
    return;
  } else {
    await setValue(rateKey, {
      count: rateState.count + 1,
      resetAt: rateState.resetAt
    });
  }

  const body = await readJsonBody(req);
  const recipientRaw =
    typeof body.recipient === "string" ? body.recipient.trim() : "";
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";

  if (!recipientRaw) {
    res.status(400).json({ error: "recipient is required" });
    return;
  }
  if (!requestId) {
    res.status(400).json({ error: "requestId is required" });
    return;
  }

  const cached = await getValue<Record<string, string>>(`${REQUEST_PREFIX}${requestId}`);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  const statusRpc =
    process.env.STATUS_RPC_URL || "https://public.sepolia.rpc.status.network";
  const chainId = Number(process.env.STATUS_CHAIN_ID || 1660990954);
  const contractAddress = process.env.CONTRACT_ADDRESS || "";
  const relayerKey = process.env.RELAYER_PRIVATE_KEY || "";

  if (!contractAddress || !isAddress(contractAddress)) {
    res.status(500).json({ error: "CONTRACT_ADDRESS is not configured" });
    return;
  }
  if (!relayerKey) {
    res.status(500).json({ error: "RELAYER_PRIVATE_KEY is not configured" });
    return;
  }

  const resolvedAddress = await resolveRecipient(recipientRaw);
  if (!resolvedAddress) {
    res.status(400).json({ error: "Invalid recipient" });
    return;
  }

  const countKey = `${COUNT_PREFIX}${resolvedAddress.toLowerCase()}`;
  const currentCount = (await getValue<number>(countKey)) ?? 0;
  if (currentCount >= MAX_MINTS_PER_ADDRESS) {
    res.status(429).json({ error: "Mint limit reached for this address" });
    return;
  }

  const statusChain = {
    id: chainId,
    name: "Status Network Testnet",
    network: "status-testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [statusRpc] },
      public: { http: [statusRpc] }
    },
    blockExplorers: {
      default: { name: "Status SepoliaScan", url: "https://sepoliascan.status.network" }
    }
  } as const;

  const key = relayerKey.startsWith("0x") ? relayerKey : `0x${relayerKey}`;
  const account = privateKeyToAccount(key as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: statusChain,
    transport: http(statusRpc)
  });
  const publicClient = createPublicClient({
    chain: statusChain,
    transport: http(statusRpc)
  });

  try {
    const txHash = await walletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: PSK26_ABI,
      functionName: "mintTo",
      args: [resolvedAddress]
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash
    });

    const logs = parseEventLogs({
      abi: PSK26_ABI,
      logs: receipt.logs,
      eventName: "Minted"
    });

    const tokenId = logs[0]?.args?.tokenId?.toString() || "";

    const result = {
      resolvedAddress,
      txHash,
      tokenId
    };

    await setValue(`${REQUEST_PREFIX}${requestId}`, result);
    await incrValue(countKey);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Mint failed" });
  }

  async function resolveRecipient(value: string): Promise<`0x${string}` | null> {
    const trimmed = value.trim();
    if (trimmed.toLowerCase().endsWith(".eth")) {
      const mainnetRpc = process.env.MAINNET_RPC_URL || "https://cloudflare-eth.com";
      const ensClient = createPublicClient({
        chain: mainnet,
        transport: http(mainnetRpc)
      });
      const address = await ensClient.getEnsAddress({ name: trimmed });
      return address ? getAddress(address) : null;
    }

    if (!isAddress(trimmed)) {
      return null;
    }

    return getAddress(trimmed);
  }
}
