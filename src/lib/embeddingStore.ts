// IndexedDB-backed storage for Pl@ntNet photo embeddings, keyed by timeline
// entry id — mirrors photoStore.ts's pattern but stores a plain number[]
// instead of a Blob, so growth-timeline comparisons don't need to re-fetch
// and re-embed every previous photo just to compare against the latest one.
const DB_NAME = "verdant.embeddings";
const DB_VERSION = 1;
const STORE_NAME = "embeddings";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveEmbedding(entryId: string, vector: number[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(vector, entryId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getEmbedding(entryId: string): Promise<number[] | undefined> {
  const db = await openDb();
  const vector = await new Promise<number[] | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(entryId);
    req.onsuccess = () => resolve(req.result as number[] | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return vector;
}

// Standard cosine similarity, clamped to [0, 1] for display — embeddings can
// yield small negative values for very dissimilar images, which would
// otherwise render as a confusing negative percentage.
export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, sim));
}
