import type { AlponaDraftPayload } from './draftStorage';
import type { CanvasSurfaceId, SymmetryConfig } from './types';

export interface SavedAlponaProject {
  id: string;
  name: string;
  updatedAt: number;
  strokesCount: number;
  surfaceId: CanvasSurfaceId;
  symmetry: SymmetryConfig;
  thumbnailDataUrl: string;
  payload: AlponaDraftPayload;
}

export interface GalleryBackend {
  getAll(): Promise<SavedAlponaProject[]>;
  get(id: string): Promise<SavedAlponaProject | null>;
  put(project: SavedAlponaProject): Promise<void>;
  delete(id: string): Promise<void>;
}

const IDB_NAME = 'alpona-studio-gallery-v1';
const IDB_STORE = 'projects';
const FALLBACK_LS_KEY = 'alpona-studio-gallery-fallback-v1';

/**
 * Pure in-memory backend for deterministic unit tests and headless environments.
 */
export function createMemoryGalleryBackend(
  initial: SavedAlponaProject[] = []
): GalleryBackend {
  const map = new Map<string, SavedAlponaProject>();
  for (const item of initial) {
    map.set(item.id, item);
  }
  return {
    async getAll() {
      return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async get(id) {
      return map.get(id) ?? null;
    },
    async put(project) {
      map.set(project.id, project);
    },
    async delete(id) {
      map.delete(id);
    },
  };
}

function openGalleryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function readFallbackList(): SavedAlponaProject[] {
  try {
    const raw = window.localStorage.getItem(FALLBACK_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedAlponaProject[]) : [];
  } catch {
    return [];
  }
}

// Throws when the browser refuses to store the list (quota full, storage blocked), so
// the caller can tell the user that the project was NOT saved.
function writeFallbackList(list: SavedAlponaProject[]): void {
  window.localStorage.setItem(FALLBACK_LS_KEY, JSON.stringify(list));
}

/**
 * Browser IndexedDB backend with automatic localStorage fallback when
 * IndexedDB is unavailable (e.g. restricted privacy contexts).
 */
export function createBrowserGalleryBackend(): GalleryBackend {
  const hasIdb =
    typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

  if (!hasIdb) {
    return {
      async getAll() {
        return readFallbackList().sort((a, b) => b.updatedAt - a.updatedAt);
      },
      async get(id) {
        return readFallbackList().find((p) => p.id === id) ?? null;
      },
      async put(project) {
        const list = readFallbackList().filter((p) => p.id !== project.id);
        list.push(project);
        writeFallbackList(list);
      },
      async delete(id) {
        writeFallbackList(readFallbackList().filter((p) => p.id !== id));
      },
    };
  }

  return {
    async getAll() {
      try {
        const db = await openGalleryDb();
        return await new Promise<SavedAlponaProject[]>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).getAll();
          req.onsuccess = () => {
            const rows = (req.result as SavedAlponaProject[]) ?? [];
            resolve(rows.sort((a, b) => b.updatedAt - a.updatedAt));
          };
          req.onerror = () => reject(req.error);
        });
      } catch {
        return readFallbackList().sort((a, b) => b.updatedAt - a.updatedAt);
      }
    },
    async get(id) {
      try {
        const db = await openGalleryDb();
        return await new Promise<SavedAlponaProject | null>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).get(id);
          req.onsuccess = () =>
            resolve((req.result as SavedAlponaProject | undefined) ?? null);
          req.onerror = () => reject(req.error);
        });
      } catch {
        return readFallbackList().find((p) => p.id === id) ?? null;
      }
    },
    async put(project) {
      try {
        const db = await openGalleryDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(project);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        const list = readFallbackList().filter((p) => p.id !== project.id);
        list.push(project);
        writeFallbackList(list);
      }
    },
    async delete(id) {
      try {
        const db = await openGalleryDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        writeFallbackList(readFallbackList().filter((p) => p.id !== id));
      }
    },
  };
}

export async function listGalleryProjects(
  backend: GalleryBackend
): Promise<SavedAlponaProject[]> {
  return backend.getAll();
}

export async function saveGalleryProject(
  backend: GalleryBackend,
  input: {
    id?: string;
    name: string;
    thumbnailDataUrl: string;
    payload: AlponaDraftPayload;
  }
): Promise<SavedAlponaProject> {
  const cleanName = input.name.trim() || 'Untitled Alpona';
  const entry: SavedAlponaProject = {
    id:
      input.id ??
      `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    updatedAt: Date.now(),
    strokesCount: input.payload.operations.length,
    surfaceId: input.payload.surfaceId,
    symmetry: { ...input.payload.symmetry },
    thumbnailDataUrl: input.thumbnailDataUrl,
    payload: input.payload,
  };
  await backend.put(entry);
  return entry;
}

export async function renameGalleryProject(
  backend: GalleryBackend,
  id: string,
  newName: string
): Promise<SavedAlponaProject | null> {
  const existing = await backend.get(id);
  if (!existing) return null;
  const updated: SavedAlponaProject = {
    ...existing,
    name: newName.trim() || existing.name,
    updatedAt: Date.now(),
  };
  await backend.put(updated);
  return updated;
}

export async function deleteGalleryProject(
  backend: GalleryBackend,
  id: string
): Promise<void> {
  await backend.delete(id);
}
