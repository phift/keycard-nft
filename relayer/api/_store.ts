import { kv } from "@vercel/kv";

const memoryStore = new Map<string, unknown>();

const hasKvConfig = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

export async function getValue<T>(key: string): Promise<T | null> {
  if (hasKvConfig) {
    return (await kv.get<T>(key)) ?? null;
  }
  return (memoryStore.get(key) as T) ?? null;
}

export async function setValue(key: string, value: unknown): Promise<void> {
  if (hasKvConfig) {
    await kv.set(key, value);
    return;
  }
  memoryStore.set(key, value);
}
