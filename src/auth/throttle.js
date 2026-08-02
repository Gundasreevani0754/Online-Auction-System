/**
 * Small in-memory limiter that slows password guessing against a single
 * account. Deliberately simple: no dependency, and it resets on restart.
 */

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

const attemptsByKey = new Map();

const buildKey = (req, email) => `${req.ip}|${email}`;

function prune(now) {
  for (const [key, entry] of attemptsByKey) {
    if (entry.resetAt <= now) {
      attemptsByKey.delete(key);
    }
  }
}

export function isLockedOut(req, email) {
  const entry = attemptsByKey.get(buildKey(req, email));

  return entry !== undefined && entry.resetAt > Date.now() && entry.count >= MAX_ATTEMPTS;
}

export function recordFailure(req, email) {
  const now = Date.now();
  prune(now);

  const key = buildKey(req, email);
  const entry = attemptsByKey.get(key);

  if (!entry || entry.resetAt <= now) {
    attemptsByKey.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  attemptsByKey.set(key, { ...entry, count: entry.count + 1 });
}

export function clearFailures(req, email) {
  attemptsByKey.delete(buildKey(req, email));
}
