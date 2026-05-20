const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 20;

const hits = new Map<string, number[]>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const current = hits.get(key) ?? [];
  const inWindow = current.filter((ts) => now - ts <= WINDOW_MS);
  inWindow.push(now);
  hits.set(key, inWindow);
  return inWindow.length <= MAX_ATTEMPTS;
}
