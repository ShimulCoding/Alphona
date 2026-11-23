import { drawBresenhamLine, type PixelSurface } from './rasterizer';
import { hexToRgba, type RGBA } from './types';

export type ProjectionMode = 'perspective' | 'parallel';
export type HiddenSurfaceMode = 'wireframe' | 'painters' | 'zbuffer' | 'depth-map';
export type Scene3DMode = 'courtyard-floor' | 'monument';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Triangle3D {
  v0: Vec3;
  v1: Vec3;
  v2: Vec3;
  color: RGBA;
  layer: string;
}

export interface Transform3DParams {
  rotXDeg: number; // pitch
  rotYDeg: number; // yaw
  rotZDeg: number; // roll
  scale: number;
  translateX: number;
  translateY: number;
  focalLength: number; // perspective camera distance d
  projection: ProjectionMode;
  hsrMode: HiddenSurfaceMode;
  allowCopAnomaly?: boolean; // Demonstrates textbook View Confusion when z <= -d
}

export interface PerspectivePreset {
  id: string;
  label: string;
  shortDesc: string;
  rotXDeg: number;
  rotYDeg: number;
  rotZDeg: number;
  scale: number;
  focalLength: number;
  projection: ProjectionMode;
  allowCopAnomaly: boolean;
}

export const PERSPECTIVE_ANOMALY_PRESETS: PerspectivePreset[] = [
  {
    id: 'one-point',
    label: '1-Point Courtyard',
    shortDesc: 'Single Z-axis vanishing point looking cleanly down onto the courtyard.',
    rotXDeg: 44,
    rotYDeg: 0,
    rotZDeg: 0,
    scale: 0.86,
    focalLength: 2.8,
    projection: 'perspective',
    allowCopAnomaly: false,
  },
  {
    id: 'two-point',
    label: '2-Point Corner',
    shortDesc: 'Two vanishing points along horizontal X and Z courtyard edges.',
    rotXDeg: 36,
    rotYDeg: 34,
    rotZDeg: 0,
    scale: 0.84,
    focalLength: 2.8,
    projection: 'perspective',
    allowCopAnomaly: false,
  },
  {
    id: 'three-point',
    label: '3-Point Dramatic Tilt',
    shortDesc: 'Strong pitch + yaw + roll convergence creating 3 vanishing points.',
    rotXDeg: 46,
    rotYDeg: 32,
    rotZDeg: 14,
    scale: 0.82,
    focalLength: 2.2,
    projection: 'perspective',
    allowCopAnomaly: false,
  },
  {
    id: 'view-confusion',
    label: 'View Confusion (z ≤ -d)',
    shortDesc:
      'Perspective Anomaly: camera distance d shrinks inside the object (z ≤ -d), causing vertices behind the Center of Projection to invert and flip across the viewport.',
    rotXDeg: 28,
    rotYDeg: 24,
    rotZDeg: 0,
    scale: 1.25,
    focalLength: 0.72,
    projection: 'perspective',
    allowCopAnomaly: true,
  },
  {
    id: 'parallel-ortho',
    label: 'Parallel Orthographic',
    shortDesc: 'Zero perspective foreshortening; parallel courtyard lines stay strictly parallel.',
    rotXDeg: 36,
    rotYDeg: 32,
    rotZDeg: 0,
    scale: 0.96,
    focalLength: 3.4,
    projection: 'parallel',
    allowCopAnomaly: false,
  },
];

export interface Render3DMetrics {
  triangleCount: number;
  pixelsShaded: number;
  zBufferRejects: number;
  projectionMatrix: number[]; // 4x4 row-major
  anomalyVerticesCount?: number;
}

export function rotateX3D(v: Vec3, rad: number): Vec3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

export function rotateY3D(v: Vec3, rad: number): Vec3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

export function rotateZ3D(v: Vec3, rad: number): Vec3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}

export function transformVertex3D(v: Vec3, params: Transform3DParams): Vec3 {
  const rx = (params.rotXDeg * Math.PI) / 180;
  const ry = (params.rotYDeg * Math.PI) / 180;
  const rz = (params.rotZDeg * Math.PI) / 180;

  let p: Vec3 = {
    x: v.x * params.scale,
    y: v.y * params.scale,
    z: v.z * params.scale,
  };
  // Turntable yaw (Y), then downward camera elevation pitch (-X), then screen roll (Z)
  p = rotateY3D(p, ry);
  p = rotateX3D(p, -rx);
  p = rotateZ3D(p, rz);
  return {
    x: p.x + params.translateX,
    y: p.y + params.translateY,
    z: p.z,
  };
}

/**
 * Projects a transformed 3D point onto 2D viewport coordinates using either
 * Perspective Projection (x' = d*x / (d + z)) or Parallel Orthographic Projection.
 */
export function projectPoint3D(
  p: Vec3,
  width: number,
  height: number,
  params: Transform3DParams
): Vec3 {
  const cx = width / 2;
  const cy = height / 2;
  const scalePx = Math.min(width, height) * 0.36;

  if (params.projection === 'parallel') {
    return {
      x: cx + p.x * scalePx,
      y: cy - p.y * scalePx,
      z: p.z,
    };
  }

  // Perspective projection with camera at z = -d looking toward +z
  if (params.allowCopAnomaly) {
    const d = Math.max(0.35, params.focalLength);
    let denom = d + p.z;
    // Avoid exact zero division while preserving negative sign inversion (View Confusion)
    if (Math.abs(denom) < 0.08) {
      denom = denom >= 0 ? 0.08 : -0.08;
    }
    const factor = d / denom;
    return {
      x: cx + p.x * factor * scalePx,
      y: cy - p.y * factor * scalePx,
      z: p.z,
    };
  }

  const d = Math.max(1.6, params.focalLength);
  const denom = Math.max(0.35, d + p.z);
  const factor = d / denom;
  return {
    x: cx + p.x * factor * scalePx,
    y: cy - p.y * factor * scalePx,
    z: p.z,
  };
}

/**
 * Returns the explicit 4x4 projection matrix for live display in the 3D inspector.
 */
export function getProjectionMatrix4x4(params: Transform3DParams): number[] {
  if (params.projection === 'parallel') {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 1,
    ];
  }
  const minD = params.allowCopAnomaly ? 0.35 : 1.6;
  const invD = 1 / Math.max(minD, params.focalLength);
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, invD, 1,
  ];
}

/**
 * Builds a multi-layered 3D Bengali Alpona Courtyard Mandala monument with distinct
 * elevation depths (base plinth, outer lotus petals, mid ring, raised inner crown,
 * and central pyramid kalash) so Painter's Algorithm vs Z-Buffer occlusion is vivid.
 */
export function buildAlponaMonumentMesh(sectorsInput: number): Triangle3D[] {
  const sectors = Math.max(4, Math.min(16, Math.round(sectorsInput)));
  const tris: Triangle3D[] = [];

  const slateFloor = hexToRgba('#452724');
  const ivory = hexToRgba('#FAF8F2');
  const crimson = hexToRgba('#DC2626');
  const gold = hexToRgba('#F59E0B');
  const terracotta = hexToRgba('#991B1B');

  // 1. Courtyard plinth (y = -0.32)
  const plinthSize = 1.15;
  const py = -0.32;
  const pA: Vec3 = { x: -plinthSize, y: py, z: -plinthSize };
  const pB: Vec3 = { x: plinthSize, y: py, z: -plinthSize };
  const pC: Vec3 = { x: plinthSize, y: py, z: plinthSize };
  const pD: Vec3 = { x: -plinthSize, y: py, z: plinthSize };
  tris.push({ v0: pA, v1: pB, v2: pC, color: slateFloor, layer: 'plinth' });
  tris.push({ v0: pA, v1: pC, v2: pD, color: slateFloor, layer: 'plinth' });

  const step = (2 * Math.PI) / sectors;

  for (let k = 0; k < sectors; k++) {
    const a0 = k * step;
    const aMid = (k + 0.5) * step;
    const a1 = (k + 1) * step;

    // 2. Outer rice-paste lotus petals tilted upward (y from -0.24 to +0.02)
    const rInner = 0.48;
    const rTip = 1.02;
    const oBase0: Vec3 = { x: Math.cos(a0) * rInner, y: -0.22, z: Math.sin(a0) * rInner };
    const oBase1: Vec3 = { x: Math.cos(a1) * rInner, y: -0.22, z: Math.sin(a1) * rInner };
    const oTip: Vec3 = { x: Math.cos(aMid) * rTip, y: 0.02, z: Math.sin(aMid) * rTip };
    tris.push({
      v0: oBase0,
      v1: oTip,
      v2: oBase1,
      color: k % 2 === 0 ? ivory : hexToRgba('#E4E0D5'),
      layer: 'outer-petals',
    });

    // 3. Elevated Sindoor crimson inner lotus crown (y from -0.10 to +0.26)
    const cInner = 0.24;
    const cTip = 0.64;
    const iBase0: Vec3 = { x: Math.cos(a0) * cInner, y: -0.06, z: Math.sin(a0) * cInner };
    const iBase1: Vec3 = { x: Math.cos(a1) * cInner, y: -0.06, z: Math.sin(a1) * cInner };
    const iTip: Vec3 = { x: Math.cos(aMid) * cTip, y: 0.24, z: Math.sin(aMid) * cTip };
    tris.push({
      v0: iBase0,
      v1: iTip,
      v2: iBase1,
      color: k % 2 === 0 ? crimson : terracotta,
      layer: 'inner-crown',
    });

    // 4. Elevated central Halud gold kalash finial (y from 0.04 to +0.54)
    const kRad = 0.26;
    const k0: Vec3 = { x: Math.cos(a0) * kRad, y: 0.04, z: Math.sin(a0) * kRad };
    const k1: Vec3 = { x: Math.cos(a1) * kRad, y: 0.04, z: Math.sin(a1) * kRad };
    const apex: Vec3 = { x: 0, y: 0.56, z: 0 };
    tris.push({
      v0: k0,
      v1: apex,
      v2: k1,
      color: k % 2 === 0 ? gold : hexToRgba('#D97706'),
      layer: 'kalash',
    });
  }

  return tris;
}

function shadeFlatColor(base: RGBA, v0: Vec3, v1: Vec3, v2: Vec3): RGBA {
  // Compute surface normal for simple Lambertian directional lighting
  const ux = v1.x - v0.x;
  const uy = v1.y - v0.y;
  const uz = v1.z - v0.z;
  const vx = v2.x - v0.x;
  const vy = v2.y - v0.y;
  const vz = v2.z - v0.z;

  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;

  // Directional light from top-front-right (two-sided shading for thin lotus petals)
  const lx = 0.35;
  const ly = 0.82;
  const lz = -0.45;
  const ndotl = Math.abs(nx * lx + ny * ly + nz * lz);
  const intensity = 0.42 + 0.58 * ndotl;

  return {
    r: Math.min(255, Math.round(base.r * intensity)),
    g: Math.min(255, Math.round(base.g * intensity)),
    b: Math.min(255, Math.round(base.b * intensity)),
    a: 255,
  };
}

function edgeFn(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
}

/**
 * Software-renders a 3D Alpona monument using either Wireframe, Painter's Algorithm,
 * per-pixel Z-Buffer, or Z-Buffer Depth Map visualization.
 */
export function render3DScene(
  surface: PixelSurface,
  mesh: Triangle3D[],
  params: Transform3DParams,
  backgroundHex = '#141418'
): Render3DMetrics {
  const { width, height, data } = surface;
  const bg = hexToRgba(backgroundHex);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bg.r;
    data[i + 1] = bg.g;
    data[i + 2] = bg.b;
    data[i + 3] = 255;
  }

  const zBuffer = new Float32Array(width * height);
  zBuffer.fill(Infinity);

  let pixelsShaded = 0;
  let zBufferRejects = 0;

  interface ProjectedTri {
    p0: Vec3;
    p1: Vec3;
    p2: Vec3;
    avgZ: number;
    shaded: RGBA;
    wireColor: RGBA;
  }

  const projected: ProjectedTri[] = [];
  for (const tri of mesh) {
    const t0 = transformVertex3D(tri.v0, params);
    const t1 = transformVertex3D(tri.v1, params);
    const t2 = transformVertex3D(tri.v2, params);

    const p0 = projectPoint3D(t0, width, height, params);
    const p1 = projectPoint3D(t1, width, height, params);
    const p2 = projectPoint3D(t2, width, height, params);

    projected.push({
      p0,
      p1,
      p2,
      avgZ: (t0.z + t1.z + t2.z) / 3,
      shaded: shadeFlatColor(tri.color, t0, t1, t2),
      wireColor: tri.color,
    });
  }

  // Painter's Algorithm: sort triangles back-to-front (largest z drawn first)
  if (params.hsrMode === 'painters') {
    projected.sort((a, b) => b.avgZ - a.avgZ);
  }

  if (params.hsrMode === 'wireframe') {
    for (const tri of projected) {
      pixelsShaded += drawBresenhamLine(
        surface,
        tri.p0.x,
        tri.p0.y,
        tri.p1.x,
        tri.p1.y,
        tri.wireColor,
        1
      );
      pixelsShaded += drawBresenhamLine(
        surface,
        tri.p1.x,
        tri.p1.y,
        tri.p2.x,
        tri.p2.y,
        tri.wireColor,
        1
      );
      pixelsShaded += drawBresenhamLine(
        surface,
        tri.p2.x,
        tri.p2.y,
        tri.p0.x,
        tri.p0.y,
        tri.wireColor,
        1
      );
    }
    return {
      triangleCount: mesh.length,
      pixelsShaded,
      zBufferRejects: 0,
      projectionMatrix: getProjectionMatrix4x4(params),
    };
  }

  // Rasterize triangles using barycentric scan-conversion
  const useZTest = params.hsrMode === 'zbuffer' || params.hsrMode === 'depth-map';
  const showDepth = params.hsrMode === 'depth-map';

  for (const tri of projected) {
    const { p0, p1, p2, shaded } = tri;
    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

    const area = edgeFn(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
    if (Math.abs(area) < 1e-4) continue;
    const invArea = 1 / area;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = edgeFn(p1.x, p1.y, p2.x, p2.y, px, py) * invArea;
        const w1 = edgeFn(p2.x, p2.y, p0.x, p0.y, px, py) * invArea;
        const w2 = 1 - w0 - w1;

        if (w0 < 0 || w1 < 0 || w2 < 0) continue;

        const z = w0 * p0.z + w1 * p1.z + w2 * p2.z;
        const bufIdx = y * width + x;

        if (useZTest) {
          if (z < zBuffer[bufIdx]) {
            zBuffer[bufIdx] = z;
          } else {
            zBufferRejects++;
            continue;
          }
        }

        const off = bufIdx * 4;
        if (showDepth) {
          // Nearer z -> brighter ivory; farther z -> darker slate
          const norm = Math.max(0, Math.min(1, 1 - (z + 1.5) / 3.0));
          const gray = Math.round(norm * 245);
          data[off] = gray;
          data[off + 1] = gray;
          data[off + 2] = Math.min(255, gray + 10);
          data[off + 3] = 255;
        } else {
          data[off] = shaded.r;
          data[off + 1] = shaded.g;
          data[off + 2] = shaded.b;
          data[off + 3] = 255;
        }
        pixelsShaded++;
      }
    }
  }

  return {
    triangleCount: mesh.length,
    pixelsShaded,
    zBufferRejects,
    projectionMatrix: getProjectionMatrix4x4(params),
  };
}

interface TexturedTri3D {
  v0: Vec3;
  v1: Vec3;
  v2: Vec3;
  uv0?: [number, number];
  uv1?: [number, number];
  uv2?: [number, number];
  color: RGBA;
  textured: boolean;
}

/**
 * Renders the user's live 2D Alpona PixelSurface texture-mapped onto a 3D Bengali
 * courtyard floor slab with raised terracotta plinth walls and 4 festive corner diyas,
 * using perspective-correct (1/w) barycentric interpolation and Z-Buffer / Painter's HSR.
 */
export function render3DCourtyardFloor(
  surface: PixelSurface,
  alponaTexture: PixelSurface,
  params: Transform3DParams,
  backgroundHex = '#141418'
): Render3DMetrics {
  const { width, height, data } = surface;
  const bg = hexToRgba(backgroundHex);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bg.r;
    data[i + 1] = bg.g;
    data[i + 2] = bg.b;
    data[i + 3] = 255;
  }

  const tris: TexturedTri3D[] = [];
  const half = 0.96;
  const topY = -0.08;
  const botY = -0.24;
  const borderColor = hexToRgba('#5B3029');
  const sideDark = hexToRgba('#3F201B');
  const sideWarm = hexToRgba('#6E3B32');
  const diyaClay = hexToRgba('#9A3412');
  const flameGold = hexToRgba('#FBBF24');

  // 1. Subdivided 4x4 courtyard floor grid (32 textured triangles for crisp perspective & anomaly visibility)
  const gridN = 4;
  for (let gz = 0; gz < gridN; gz++) {
    const v0Coord = gz / gridN;
    const v1Coord = (gz + 1) / gridN;
    const z0 = -half + v0Coord * (2 * half);
    const z1 = -half + v1Coord * (2 * half);
    for (let gx = 0; gx < gridN; gx++) {
      const u0Coord = gx / gridN;
      const u1Coord = (gx + 1) / gridN;
      const x0 = -half + u0Coord * (2 * half);
      const x1 = -half + u1Coord * (2 * half);

      const a: Vec3 = { x: x0, y: topY, z: z0 };
      const b: Vec3 = { x: x1, y: topY, z: z0 };
      const c: Vec3 = { x: x1, y: topY, z: z1 };
      const dPt: Vec3 = { x: x0, y: topY, z: z1 };

      tris.push({
        v0: a,
        v1: b,
        v2: c,
        uv0: [u0Coord, v0Coord],
        uv1: [u1Coord, v0Coord],
        uv2: [u1Coord, v1Coord],
        color: hexToRgba('#FAF8F2'),
        textured: true,
      });
      tris.push({
        v0: a,
        v1: c,
        v2: dPt,
        uv0: [u0Coord, v0Coord],
        uv1: [u1Coord, v1Coord],
        uv2: [u0Coord, v1Coord],
        color: hexToRgba('#FAF8F2'),
        textured: true,
      });
    }
  }

  // 2. Terracotta courtyard plinth rim & vertical slab sides
  const outer = 1.12;
  const cornersTop: Vec3[] = [
    { x: -outer, y: topY - 0.008, z: -outer },
    { x: outer, y: topY - 0.008, z: -outer },
    { x: outer, y: topY - 0.008, z: outer },
    { x: -outer, y: topY - 0.008, z: outer },
  ];
  const cornersBot: Vec3[] = [
    { x: -outer, y: botY, z: -outer },
    { x: outer, y: botY, z: -outer },
    { x: outer, y: botY, z: outer },
    { x: -outer, y: botY, z: outer },
  ];
  // Outer rim floor underneath the canvas
  tris.push({
    v0: cornersTop[0],
    v1: cornersTop[1],
    v2: cornersTop[2],
    color: borderColor,
    textured: false,
  });
  tris.push({
    v0: cornersTop[0],
    v1: cornersTop[2],
    v2: cornersTop[3],
    color: borderColor,
    textured: false,
  });

  // 4 plinth vertical sides
  for (let i = 0; i < 4; i++) {
    const nxt = (i + 1) % 4;
    const col = i % 2 === 0 ? sideWarm : sideDark;
    tris.push({
      v0: cornersTop[i],
      v1: cornersTop[nxt],
      v2: cornersBot[nxt],
      color: col,
      textured: false,
    });
    tris.push({
      v0: cornersTop[i],
      v1: cornersBot[nxt],
      v2: cornersBot[i],
      color: col,
      textured: false,
    });
  }

  // 3. Four festive terracotta corner diyas with golden flames (elevated above the floor)
  const diyaPos: Array<[number, number]> = [
    [-1.02, -1.02],
    [1.02, -1.02],
    [1.02, 1.02],
    [-1.02, 1.02],
  ];
  for (const [dx, dz] of diyaPos) {
    const r = 0.085;
    const baseY = topY;
    const cupY = topY + 0.07;
    const flameY = topY + 0.21;
    const ring: Vec3[] = [
      { x: dx - r, y: baseY, z: dz },
      { x: dx, y: baseY, z: dz - r },
      { x: dx + r, y: baseY, z: dz },
      { x: dx, y: baseY, z: dz + r },
    ];
    const cupApex: Vec3 = { x: dx, y: cupY, z: dz };
    const flameTip: Vec3 = { x: dx, y: flameY, z: dz };
    for (let k = 0; k < 4; k++) {
      const kn = (k + 1) % 4;
      tris.push({
        v0: ring[k],
        v1: ring[kn],
        v2: cupApex,
        color: diyaClay,
        textured: false,
      });
      const fBase0: Vec3 = {
        x: dx + (ring[k].x - dx) * 0.42,
        y: cupY,
        z: dz + (ring[k].z - dz) * 0.42,
      };
      const fBase1: Vec3 = {
        x: dx + (ring[kn].x - dx) * 0.42,
        y: cupY,
        z: dz + (ring[kn].z - dz) * 0.42,
      };
      tris.push({
        v0: fBase0,
        v1: fBase1,
        v2: flameTip,
        color: flameGold,
        textured: false,
      });
    }
  }

  const zBuffer = new Float32Array(width * height);
  zBuffer.fill(Infinity);
  let pixelsShaded = 0;
  let zBufferRejects = 0;
  let anomalyVerticesCount = 0;

  const minD = params.allowCopAnomaly ? 0.35 : 1.6;
  const effD = Math.max(minD, params.focalLength);

  interface ProjectedTexTri {
    p0: Vec3;
    p1: Vec3;
    p2: Vec3;
    invW0: number;
    invW1: number;
    invW2: number;
    uv0?: [number, number];
    uv1?: [number, number];
    uv2?: [number, number];
    avgZ: number;
    shaded: RGBA;
    wireColor: RGBA;
    textured: boolean;
  }

  const projected: ProjectedTexTri[] = [];
  for (const tri of tris) {
    const t0 = transformVertex3D(tri.v0, params);
    const t1 = transformVertex3D(tri.v1, params);
    const t2 = transformVertex3D(tri.v2, params);

    if (params.projection === 'perspective') {
      if (t0.z <= -effD) anomalyVerticesCount++;
      if (t1.z <= -effD) anomalyVerticesCount++;
      if (t2.z <= -effD) anomalyVerticesCount++;
    }

    const p0 = projectPoint3D(t0, width, height, params);
    const p1 = projectPoint3D(t1, width, height, params);
    const p2 = projectPoint3D(t2, width, height, params);

    const w0Val =
      params.projection === 'parallel'
        ? 1
        : params.allowCopAnomaly
          ? Math.abs(effD + t0.z) < 0.08
            ? 0.08
            : effD + t0.z
          : Math.max(0.35, effD + t0.z);
    const w1Val =
      params.projection === 'parallel'
        ? 1
        : params.allowCopAnomaly
          ? Math.abs(effD + t1.z) < 0.08
            ? 0.08
            : effD + t1.z
          : Math.max(0.35, effD + t1.z);
    const w2Val =
      params.projection === 'parallel'
        ? 1
        : params.allowCopAnomaly
          ? Math.abs(effD + t2.z) < 0.08
            ? 0.08
            : effD + t2.z
          : Math.max(0.35, effD + t2.z);

    projected.push({
      p0,
      p1,
      p2,
      invW0: 1 / w0Val,
      invW1: 1 / w1Val,
      invW2: 1 / w2Val,
      uv0: tri.uv0,
      uv1: tri.uv1,
      uv2: tri.uv2,
      avgZ: (t0.z + t1.z + t2.z) / 3,
      shaded: shadeFlatColor(tri.color, t0, t1, t2),
      wireColor: tri.textured ? hexToRgba('#F59E0B') : tri.color,
      textured: tri.textured,
    });
  }

  if (params.hsrMode === 'painters') {
    projected.sort((a, b) => b.avgZ - a.avgZ);
  }

  if (params.hsrMode === 'wireframe') {
    for (const tri of projected) {
      pixelsShaded += drawBresenhamLine(surface, tri.p0.x, tri.p0.y, tri.p1.x, tri.p1.y, tri.wireColor, 1);
      pixelsShaded += drawBresenhamLine(surface, tri.p1.x, tri.p1.y, tri.p2.x, tri.p2.y, tri.wireColor, 1);
      pixelsShaded += drawBresenhamLine(surface, tri.p2.x, tri.p2.y, tri.p0.x, tri.p0.y, tri.wireColor, 1);
    }
    return {
      triangleCount: tris.length,
      pixelsShaded,
      zBufferRejects: 0,
      projectionMatrix: getProjectionMatrix4x4(params),
      anomalyVerticesCount,
    };
  }

  const useZTest = params.hsrMode === 'zbuffer' || params.hsrMode === 'depth-map';
  const showDepth = params.hsrMode === 'depth-map';
  const texW = alponaTexture.width;
  const texH = alponaTexture.height;
  const texData = alponaTexture.data;

  for (const tri of projected) {
    const { p0, p1, p2, shaded } = tri;
    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

    if (minX > maxX || minY > maxY) continue;

    const area = edgeFn(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
    if (Math.abs(area) < 1e-4) continue;
    const invArea = 1 / area;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const b0 = edgeFn(p1.x, p1.y, p2.x, p2.y, px, py) * invArea;
        const b1 = edgeFn(p2.x, p2.y, p0.x, p0.y, px, py) * invArea;
        const b2 = 1 - b0 - b1;
        if (b0 < 0 || b1 < 0 || b2 < 0) continue;

        const z = b0 * p0.z + b1 * p1.z + b2 * p2.z;
        const bufIdx = y * width + x;

        if (useZTest) {
          if (z < zBuffer[bufIdx]) {
            zBuffer[bufIdx] = z;
          } else {
            zBufferRejects++;
            continue;
          }
        }

        const off = bufIdx * 4;
        if (showDepth) {
          const norm = Math.max(0, Math.min(1, 1 - (z + 1.5) / 3.0));
          const gray = Math.round(norm * 245);
          data[off] = gray;
          data[off + 1] = gray;
          data[off + 2] = Math.min(255, gray + 10);
          data[off + 3] = 255;
        } else if (tri.textured && tri.uv0 && tri.uv1 && tri.uv2) {
          // Perspective-correct texture coordinate interpolation: (u/w) / (1/w)
          const invW = b0 * tri.invW0 + b1 * tri.invW1 + b2 * tri.invW2;
          let u: number;
          let v: number;
          if (Math.abs(invW) > 1e-6) {
            u =
              (b0 * tri.uv0[0] * tri.invW0 +
                b1 * tri.uv1[0] * tri.invW1 +
                b2 * tri.uv2[0] * tri.invW2) /
              invW;
            v =
              (b0 * tri.uv0[1] * tri.invW0 +
                b1 * tri.uv1[1] * tri.invW1 +
                b2 * tri.uv2[1] * tri.invW2) /
              invW;
          } else {
            u = b0 * tri.uv0[0] + b1 * tri.uv1[0] + b2 * tri.uv2[0];
            v = b0 * tri.uv0[1] + b1 * tri.uv1[1] + b2 * tri.uv2[1];
          }
          const tx = Math.max(0, Math.min(texW - 1, Math.floor(u * (texW - 1))));
          const ty = Math.max(0, Math.min(texH - 1, Math.floor(v * (texH - 1))));
          const tOff = (ty * texW + tx) * 4;
          // Gentle depth lighting falloff so the courtyard looks physically grounded
          const shade = Math.max(0.72, Math.min(1.04, 0.96 - z * 0.08));
          data[off] = Math.min(255, Math.round(texData[tOff] * shade));
          data[off + 1] = Math.min(255, Math.round(texData[tOff + 1] * shade));
          data[off + 2] = Math.min(255, Math.round(texData[tOff + 2] * shade));
          data[off + 3] = 255;
        } else {
          data[off] = shaded.r;
          data[off + 1] = shaded.g;
          data[off + 2] = shaded.b;
          data[off + 3] = 255;
        }
        pixelsShaded++;
      }
    }
  }

  return {
    triangleCount: tris.length,
    pixelsShaded,
    zBufferRejects,
    projectionMatrix: getProjectionMatrix4x4(params),
    anomalyVerticesCount,
  };
}

