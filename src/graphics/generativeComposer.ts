import type { DrawOperation, Point2D, SymmetryConfig } from './types';

export interface ProceduralAlponaConfig {
  seed: number;
  sectors: number; // 6, 8, 10, 12
  includePhyllotaxis: boolean;
  includeRhodonea: boolean;
  includeLSystemVine: boolean;
  primaryColor: string;
  accentColor: string;
  thickness: number;
}

export interface ProceduralComposeResult {
  operations: DrawOperation[];
  symmetry: SymmetryConfig;
  lSystemAxiomLength: number;
  phyllotaxisDots: number;
}

/**
 * Deterministic 32-bit LCG (bit-for-bit identical in TypeScript & C++11).
 */
export function nextDeterministicRand(state: { value: number }): number {
  state.value = (Math.imul(state.value, 1664525) + 1013904223) >>> 0;
  return state.value / 4294967296;
}

/**
 * Genuine Lindenmayer System (L-System) string rewriter for Bengali Lata-Pata
 * (curling vine & leaf sprig) motifs.
 */
export function expandLSystem(
  axiom: string,
  rules: Record<string, string>,
  iterations: number
): string {
  let cur = axiom;
  const safeIter = Math.max(0, Math.min(4, Math.round(iterations)));
  for (let i = 0; i < safeIter; i++) {
    let next = '';
    for (let c = 0; c < cur.length; c++) {
      const ch = cur[c];
      next += rules[ch] ?? ch;
    }
    cur = next;
    if (cur.length > 600) break;
  }
  return cur;
}

/**
 * Generator 1: Golden-Angle Phyllotaxis (Surya-Mukhi lotus seed core, 137.507764 deg).
 */
export function generatePhyllotaxisCore(
  canvasSize: number,
  dotCount: number,
  maxRadiusFrac: number,
  color: string,
  thickness: number,
  idPrefix = 'gen-phyllo'
): DrawOperation[] {
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const maxR = canvasSize * maxRadiusFrac;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.507764 deg
  const count = Math.max(8, Math.min(42, Math.round(dotCount)));
  const ops: DrawOperation[] = [];

  for (let i = 1; i <= count; i++) {
    const r = maxR * Math.sqrt(i / count);
    const theta = i * goldenAngle;
    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r;
    const dotR = Math.max(2, Math.round(2.4 + (i / count) * 2.2));
    ops.push({
      id: `${idPrefix}-${i}`,
      kind: 'circle',
      center: { x, y },
      radius: dotR,
      color,
      thickness: Math.max(1, Math.min(3, thickness)),
      symmetry: { sectors: 1, reflect: false },
    });
  }
  return ops;
}

/**
 * Generator 2: Polar Rhodonea Rose-Curve Lotus Ring r(theta) = rMid + A * cos(k * theta).
 * Emits one fundamental sector polyline mirrored across Dihedral D_n symmetry.
 */
export function generateRhodoneaLotusRing(
  canvasSize: number,
  sectors: number,
  innerFrac: number,
  outerFrac: number,
  petalHarmonic: number,
  color: string,
  thickness: number,
  idPrefix = 'gen-rhod'
): DrawOperation[] {
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const rIn = canvasSize * innerFrac;
  const rOut = canvasSize * outerFrac;
  const rMid = (rIn + rOut) * 0.5;
  const amp = (rOut - rIn) * 0.5;
  const safeSectors = Math.max(4, Math.min(16, Math.round(sectors)));
  const sectorSpan = (2 * Math.PI) / safeSectors;
  const steps = 28;
  const pts: Point2D[] = [];

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const theta = -Math.PI / 2 + u * (sectorSpan * 0.5);
    const r = rMid + amp * Math.cos(petalHarmonic * safeSectors * u * Math.PI);
    pts.push({
      x: cx + Math.cos(theta) * r,
      y: cy + Math.sin(theta) * r,
    });
  }

  return [
    {
      id: `${idPrefix}-curve`,
      kind: 'freehand',
      points: pts,
      color,
      thickness,
      tapered: true,
      symmetry: { sectors: safeSectors, reflect: true },
    },
  ];
}

/**
 * Generator 3: L-System Bengali Lata-Pata (curling vine & leaf sprig) outer border.
 * Expands an L-System string and interprets turtle steps (F, +, -, [, ]) anchored along a ring.
 */
export function generateLSystemVineBorder(
  canvasSize: number,
  sectors: number,
  ringFrac: number,
  iterations: number,
  branchAngleDeg: number,
  color: string,
  thickness: number,
  idPrefix = 'gen-lsys'
): { ops: DrawOperation[]; expandedLength: number } {
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const baseR = canvasSize * ringFrac;
  const safeSectors = Math.max(4, Math.min(16, Math.round(sectors)));

  const expanded = expandLSystem(
    'F',
    {
      F: 'F[+F][-F]F',
    },
    iterations
  );

  // Start turtle at top of the ring pointing outward-right along the sector arc
  let x = cx;
  let y = cy - baseR;
  let heading = -Math.PI / 2 + 0.14;
  const stepLen = Math.max(6, (canvasSize * 0.048) / Math.pow(1.42, Math.max(0, iterations - 1)));
  const angleRad = (branchAngleDeg * Math.PI) / 180;
  const stack: Array<{ x: number; y: number; heading: number }> = [];
  const ops: DrawOperation[] = [];
  let segIdx = 0;

  for (let i = 0; i < expanded.length && segIdx < 24; i++) {
    const ch = expanded[i];
    if (ch === 'F') {
      const nx = x + Math.cos(heading) * stepLen;
      const ny = y + Math.sin(heading) * stepLen;
      // Keep inside canvas frame safely
      const dist = Math.hypot(nx - cx, ny - cy);
      if (dist < canvasSize * 0.46) {
        ops.push({
          id: `${idPrefix}-seg-${segIdx++}`,
          kind: 'line',
          p0: { x, y },
          p1: { x: nx, y: ny },
          color,
          thickness: Math.max(1, thickness - (stack.length > 0 ? 1 : 0)),
          symmetry: { sectors: safeSectors, reflect: true },
        });
        x = nx;
        y = ny;
      }
    } else if (ch === '+') {
      heading += angleRad;
    } else if (ch === '-') {
      heading -= angleRad;
    } else if (ch === '[') {
      stack.push({ x, y, heading });
    } else if (ch === ']' && stack.length > 0) {
      const top = stack.pop()!;
      x = top.x;
      y = top.y;
      heading = top.heading;
    }
  }

  return { ops, expandedLength: expanded.length };
}

/**
 * Full deterministic Procedural Alpona Composer:
 * Combines compass structural rings + Golden-Angle Phyllotaxis + Polar Rhodonea Lotus
 * + L-System Lata-Pata Vine Border into editable Studio DrawOperations.
 */
export function composeProceduralAlpona(
  canvasSize: number,
  config: ProceduralAlponaConfig
): ProceduralComposeResult {
  const rng = { value: (config.seed >>> 0) || 1337 };
  const safeSectors = Math.max(4, Math.min(16, Math.round(config.sectors)));
  const symmetry: SymmetryConfig = { sectors: safeSectors, reflect: true };
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const ops: DrawOperation[] = [];
  const tag = `proc-${config.seed}`;

  // Structural compass rings framing the procedural layers
  const innerRingR = Math.round(canvasSize * (0.15 + nextDeterministicRand(rng) * 0.03));
  const midRingR = Math.round(canvasSize * (0.31 + nextDeterministicRand(rng) * 0.03));
  const outerRingR = Math.round(canvasSize * 0.44);

  ops.push(
    {
      id: `${tag}-ring-in`,
      kind: 'circle',
      center: { x: cx, y: cy },
      radius: innerRingR,
      color: config.primaryColor,
      thickness: config.thickness,
      symmetry: { sectors: 1, reflect: false },
    },
    {
      id: `${tag}-ring-mid`,
      kind: 'circle',
      center: { x: cx, y: cy },
      radius: midRingR,
      color: config.accentColor,
      thickness: Math.max(2, config.thickness - 1),
      symmetry: { sectors: 1, reflect: false },
    },
    {
      id: `${tag}-ring-out`,
      kind: 'circle',
      center: { x: cx, y: cy },
      radius: outerRingR,
      color: config.primaryColor,
      thickness: config.thickness,
      symmetry: { sectors: 1, reflect: false },
    }
  );

  let phyllotaxisDots = 0;
  if (config.includePhyllotaxis) {
    const count = 16 + Math.floor(nextDeterministicRand(rng) * 14);
    const phylloOps = generatePhyllotaxisCore(
      canvasSize,
      count,
      0.13,
      config.accentColor,
      config.thickness,
      `${tag}-phyllo`
    );
    phyllotaxisDots = phylloOps.length;
    ops.push(...phylloOps);
  }

  if (config.includeRhodonea) {
    const harmonic = nextDeterministicRand(rng) > 0.5 ? 2 : 1;
    ops.push(
      ...generateRhodoneaLotusRing(
        canvasSize,
        safeSectors,
        0.17,
        0.31,
        harmonic,
        config.primaryColor,
        config.thickness,
        `${tag}-rhod-1`
      )
    );
    ops.push(
      ...generateRhodoneaLotusRing(
        canvasSize,
        safeSectors,
        0.31,
        0.42,
        1,
        config.accentColor,
        Math.max(2, config.thickness - 1),
        `${tag}-rhod-2`
      )
    );
  }

  let lSystemAxiomLength = 0;
  if (config.includeLSystemVine) {
    const angle = 24 + Math.round(nextDeterministicRand(rng) * 16);
    const lsys = generateLSystemVineBorder(
      canvasSize,
      safeSectors,
      0.32,
      2,
      angle,
      config.primaryColor,
      config.thickness,
      `${tag}-lsys`
    );
    lSystemAxiomLength = lsys.expandedLength;
    ops.push(...lsys.ops);
  }

  return {
    operations: ops,
    symmetry,
    lSystemAxiomLength,
    phyllotaxisDots,
  };
}
