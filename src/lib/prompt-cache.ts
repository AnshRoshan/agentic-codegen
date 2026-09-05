// Simple in-memory LRU prompt cache.
// Caches the response text + tool calls for identical (system+user prompt) pairs.
// This prevents redundant LLM calls when agents retry or the pipeline is reset.

import { createHash } from "crypto";

interface CacheEntry {
  key: string;
  text: string;
  toolCalls: unknown[];
  promptTokens: number;
  completionTokens: number;
  createdAt: number;
}

const MAX_ENTRIES = 100;
const TTL_MS = 30 * 60 * 1000; // 30 minutes

const cache = new Map<string, CacheEntry>();

export function cacheKey(systemPrompt: string, userPrompt: string, model: string): string {
  const hash = createHash("sha256");
  hash.update(model);
  hash.update("\0");
  hash.update(systemPrompt);
  hash.update("\0");
  hash.update(userPrompt);
  return hash.digest("hex").slice(0, 24);
}

export function getCached(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

export function setCache(
  key: string,
  text: string,
  toolCalls: unknown[],
  promptTokens: number,
  completionTokens: number
): void {
  // Evict oldest if at capacity
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, { key, text, toolCalls, promptTokens, completionTokens, createdAt: Date.now() });
}

export function clearCache(): void {
  cache.clear();
}

export function cacheStats(): { size: number; maxSize: number; ttlMinutes: number } {
  return { size: cache.size, maxSize: MAX_ENTRIES, ttlMinutes: TTL_MS / 60_000 };
}
