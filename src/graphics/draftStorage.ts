import type {
  CanvasSurfaceId,
  ClippingWindowConfig,
  DrawOperation,
  LineAlgorithm,
  SymmetryConfig,
  Transform2DConfig,
} from './types';

export const DRAFT_STORAGE_KEY = 'alpona-studio-autosave-v1';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AlponaDraftPayload {
  version: 1;
  savedAt: number;
  surfaceId: CanvasSurfaceId;
  symmetry: SymmetryConfig;
  lineAlgorithm: LineAlgorithm;
  clippingWindow: ClippingWindowConfig;
  transform2D: Transform2DConfig;
  operations: DrawOperation[];
}

export function serializeDraftPayload(payload: AlponaDraftPayload): string {
  return JSON.stringify(payload);
}

const VALID_SURFACES = new Set<string>([
  'courtyard',
  'terracotta',
  'indigo',
  'paper',
]);

const VALID_OP_KINDS = new Set<string>([
  'line',
  'circle',
  'polygon',
  'freehand',
  'bezier',
  'fill',
]);

export function parseDraftPayload(raw: string | null): AlponaDraftPayload | null {
  if (!raw || raw.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AlponaDraftPayload>;
    if (
      !parsed ||
      parsed.version !== 1 ||
      typeof parsed.savedAt !== 'number' ||
      !Number.isFinite(parsed.savedAt) ||
      !parsed.surfaceId ||
      !VALID_SURFACES.has(parsed.surfaceId) ||
      !parsed.symmetry ||
      typeof parsed.symmetry.sectors !== 'number' ||
      typeof parsed.symmetry.reflect !== 'boolean' ||
      !Array.isArray(parsed.operations)
    ) {
      return null;
    }

    const validOps = parsed.operations.filter(
      (op): op is DrawOperation =>
        Boolean(op) &&
        typeof op.id === 'string' &&
        typeof op.kind === 'string' &&
        VALID_OP_KINDS.has(op.kind) &&
        typeof op.color === 'string'
    );

    const lineAlgorithm: LineAlgorithm =
      parsed.lineAlgorithm === 'dda' ? 'dda' : 'bresenham';

    const cw: ClippingWindowConfig = {
      enabled: Boolean(parsed.clippingWindow?.enabled),
      inset:
        typeof parsed.clippingWindow?.inset === 'number'
          ? Math.max(0, Math.min(220, parsed.clippingWindow.inset))
          : 72,
      algorithm:
        parsed.clippingWindow?.algorithm === 'liang-barsky'
          ? 'liang-barsky'
          : 'cohen-sutherland',
      polygonAlgorithm:
        parsed.clippingWindow?.polygonAlgorithm === 'weiler-atherton'
          ? 'weiler-atherton'
          : 'sutherland-hodgman',
    };

    const t = parsed.transform2D;
    const transform2D: Transform2DConfig = {
      translateX: typeof t?.translateX === 'number' ? t.translateX : 0,
      translateY: typeof t?.translateY === 'number' ? t.translateY : 0,
      scaleX: typeof t?.scaleX === 'number' ? t.scaleX : 1,
      scaleY: typeof t?.scaleY === 'number' ? t.scaleY : 1,
      rotateDeg: typeof t?.rotateDeg === 'number' ? t.rotateDeg : 0,
      shearX: typeof t?.shearX === 'number' ? t.shearX : 0,
      shearY: typeof t?.shearY === 'number' ? t.shearY : 0,
      flipX: Boolean(t?.flipX),
      flipY: Boolean(t?.flipY),
    };

    return {
      version: 1,
      savedAt: parsed.savedAt,
      surfaceId: parsed.surfaceId,
      symmetry: {
        sectors: Math.max(3, Math.min(16, Math.round(parsed.symmetry.sectors))),
        reflect: parsed.symmetry.reflect,
      },
      lineAlgorithm,
      clippingWindow: cw,
      transform2D,
      operations: validOps,
    };
  } catch {
    return null;
  }
}

export function saveDraftToStorage(
  storage: StorageAdapter | null | undefined,
  payload: AlponaDraftPayload
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DRAFT_STORAGE_KEY, serializeDraftPayload(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadDraftFromStorage(
  storage: StorageAdapter | null | undefined
): AlponaDraftPayload | null {
  if (!storage) return null;
  try {
    return parseDraftPayload(storage.getItem(DRAFT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearDraftFromStorage(
  storage: StorageAdapter | null | undefined
): void {
  if (!storage) return;
  try {
    storage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export const DRAFT_SYNC_LABEL = 'Synced to Local Storage';
export const DRAFT_SYNC_FAILED_LABEL = 'Not saved — browser storage is full or blocked';
export const DEFAULT_DRAFT_SYNC_PULSE_MS = 2800;

export interface DraftSyncIndicatorState {
  status: 'idle' | 'synced' | 'failed';
  visible: boolean;
  isPulsing: boolean;
  label: string;
  lastSyncedAt: number | null;
}

export function computeDraftSyncIndicator(
  lastSyncedAt: number | null,
  nowMs: number,
  pulseWindowMs: number = DEFAULT_DRAFT_SYNC_PULSE_MS,
  lastFailedAt: number | null = null
): DraftSyncIndicatorState {
  const hasFailure = lastFailedAt !== null && Number.isFinite(lastFailedAt) && lastFailedAt > 0;
  if (hasFailure && (lastSyncedAt === null || lastFailedAt >= lastSyncedAt)) {
    return {
      status: 'failed',
      visible: true,
      isPulsing: false,
      label: DRAFT_SYNC_FAILED_LABEL,
      lastSyncedAt,
    };
  }
  if (
    lastSyncedAt === null ||
    !Number.isFinite(lastSyncedAt) ||
    lastSyncedAt <= 0
  ) {
    return {
      status: 'idle',
      visible: false,
      isPulsing: false,
      label: '',
      lastSyncedAt: null,
    };
  }
  const elapsed = Math.max(0, nowMs - lastSyncedAt);
  const windowMs = Math.max(400, pulseWindowMs);
  return {
    status: 'synced',
    visible: true,
    isPulsing: elapsed <= windowMs,
    label: DRAFT_SYNC_LABEL,
    lastSyncedAt,
  };
}

