import { sampleCubicBezier } from './bezier';
import {
  generateSymmetricPoints,
  generateSymmetricPolygons,
  generateSymmetricSegments,
} from './transforms';
import type { DrawOperation, Point2D } from './types';

export interface ReferenceUnderlayConfig {
  dataUrl: string | null;
  name: string;
  visible: boolean;
  opacity: number; // 0.1 .. 0.85
  scale: number; // 0.5 .. 1.6
  rotateDeg: number; // -180 .. 180
}

export const DEFAULT_REFERENCE_UNDERLAY: ReferenceUnderlayConfig = {
  dataUrl: null,
  name: '',
  visible: true,
  opacity: 0.35,
  scale: 1.0,
  rotateDeg: 0,
};

export function toggleOperationVisibility(
  operations: DrawOperation[],
  id: string
): DrawOperation[] {
  return operations.map((op) =>
    op.id === id ? { ...op, hidden: !op.hidden } : op
  );
}

export function setAllOperationsVisibility(
  operations: DrawOperation[],
  visible: boolean
): DrawOperation[] {
  return operations.map((op) => ({ ...op, hidden: !visible }));
}

export function moveOperationOrder(
  operations: DrawOperation[],
  id: string,
  direction: 'up' | 'down'
): DrawOperation[] {
  const idx = operations.findIndex((op) => op.id === id);
  if (idx < 0) return operations;
  // Note: Higher array index renders ON TOP ("up" in visual z-order).
  const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
  if (targetIdx < 0 || targetIdx >= operations.length) return operations;
  const copy = operations.slice();
  const [moved] = copy.splice(idx, 1);
  copy.splice(targetIdx, 0, moved);
  return copy;
}

export function recolorOperation(
  operations: DrawOperation[],
  id: string,
  colorHex: string
): DrawOperation[] {
  return operations.map((op) =>
    op.id === id && !op.locked ? { ...op, color: colorHex } : op
  );
}

export function toggleOperationLock(
  operations: DrawOperation[],
  id: string
): DrawOperation[] {
  return operations.map((op) =>
    op.id === id ? { ...op, locked: !op.locked } : op
  );
}

export function setOperationOpacity(
  operations: DrawOperation[],
  id: string,
  opacity: number
): DrawOperation[] {
  const clamped = Math.max(0.1, Math.min(1, Number(opacity.toFixed(2))));
  return operations.map((op) =>
    op.id === id && !op.locked
      ? { ...op, opacity: clamped >= 0.995 ? undefined : clamped }
      : op
  );
}

export function deleteOperationById(
  operations: DrawOperation[],
  id: string
): DrawOperation[] {
  return operations.filter((op) => !(op.id === id && !op.locked));
}

export function duplicateOperationById(
  operations: DrawOperation[],
  id: string
): DrawOperation[] {
  const idx = operations.findIndex((op) => op.id === id);
  if (idx < 0) return operations;
  const src = operations[idx];
  const clone: DrawOperation = {
    ...src,
    id: `op-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    hidden: false,
  };
  const next = operations.slice();
  next.splice(idx + 1, 0, clone);
  return next;
}

export function describeOperation(op: DrawOperation, index: number): {
  title: string;
  symmetryTag: string;
} {
  const symTag = op.symmetry.reflect
    ? `D${op.symmetry.sectors}`
    : `C${op.symmetry.sectors}`;

  let kindLabel = 'Stroke';
  if (op.kind === 'circle') {
    kindLabel = `Circle r=${Math.round(op.radius)}`;
  } else if (op.kind === 'line') {
    kindLabel = 'Line';
  } else if (op.kind === 'polygon') {
    kindLabel = op.vertices.length >= 6 ? 'Star Polygon' : 'Petal Polygon';
  } else if (op.kind === 'bezier') {
    kindLabel = 'Bézier Motif';
  } else if (op.kind === 'freehand') {
    kindLabel = op.tapered ? 'Rice-Paste Curve' : 'Freehand Curve';
  } else if (op.kind === 'fill') {
    kindLabel = op.symmetric ? 'Symmetric Fill' : 'Seed Fill';
  }

  return {
    title: `#${index + 1} ${kindLabel}`,
    symmetryTag: symTag,
  };
}

function distPointToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-9) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
  const projX = a.x + t * vx;
  const projY = a.y + t * vy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Computes minimum Euclidean distance from query point `pt` to any symmetric copy
 * of `op` in logical canvas space.
 */
export function distanceToOperation(
  op: DrawOperation,
  pt: Point2D,
  canvasSize: number
): number {
  const center: Point2D = { x: canvasSize / 2, y: canvasSize / 2 };
  let minD = Number.POSITIVE_INFINITY;

  if (op.kind === 'line') {
    const segs = generateSymmetricSegments(op.p0, op.p1, center, op.symmetry);
    for (const s of segs) {
      const d = distPointToSegment(pt, s.p0, s.p1);
      if (d < minD) minD = d;
    }
    return Math.max(0, minD - op.thickness * 0.5);
  }

  if (op.kind === 'circle') {
    const centers = generateSymmetricPoints(op.center, center, op.symmetry);
    for (const c of centers) {
      const d = Math.abs(Math.hypot(pt.x - c.x, pt.y - c.y) - op.radius);
      if (d < minD) minD = d;
    }
    return Math.max(0, minD - op.thickness * 0.5);
  }

  if (op.kind === 'polygon') {
    const polys = generateSymmetricPolygons(op.vertices, center, op.symmetry);
    for (const poly of polys) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const d = distPointToSegment(pt, a, b);
        if (d < minD) minD = d;
      }
    }
    return Math.max(0, minD - op.thickness * 0.5);
  }

  if (op.kind === 'freehand') {
    if (op.points.length === 1) {
      const pts = generateSymmetricPoints(op.points[0], center, op.symmetry);
      for (const p of pts) {
        const d = Math.hypot(pt.x - p.x, pt.y - p.y);
        if (d < minD) minD = d;
      }
    } else {
      for (let i = 1; i < op.points.length; i++) {
        const segs = generateSymmetricSegments(
          op.points[i - 1],
          op.points[i],
          center,
          op.symmetry
        );
        for (const s of segs) {
          const d = distPointToSegment(pt, s.p0, s.p1);
          if (d < minD) minD = d;
        }
      }
    }
    return Math.max(0, minD - op.thickness * 0.5);
  }

  if (op.kind === 'bezier') {
    const sampled = sampleCubicBezier(op.p0, op.p1, op.p2, op.p3, 24);
    for (let i = 1; i < sampled.length; i++) {
      const segs = generateSymmetricSegments(
        sampled[i - 1],
        sampled[i],
        center,
        op.symmetry
      );
      for (const s of segs) {
        const d = distPointToSegment(pt, s.p0, s.p1);
        if (d < minD) minD = d;
      }
    }
    return Math.max(0, minD - op.thickness * 0.5);
  }

  if (op.kind === 'fill') {
    const seeds = op.symmetric
      ? generateSymmetricPoints(op.seed, center, op.symmetry)
      : [op.seed];
    for (const s of seeds) {
      const d = Math.hypot(pt.x - s.x, pt.y - s.y);
      if (d < minD) minD = d;
    }
    return minD;
  }

  return minD;
}

/**
 * Hit-tests the operation stack from topmost (highest z-index) downward and returns
 * the first visible operation within `thresholdPx` of `pt`, or null if none match.
 */
export function hitTestOperationAtPoint(
  operations: DrawOperation[],
  pt: Point2D,
  canvasSize: number,
  thresholdPx = 14,
  skipLocked = false
): DrawOperation | null {
  for (let i = operations.length - 1; i >= 0; i--) {
    const op = operations[i];
    if (op.hidden) continue;
    if (skipLocked && op.locked) continue;
    const dist = distanceToOperation(op, pt, canvasSize);
    if (dist <= thresholdPx) {
      return op;
    }
  }
  return null;
}

export interface GroupSelectionResult {
  groupName: string;
  accentHex: string;
  hitOperationId: string;
  operationIds: string[];
}

export function normalizeOperationGroup(op: Pick<DrawOperation, 'group'>): string {
  return op.group && op.group.trim() ? op.group.trim() : 'Motifs';
}

/**
 * Returns all operation IDs in `operations` sharing the given normalized group attribute.
 */
export function getOperationIdsInGroup(
  operations: DrawOperation[],
  groupName: string
): string[] {
  const normalizedTarget = groupName.trim() || 'Motifs';
  const ids: string[] = [];
  for (const op of operations) {
    if (normalizeOperationGroup(op) === normalizedTarget) {
      ids.push(op.id);
    }
  }
  return ids;
}

/**
 * Hit-tests the canvas at `pt` (including all symmetric copies) and selects all
 * operations sharing the hit stroke's group attribute. Picks the closest visible
 * stroke within `thresholdPx`, breaking near-ties (<= 3px) by topmost z-order.
 */
export function selectGroupAtPoint(
  operations: DrawOperation[],
  pt: Point2D,
  canvasSize: number,
  thresholdPx = 18
): GroupSelectionResult | null {
  let bestOp: DrawOperation | null = null;
  let bestDist = thresholdPx;

  for (let i = operations.length - 1; i >= 0; i--) {
    const op = operations[i];
    if (op.hidden) continue;
    const dist = distanceToOperation(op, pt, canvasSize);
    if (dist <= thresholdPx) {
      if (bestOp === null || dist + 3 < bestDist) {
        bestOp = op;
        bestDist = dist;
      }
    }
  }

  if (!bestOp) return null;
  const groupName = normalizeOperationGroup(bestOp);
  return {
    groupName,
    accentHex: getLayerGroupAccent(groupName),
    hitOperationId: bestOp.id,
    operationIds: getOperationIdsInGroup(operations, groupName),
  };
}

/**
 * Generates an offline SVG data URL of a classical Bengali Shantiniketan Lotus
 * chalk sketch so users can test Reference Photo Tracing immediately with one click.
 */
export function buildSampleReferenceSketchDataUrl(): string {
  const cx = 360;
  const cy = 360;
  const petals: string[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const aL = a - 0.24;
    const aR = a + 0.24;
    const tipX = cx + Math.cos(a) * 285;
    const tipY = cy + Math.sin(a) * 285;
    const c1X = cx + Math.cos(aL) * 200;
    const c1Y = cy + Math.sin(aL) * 200;
    const c2X = cx + Math.cos(aR) * 200;
    const c2Y = cy + Math.sin(aR) * 200;
    const base1X = cx + Math.cos(aL) * 90;
    const base1Y = cy + Math.sin(aL) * 90;
    const base2X = cx + Math.cos(aR) * 90;
    const base2Y = cy + Math.sin(aR) * 90;
    petals.push(
      `<path d="M ${base1X.toFixed(1)} ${base1Y.toFixed(1)} Q ${c1X.toFixed(1)} ${c1Y.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q ${c2X.toFixed(1)} ${c2Y.toFixed(1)} ${base2X.toFixed(1)} ${base2Y.toFixed(1)}" fill="none" stroke="#94A3B8" stroke-width="3" stroke-dasharray="6 5" />`
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720">
    <circle cx="360" cy="360" r="88" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-dasharray="8 6" />
    <circle cx="360" cy="360" r="295" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-dasharray="10 7" />
    ${petals.join('')}
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const LAYER_GROUP_PRESETS = ['Core', 'Petals', 'Border', 'Motifs'] as const;
export type LayerGroupName = (typeof LAYER_GROUP_PRESETS)[number];
export type BezierHandleKey = 'p0' | 'p1' | 'p2' | 'p3';

/**
 * Assigns a semantic ring/layer group (e.g. Core, Petals, Border, Motifs) to an operation.
 */
export function assignOperationGroup(
  operations: DrawOperation[],
  id: string,
  group: string | undefined
): DrawOperation[] {
  return operations.map((op) =>
    op.id === id ? { ...op, group: group && group.trim() ? group.trim() : undefined } : op
  );
}

/**
 * Toggles visibility for every operation belonging to `group`.
 * If any operation in the group is visible, hides the entire group; otherwise shows all.
 */
export function toggleGroupVisibility(
  operations: DrawOperation[],
  group: string
): DrawOperation[] {
  const members = operations.filter((op) => (op.group ?? 'Motifs') === group);
  if (members.length === 0) return operations;
  const anyVisible = members.some((op) => !op.hidden);
  return operations.map((op) =>
    (op.group ?? 'Motifs') === group ? { ...op, hidden: anyVisible } : op
  );
}

/**
 * Lists distinct layer groups present in `operations`, ordered by preset hierarchy first.
 */
export function listOperationGroups(
  operations: DrawOperation[]
): Array<{ name: string; total: number; visible: number }> {
  const counts = new Map<string, { total: number; visible: number }>();
  for (const op of operations) {
    const g = op.group ?? 'Motifs';
    const cur = counts.get(g) ?? { total: 0, visible: 0 };
    cur.total++;
    if (!op.hidden) cur.visible++;
    counts.set(g, cur);
  }
  const orderedNames = [
    ...LAYER_GROUP_PRESETS.filter((p) => counts.has(p)),
    ...Array.from(counts.keys()).filter(
      (k) => !(LAYER_GROUP_PRESETS as readonly string[]).includes(k)
    ),
  ];
  return orderedNames.map((name) => ({
    name,
    ...(counts.get(name) ?? { total: 0, visible: 0 }),
  }));
}

export interface LayerGroupEntry {
  op: DrawOperation;
  index: number; // original z-order index in operations[]
}

export interface LayerGroupSection {
  name: string;
  accentHex: string;
  entries: LayerGroupEntry[]; // ordered top-most z-order first
  total: number;
  visible: number;
  lockedCount: number;
}

const LAYER_GROUP_ACCENT_MAP: Record<string, string> = {
  Core: '#B91C1C', // Sindoor crimson
  Petals: '#D97706', // Turmeric amber
  Border: '#2563EB', // Neel indigo
  Motifs: '#15803D', // Pata green
};

const FALLBACK_GROUP_ACCENTS = [
  '#7C3AED',
  '#0F766E',
  '#BE185D',
  '#4338CA',
];

/**
 * Returns a deterministic visual accent color hex for a layer group category
 * so members of the same group share an unmistakable visual indicator.
 */
export function getLayerGroupAccent(groupName: string): string {
  const key = groupName.trim() || 'Motifs';
  if (LAYER_GROUP_ACCENT_MAP[key]) {
    return LAYER_GROUP_ACCENT_MAP[key];
  }
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_GROUP_ACCENTS[hash % FALLBACK_GROUP_ACCENTS.length];
}

/**
 * Groups operations into collapsible visual categories ordered by highest z-order
 * member first (matching top-to-bottom canvas stacking), with entries inside each
 * group also ordered top-most z-order first.
 */
export function groupOperationsByCategory(
  operations: DrawOperation[],
  groupFilter = 'All'
): LayerGroupSection[] {
  const map = new Map<
    string,
    { entries: LayerGroupEntry[]; maxIndex: number; visible: number; lockedCount: number }
  >();

  for (let i = operations.length - 1; i >= 0; i--) {
    const op = operations[i];
    const name = op.group && op.group.trim() ? op.group.trim() : 'Motifs';
    if (groupFilter !== 'All' && name !== groupFilter) continue;

    let bucket = map.get(name);
    if (!bucket) {
      bucket = { entries: [], maxIndex: i, visible: 0, lockedCount: 0 };
      map.set(name, bucket);
    }
    bucket.entries.push({ op, index: i });
    if (i > bucket.maxIndex) bucket.maxIndex = i;
    if (!op.hidden) bucket.visible++;
    if (op.locked) bucket.lockedCount++;
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1].maxIndex - a[1].maxIndex)
    .map(([name, bucket]) => ({
      name,
      accentHex: getLayerGroupAccent(name),
      entries: bucket.entries,
      total: bucket.entries.length,
      visible: bucket.visible,
      lockedCount: bucket.lockedCount,
    }));
}

export function toggleGroupCollapsed(
  collapsed: ReadonlySet<string>,
  groupName: string
): Set<string> {
  const next = new Set(collapsed);
  if (next.has(groupName)) {
    next.delete(groupName);
  } else {
    next.add(groupName);
  }
  return next;
}

export function setAllGroupsCollapsed(
  groupNames: string[],
  collapse: boolean
): Set<string> {
  return collapse ? new Set(groupNames) : new Set<string>();
}

export function areAllGroupsCollapsed(
  collapsed: ReadonlySet<string>,
  groupNames: string[]
): boolean {
  return groupNames.length > 0 && groupNames.every((name) => collapsed.has(name));
}

/**
 * Updates one of the four Cubic Bézier anchor/control points (P0, P1, P2, P3)
 * on a committed Bézier DrawOperation.
 */
export function updateBezierControlPoint(
  operations: DrawOperation[],
  id: string,
  handle: BezierHandleKey,
  nextPoint: Point2D
): DrawOperation[] {
  return operations.map((op) => {
    if (op.id !== id || op.kind !== 'bezier' || op.locked) return op;
    return {
      ...op,
      [handle]: { x: nextPoint.x, y: nextPoint.y },
    };
  });
}

/**
 * Finds the topmost visible Bézier operation within `thresholdPx` of `pt`
 * (checking both its 4 control points and its symmetric curve outline).
 */
export function findNearestBezierOp(
  operations: DrawOperation[],
  pt: Point2D,
  canvasSize: number,
  thresholdPx = 20
): Extract<DrawOperation, { kind: 'bezier' }> | null {
  for (let i = operations.length - 1; i >= 0; i--) {
    const op = operations[i];
    if (op.hidden || op.kind !== 'bezier') continue;
    const handles: Point2D[] = [op.p0, op.p1, op.p2, op.p3];
    if (handles.some((h) => Math.hypot(h.x - pt.x, h.y - pt.y) <= thresholdPx)) {
      return op;
    }
    if (distanceToOperation(op, pt, canvasSize) <= thresholdPx) {
      return op;
    }
  }
  return null;
}
