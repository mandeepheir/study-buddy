// A tiny in-memory rate limiter (no dependencies): max requests per IP per time window.
export function rateLimit({ windowMs = 60000, max = 20 } = {}) {
  const hits = new Map();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, windowMs);
  if (sweep.unref) sweep.unref(); // do not keep the process alive just for cleanup

  return function limiter(req, res, next) {
    const key = req.ip || (req.socket && req.socket.remoteAddress) || "unknown";
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      const wait = Math.max(1, Math.ceil((entry.reset - now) / 1000));
      res.setHeader("Retry-After", String(wait));
      return res.status(429).json({ error: `Too many requests. Please wait ${wait} seconds and try again.` });
    }
    next();
  };
}