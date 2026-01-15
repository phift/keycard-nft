import type { IncomingMessage } from "http";

export async function readJsonBody(req: IncomingMessage) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getTapKey(req: IncomingMessage): string {
  const header = req.headers["x-tap-key"];
  const headerValue = Array.isArray(header) ? header[0] : header;
  const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
  const queryValue = url.searchParams.get("k") || "";
  return (headerValue as string) || queryValue || "";
}

export function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length) {
    return forwarded[0].trim();
  }

  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.length) {
    return cfIp;
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length) {
    return realIp;
  }

  return req.socket?.remoteAddress || "unknown";
}
