import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_cors.js";
import { resolveEnsAddress } from "./_ens.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) {
    return;
  }

  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  if (!name || !name.toLowerCase().endsWith(".eth")) {
    res.status(400).json({ error: "Invalid ENS name" });
    return;
  }

  const mainnetRpc = process.env.MAINNET_RPC_URL || "https://cloudflare-eth.com";
  const address = await resolveEnsAddress(name, mainnetRpc);
  if (!address) {
    res.status(404).json({ error: "ENS name not found" });
    return;
  }

  res.status(200).json({ name, address });
}
