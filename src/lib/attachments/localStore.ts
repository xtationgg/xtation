import type { FileKind, LocalAttachmentRow, OwnerType } from './types';

const ATTACHMENTS_DB = 'DuskAttachmentsDB';
const DB_VERSION = 1;
const HEAVY_STORE = 'heavy_files';
const LOCAL_META_STORE = 'local_attachment_meta';

type StoredHeavyFile = {
  id: string;
  blob: Blob;
  mime: string;
  size: number;
  created_at: string;
};

const toPromise = <T,>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const waitTx = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const openDB = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(ATTACHMENTS_DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HEAVY_STORE)) {
        db.createObjectStore(HEAVY_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(LOCAL_META_STORE)) {
        const store = db.createObjectStore(LOCAL_META_STORE, { keyPath: 'id' });
        store.createIndex('by_scope', 'user_scope', { unique: false });
        store.createIndex('by_owner', ['user_scope', 'owner_type', 'owner_id'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const generateLocalKey = () => {
  const base = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Math.random().toString(16).slice(2)}-${Date.now()}`;
  return `heavy:${base}:${Date.now()}`;
};

export const saveHeavyFile = async (
  file: File
): Promise<{ localKey: string; size: number; mime: string }> => {
  const db = await openDB();
  const localKey = generateLocalKey();
  const stored: StoredHeavyFile = {
    id: localKey,
    blob: file,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    created_at: new Date().toISOString(),
  };

  const tx = db.transaction(HEAVY_STORE, 'readwrite');
  tx.objectStore(HEAVY_STORE).put(stored);
  await waitTx(tx);
  return {
    localKey,
    size: stored.size,
    mime: stored.mime,
  };
};

export const getHeavyFile = async (localKey: string): Promise<Blob | null> => {
  const db = await openDB();
  const tx = db.transaction(HEAVY_STORE, 'readonly');
  const row = await toPromise<StoredHeavyFile | undefined>(tx.objectStore(HEAVY_STORE).get(localKey));
  return row?.blob || null;
};

export const deleteHeavyFile = async (localKey: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(HEAVY_STORE, 'readwrite');
  tx.objectStore(HEAVY_STORE).delete(localKey);
  await waitTx(tx);
};

export const listLocalAttachmentRows = async (
  ownerType: OwnerType,
  ownerId: string,
  userScope: string
): Promise<LocalAttachmentRow[]> => {
  const db = await openDB();
  const tx = db.transaction(LOCAL_META_STORE, 'readonly');
  const index = tx.objectStore(LOCAL_META_STORE).index('by_owner');
  const rows = await toPromise<LocalAttachmentRow[]>(index.getAll([userScope, ownerType, ownerId]));
  rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return rows;
};

export const upsertLocalAttachmentRow = async (row: LocalAttachmentRow): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(LOCAL_META_STORE, 'readwrite');
  tx.objectStore(LOCAL_META_STORE).put(row);
  await waitTx(tx);
};

export const removeLocalAttachmentRow = async (id: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(LOCAL_META_STORE, 'readwrite');
  tx.objectStore(LOCAL_META_STORE).delete(id);
  await waitTx(tx);
};

export const removeOwnerLocalAttachmentRows = async (
  ownerType: OwnerType,
  ownerId: string,
  userScope: string
): Promise<void> => {
  const rows = await listLocalAttachmentRows(ownerType, ownerId, userScope);
  if (!rows.length) return;
  const db = await openDB();
  const tx = db.transaction(LOCAL_META_STORE, 'readwrite');
  const store = tx.objectStore(LOCAL_META_STORE);
  rows.forEach((row) => {
    store.delete(row.id);
  });
  await waitTx(tx);
};

export const createLocalAttachmentRow = ({
  id,
  userScope,
  ownerType,
  ownerId,
  kind,
  title,
  notes,
  mime,
  sizeBytes,
  localKey,
  thumbDataUrl,
  meta,
}: {
  id: string;
  userScope: string;
  ownerType: OwnerType;
  ownerId: string;
  kind: FileKind;
  title?: string | null;
  notes?: string | null;
  mime?: string | null;
  sizeBytes?: number | null;
  localKey?: string | null;
  thumbDataUrl?: string | null;
  meta?: Record<string, unknown>;
}): LocalAttachmentRow => {
  const now = new Date().toISOString();
  return {
    id,
    user_scope: userScope,
    owner_type: ownerType,
    owner_id: ownerId,
    kind,
    title: title ?? null,
    notes: notes ?? null,
    mime: mime ?? null,
    size_bytes: sizeBytes ?? null,
    created_at: now,
    updated_at: now,
    thumb_data_url: thumbDataUrl ?? null,
    local_key: localKey ?? null,
    meta: meta ?? {},
  };
};

