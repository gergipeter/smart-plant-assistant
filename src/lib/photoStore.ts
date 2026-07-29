// Photo storage for timeline/scan photos, keyed by timeline entry id.
// Signed-in users' photos go to Supabase Storage (private bucket
// "plant-photos", RLS-scoped per user) so they sync across devices —
// same signed-in/signed-out split as myGarden.ts and premium.ts.
// Signed-out (or Supabase not configured) falls back to IndexedDB, which
// is local to one browser — localStorage's ~5MB quota is too small for
// full-resolution photo blobs, hence a separate store from myGarden's cache.
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const DB_NAME = "verdant.photos";
const DB_VERSION = 1;
const STORE_NAME = "photos";
const BUCKET = "plant-photos";

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

async function saveLocal(entryId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, entryId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getLocal(entryId: string): Promise<Blob | undefined> {
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(entryId);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

async function deleteLocal(entryId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(entryId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function getCurrentUserId(): string | null {
  if (!supabase) return null;
  const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  if (!key) return null;
  try {
    const session = JSON.parse(localStorage.getItem(key) || "null");
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

function storagePath(userId: string, entryId: string): string {
  return `${userId}/${entryId}`;
}

export async function savePhoto(entryId: string, blob: Blob): Promise<void> {
  const userId = isSupabaseConfigured ? getCurrentUserId() : null;

  if (userId && supabase) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath(userId, entryId), blob, { upsert: true, contentType: blob.type || "image/jpeg" });
    if (error) {
      console.error("Failed to upload photo to Supabase Storage:", error);
      // Fall back to local so the photo isn't silently lost.
      await saveLocal(entryId, blob);
    }
    return;
  }

  await saveLocal(entryId, blob);
}

export async function getPhoto(entryId: string): Promise<Blob | undefined> {
  const userId = isSupabaseConfigured ? getCurrentUserId() : null;

  if (userId && supabase) {
    const { data, error } = await supabase.storage.from(BUCKET).download(storagePath(userId, entryId));
    if (!error && data) return data;
    // Fall through to local in case this entry was saved before sign-in.
  }

  return getLocal(entryId);
}

