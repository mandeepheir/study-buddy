// Retrieval helpers: split long notes into chunks and find the relevant ones.
// No libraries and no cost: this uses simple keyword scoring (TF-IDF style).

export const CHUNK_SIZE = 1000; // target characters per chunk

const STOP = new Set(
  ("the a an and or of to in on for with is are was were be been it this that these those as at by from " +
   "what which who whom how why when where does do did can could should would about into than then there " +
   "their they them you your i we our not no yes explain tell me give please").split(" ")
);

export function tokens(text) {
  return (String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)); // crude plural stemming
}

// Split text into chunks of about CHUNK_SIZE characters, breaking at sentence ends
// and repeating the last sentence of each chunk at the start of the next one.
export function chunkText(text, size = CHUNK_SIZE) {
  const raw = String(text).replace(/\r/g, "").split(/(?<=[.!?])\s+|\n+/).map((u) => u.trim()).filter(Boolean);

  const units = [];
  for (const u of raw) {
    if (u.length <= size * 1.5) units.push(u);
    else for (let i = 0; i < u.length; i += size) units.push(u.slice(i, i + size)); // very long line
  }

  const chunks = [];
  let cur = [], len = 0;
  for (const u of units) {
    if (len + u.length > size && cur.length) {
      chunks.push(cur.join(" "));
      const overlap = cur[cur.length - 1];
      cur = [overlap]; len = overlap.length;
    }
    cur.push(u); len += u.length + 1;
  }
  if (cur.length) chunks.push(cur.join(" "));
  return chunks;
}

// Return the indexes (in reading order) of the k chunks that best match the query.
export function rankChunks(chunks, query, k = 5) {
  const q = [...new Set(tokens(query))];
  const docs = chunks.map((c) => {
    const m = new Map();
    tokens(c).forEach((t) => m.set(t, (m.get(t) || 0) + 1));
    return m;
  });
  const N = chunks.length;
  const idf = new Map();
  for (const t of q) {
    const df = docs.reduce((n, d) => n + (d.has(t) ? 1 : 0), 0);
    idf.set(t, df ? Math.log(1 + N / df) : 0);
  }
  const scored = docs.map((m, i) => {
    let s = 0;
    for (const t of q) { const tf = m.get(t); if (tf) s += idf.get(t) * (1 + Math.log(tf)); }
    return { i, s };
  });
  let best = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k);
  if (!best.length) best = scored.slice(0, Math.min(k, 3)); // nothing matched: fall back to the start
  return best.map((x) => x.i).sort((a, b) => a - b);
}

// Pick n chunks spread evenly across the whole document.
export function pickEvenly(chunks, n = 8) {
  if (chunks.length <= n) return chunks.map((_, i) => i);
  const ids = new Set();
  for (let j = 0; j < n; j++) ids.add(Math.floor(((j + 0.5) * chunks.length) / n));
  return [...ids].sort((a, b) => a - b);
}

export function buildContext(chunks, ids) {
  return ids.map((i) => `[Section ${i + 1}]\n${chunks[i]}`).join("\n\n");
}