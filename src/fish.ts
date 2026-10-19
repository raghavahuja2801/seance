/**
 * Minimal Fish Audio Agents API client. Server-side only: it carries the API key.
 */

export const API_BASE = 'https://api.fish.audio';

export class FishApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(method: string, path: string, status: number, body: string) {
    super(`${method} ${path} -> ${status}: ${body.slice(0, 500)}`);
    this.status = status;
    this.body = body;
  }
}

export function fishApiKey(): string {
  const key = process.env.FISH_API_KEY?.trim();
  if (!key) throw new Error('FISH_API_KEY is not set (see .env.example)');
  return key;
}

export async function fish<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${fishApiKey()}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new FishApiError(method, path, res.status, text);
  return (text ? JSON.parse(text) : undefined) as T;
}
