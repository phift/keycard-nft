import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_cors.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) {
    return;
  }

  const chainId = Number(process.env.STATUS_CHAIN_ID || 1660990954);
  res.status(200).json({
    ok: true,
    chainId,
    contract: process.env.CONTRACT_ADDRESS || "",
    relayer: process.env.RELAYER_PRIVATE_KEY ? "configured" : "missing"
  });
}
