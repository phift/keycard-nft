import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { applyCors } from "./_cors.js";
import { PSK26_ABI } from "./_abi.js";
import { resolveEnsAddress } from "./_ens.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  const raw =
    (typeof req.query.address === "string" ? req.query.address.trim() : "") ||
    (typeof req.query.name === "string" ? req.query.name.trim() : "");

  if (!raw) {
    res.status(400).json({ error: "address is required" });
    return;
  }

  const contractAddress = process.env.CONTRACT_ADDRESS || "";
  if (!contractAddress || !isAddress(contractAddress)) {
    res.status(500).json({ error: "CONTRACT_ADDRESS is not configured" });
    return;
  }

  const statusRpc =
    process.env.STATUS_RPC_URL || "https://public.sepolia.rpc.status.network";
  const chainId = Number(process.env.STATUS_CHAIN_ID || 1660990954);

  const resolved = await resolveAddress(raw);
  if (!resolved) {
    res.status(400).json({ error: "Invalid address or ENS name" });
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
    }
  } as const;

  const publicClient = createPublicClient({
    chain: statusChain,
    transport: http(statusRpc)
  });

  const fromBlockEnv = process.env.CONTRACT_DEPLOY_BLOCK || "";
  const fromBlockQuery =
    typeof req.query.fromBlock === "string" ? req.query.fromBlock.trim() : "";
  const fromBlockValue = fromBlockQuery || fromBlockEnv || "0";

  let fromBlock = 0n;
  try {
    fromBlock = BigInt(fromBlockValue);
  } catch {
    fromBlock = 0n;
  }

  try {
    const logs = await publicClient.getLogs({
      address: contractAddress,
      event: PSK26_ABI[1],
      args: { to: resolved },
      fromBlock,
      toBlock: "latest"
    });

    const tokenIds = logs
      .map((log) => {
        const args = log.args as { tokenId?: bigint } | undefined;
        return args?.tokenId?.toString();
      })
      .filter((value): value is string => Boolean(value));

    res.status(200).json({
      address: resolved,
      count: tokenIds.length,
      tokenIds,
      lastTokenId: tokenIds[tokenIds.length - 1] || null
    });
  } catch (error) {
    console.error("Minted lookup failed", error);
    res.status(500).json({ error: "Minted lookup failed" });
  }

  async function resolveAddress(value: string): Promise<`0x${string}` | null> {
    const trimmed = value.trim();
    if (trimmed.toLowerCase().endsWith(".eth")) {
      const mainnetRpc =
        process.env.MAINNET_RPC_URLS || process.env.MAINNET_RPC_URL || "";
      return await resolveEnsAddress(trimmed, mainnetRpc);
    }
    if (!isAddress(trimmed)) {
      return null;
    }
    return getAddress(trimmed);
  }
}
