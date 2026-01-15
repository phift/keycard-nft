import type { IncomingMessage, ServerResponse } from "http";

const ALLOWED_ORIGINS = ["https://phift.github.io", "http://localhost:5173"];

export function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-tap-key");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  return false;
}
