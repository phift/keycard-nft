import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  toBytes,
  zeroAddress
} from "viem";
import { mainnet } from "viem/chains";

const ENS_REGISTRY_ADDRESS =
  "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as const;

const ENS_REGISTRY_ABI = [
  {
    name: "resolver",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "resolver", type: "address" }]
  }
] as const;

const ENS_RESOLVER_ABI = [
  {
    name: "addr",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "addr", type: "address" }]
  }
] as const;

function namehash(name: string): `0x${string}` {
  const cleaned = name.trim().toLowerCase().replace(/\.$/, "");
  let node = `0x${"00".repeat(32)}` as `0x${string}`;
  if (!cleaned) {
    return node;
  }

  const labels = cleaned.split(".").filter(Boolean).reverse();
  for (const label of labels) {
    const labelHash = keccak256(toBytes(label));
    const packed = `0x${node.slice(2)}${labelHash.slice(2)}` as `0x${string}`;
    node = keccak256(packed);
  }

  return node;
}

export async function resolveEnsAddress(
  name: string,
  rpcUrl: string
): Promise<`0x${string}` | null> {
  const cleaned = name.trim().toLowerCase();
  if (!cleaned.endsWith(".eth")) {
    return null;
  }

  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl)
  });

  try {
    const node = namehash(cleaned);
    const resolver = await client.readContract({
      address: ENS_REGISTRY_ADDRESS,
      abi: ENS_REGISTRY_ABI,
      functionName: "resolver",
      args: [node]
    });

    if (!resolver || resolver === zeroAddress) {
      return null;
    }

    const address = await client.readContract({
      address: resolver,
      abi: ENS_RESOLVER_ABI,
      functionName: "addr",
      args: [node]
    });

    if (!address || address === zeroAddress) {
      return null;
    }

    return getAddress(address);
  } catch (error) {
    console.error("ENS resolve failed", error);
    return null;
  }
}
