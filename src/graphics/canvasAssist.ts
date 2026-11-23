import type { Point2D, SymmetryConfig } from './types';

export const GUIDE_RING_RADII = [120, 240, 330] as const;

export interface SnapConfig {
  snapToAxis: boolean;
  snapToRing: boolean;
  compassArcLock: boolean;
  snapThresholdPx: number;
}

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  snapToAxis: true,
  snapToRing: true,
  compassArcLock: false,
  snapThresholdPx: 10,
};

export interface SnapResult {
  point: Point2D;
  snappedAxisAngleDeg: number | null;
  snappedRingRadius: number | null;
  lockedRadius: number | null;
  wasSnapped: boolean;
}

function clampCoord(v: number, size: number): number {
  return Math.max(0, Math.min(size - 1, Math.round(v)));
}

/**
 * Projects a pointer coordinate onto the closest active symmetry reflection axis
 * (orthogonal projection onto Dihedral D_n mirror lines alpha_k = k*pi/n or Cyclic C_n
 * sector rays theta_k = 2*pi*k/n), concentric guide ring (r = 120, 240, 330), or a
 * locked compass arc radius so Alpona petals close cleanly with zero gap on mirror axes.
 */
export function snapPointToSymmetryGuides(
  rawPoint: Point2D,
  canvasSize: number,
  symmetry: SymmetryConfig,
  config: SnapConfig,
  compassLockRadius: number | null = null
): SnapResult {
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const dx = rawPoint.x - cx;
  const dy = rawPoint.y - cy;
  const distFromCenter = Math.hypot(dx, dy);
  const threshold = Math.max(2, Math.min(36, config.snapThresholdPx));
  const sectors = Math.max(1, Math.min(24, Math.round(symmetry.sectors)));

  // Active compass arc radius lock: preserve polar angle while pinning radius exactly
  const activeLockRadius =
    compassLockRadius !== null && compassLockRadius >= 4 ? compassLockRadius : null;

  let snappedAxisAngleDeg: number | null = null;
  let axisAngleRad: number | null = null;
  let axisSignedProj = distFromCenter;

  if (config.snapToAxis && distFromCenter > 2) {
    let bestPerpDist = threshold + 1e-6;
    if (symmetry.reflect) {
      // Dihedral D_n: full lines through center at alpha_k = k * pi / n
      for (let k = 0; k < sectors; k++) {
        const alpha = (Math.PI * k) / sectors;
        const ux = Math.cos(alpha);
        const uy = Math.sin(alpha);
        const proj = dx * ux + dy * uy;
        const perp = Math.abs(-dx * uy + dy * ux);
        if (perp <= bestPerpDist) {
          bestPerpDist = perp;
          snappedAxisAngleDeg = Number(((180 * k) / sectors).toFixed(1));
          axisAngleRad = alpha;
          axisSignedProj = proj;
        }
      }
    } else {
      // Cyclic C_n: positive rays from center at theta_k = 2 * pi * k / n
      for (let k = 0; k < sectors; k++) {
        const theta = (2 * Math.PI * k) / sectors;
        const ux = Math.cos(theta);
        const uy = Math.sin(theta);
        const proj = dx * ux + dy * uy;
        if (proj < 0) continue;
        const perp = Math.abs(-dx * uy + dy * ux);
        if (perp <= bestPerpDist) {
          bestPerpDist = perp;
          snappedAxisAngleDeg = Number(((360 * k) / sectors).toFixed(1));
          axisAngleRad = theta;
          axisSignedProj = proj;
        }
      }
    }
  }

  let snappedRingRadius: number | null = null;
  if (activeLockRadius !== null) {
    snappedRingRadius = Math.round(activeLockRadius);
  } else if (config.snapToRing) {
    let bestRingDiff = threshold + 1e-6;
    for (const r of GUIDE_RING_RADII) {
      const diff = Math.abs(distFromCenter - r);
      if (diff <= bestRingDiff) {
        bestRingDiff = diff;
        snappedRingRadius = r;
      }
    }
  }

  // Case 1: Compass arc lock (with optional axis angle snap at exact locked radius)
  if (activeLockRadius !== null) {
    let angle = Math.atan2(dy, dx);
    if (axisAngleRad !== null) {
      angle = axisSignedProj >= 0 ? axisAngleRad : axisAngleRad + Math.PI;
    }
    const sx = cx + Math.cos(angle) * activeLockRadius;
    const sy = cy + Math.sin(angle) * activeLockRadius;
    return {
      point: { x: clampCoord(sx, canvasSize), y: clampCoord(sy, canvasSize) },
      snappedAxisAngleDeg,
      snappedRingRadius: Math.round(activeLockRadius),
      lockedRadius: Math.round(activeLockRadius),
      wasSnapped: true,
    };
  }

  // Case 2: Exact intersection of snapped reflection axis AND snapped guide ring
  if (axisAngleRad !== null && snappedRingRadius !== null) {
    const sign = axisSignedProj >= 0 ? 1 : -1;
    const sx = cx + Math.cos(axisAngleRad) * snappedRingRadius * sign;
    const sy = cy + Math.sin(axisAngleRad) * snappedRingRadius * sign;
    return {
      point: { x: clampCoord(sx, canvasSize), y: clampCoord(sy, canvasSize) },
      snappedAxisAngleDeg,
      snappedRingRadius,
      lockedRadius: null,
      wasSnapped: true,
    };
  }

  // Case 3: Snapped to reflection axis only (orthogonal projection)
  if (axisAngleRad !== null) {
    const sx = cx + Math.cos(axisAngleRad) * axisSignedProj;
    const sy = cy + Math.sin(axisAngleRad) * axisSignedProj;
    return {
      point: { x: clampCoord(sx, canvasSize), y: clampCoord(sy, canvasSize) },
      snappedAxisAngleDeg,
      snappedRingRadius: null,
      lockedRadius: null,
      wasSnapped: true,
    };
  }

  // Case 4: Snapped to concentric guide ring only
  if (snappedRingRadius !== null && distFromCenter > 1e-6) {
    const scale = snappedRingRadius / distFromCenter;
    const sx = cx + dx * scale;
    const sy = cy + dy * scale;
    return {
      point: { x: clampCoord(sx, canvasSize), y: clampCoord(sy, canvasSize) },
      snappedAxisAngleDeg: null,
      snappedRingRadius,
      lockedRadius: null,
      wasSnapped: true,
    };
  }

  // Case 5: No snap triggered
  return {
    point: { x: clampCoord(rawPoint.x, canvasSize), y: clampCoord(rawPoint.y, canvasSize) },
    snappedAxisAngleDeg: null,
    snappedRingRadius: null,
    lockedRadius: null,
    wasSnapped: false,
  };
}
