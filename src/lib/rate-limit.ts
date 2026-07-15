const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 20;
const CLEANUP_INTERVAL_MS = 5 * 60_000;

const hits = new Map<string, number[]>();
let lastCleanup = Date.now();

// Entfernt Keys ohne Treffer im aktuellen Fenster, sonst wächst die Map unbegrenzt
function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, timestamps] of hits) {
    if (timestamps.every((ts) => now - ts > WINDOW_MS)) hits.delete(key);
  }
}

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  cleanup(now);
  const current = hits.get(key) ?? [];
  const inWindow = current.filter((ts) => now - ts <= WINDOW_MS);
  inWindow.push(now);
  hits.set(key, inWindow);
  return inWindow.length <= MAX_ATTEMPTS;
}
