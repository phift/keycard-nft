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
