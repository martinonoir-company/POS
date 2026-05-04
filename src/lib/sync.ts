import type { PosTransaction, SyncBatchResult } from "./types";
import { syncTransactions } from "./api";

const DB_NAME = "martinonoir_pos";
const DB_VERSION = 1;
const STORE_NAME = "pending_transactions";
const TERMINAL_ID = "POS-MAIN-01";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "transactionId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Queue a transaction for later sync */
export async function queueTransaction(tx: PosTransaction): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, "readwrite");
    txn.objectStore(STORE_NAME).put(tx);
    txn.oncomplete = () => { db.close(); resolve(); };
    txn.onerror = () => { db.close(); reject(txn.error); };
  });
}

/** Get all pending (unsynced) transactions */
export async function getPendingTransactions(): Promise<PosTransaction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, "readonly");
    const req = txn.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Get count of pending transactions */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, "readonly");
    const req = txn.objectStore(STORE_NAME).count();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Remove synced transactions from the queue */
export async function clearTransactions(txIds: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, "readwrite");
    const store = txn.objectStore(STORE_NAME);
    for (const id of txIds) store.delete(id);
    txn.oncomplete = () => { db.close(); resolve(); };
    txn.onerror = () => { db.close(); reject(txn.error); };
  });
}

/** Flush all pending transactions to the server */
export async function flushQueue(): Promise<SyncBatchResult | null> {
  const pending = await getPendingTransactions();
  if (pending.length === 0) return null;

  try {
    const res = await syncTransactions(TERMINAL_ID, pending);
    const result = res.data;

    // Clear successfully synced + skipped (already processed)
    const toRemove = [
      ...result.successful.map((s) => s.transactionId),
      ...result.skipped.map((s) => s.transactionId),
    ];
    if (toRemove.length > 0) {
      await clearTransactions(toRemove);
    }

    return result;
  } catch (err) {
    console.error("[POS Sync] Flush failed:", err);
    return null;
  }
}

/** Start the automatic sync heartbeat */
export function startSyncHeartbeat(
  onSync?: (result: SyncBatchResult) => void,
  intervalMs = 30000
): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  const doFlush = async () => {
    if (!navigator.onLine) return;
    const result = await flushQueue();
    if (result && onSync) onSync(result);
  };

  // Flush immediately on coming back online
  const handleOnline = () => { doFlush(); };
  window.addEventListener("online", handleOnline);

  // Periodic heartbeat
  timer = setInterval(doFlush, intervalMs);

  // Initial flush
  doFlush();

  // Cleanup
  return () => {
    window.removeEventListener("online", handleOnline);
    if (timer) clearInterval(timer);
  };
}

export function getTerminalId(): string {
  return TERMINAL_ID;
}
