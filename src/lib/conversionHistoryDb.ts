/**
 * Tiny IndexedDB wrapper used by the Image Converter to persist a local
 * conversion history. Lives entirely in the browser — never touches Supabase.
 */

import type { ResponsivePresetName } from "./imageConverter";

const DB_NAME = "ellennous-converter";
const DB_VERSION = 1;
const STORE = "conversions";

export interface HistoryVariantRecord {
  preset: ResponsivePresetName;
  filename: string;
  width: number;
  height: number;
  size: number;
  blob: Blob;
}

export interface HistoryRecord {
  id: string;
  name: string;
  createdAt: number;
  originalSize: number;
  totalSize: number;
  variants: HistoryVariantRecord[];
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const addHistoryRecord = async (record: HistoryRecord): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

export const listHistoryRecords = async (): Promise<HistoryRecord[]> => {
  const db = await openDb();
  const records = await new Promise<HistoryRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as HistoryRecord[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return records.sort((a, b) => b.createdAt - a.createdAt);
};

export const deleteHistoryRecord = async (id: string): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

export const clearHistory = async (): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};
