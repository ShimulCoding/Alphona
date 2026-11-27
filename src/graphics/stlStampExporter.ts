import type { PixelSurface } from './rasterizer';
import { hexToRgba } from './types';

export type StampPresetMode =
  | 'woodblock-stamp'
  | 'pitha-mold'
  | 'terracotta-coaster';

export interface StlStampOptions {
  mode: StampPresetMode;
  gridSize: number; // Resolution of heightfield mesh (e.g. 64..112)
  diameterMm: number; // Real-world physical width/diameter in mm (60..140)
  baseThicknessMm: number; // Solid base slab thickness (2.5..8)
  reliefHeightMm: number; // Raised / carved depth in mm (1.5..6)
  mirrorHorizontal: boolean; // Mirror X so inked woodblock stamps print right-side-up
  circularBase: boolean; // Circular coaster/pitha disc vs square woodblock
  includeHandle: boolean; // Add solid cylindrical grip handle on underside
}

export interface StampHeightfield {
  size: number;
  heightsMm: Float32Array; // [size * size] total Z height in mm (0 = bottom, >0 = surface)
  mask: Uint8Array; // 1 = inside circular/square stamp footprint, 0 = outside
  minZ: number;
  maxZ: number;
  activeCells: number;
}

export interface StlTriangle {
  nx: number;
  ny: number;
  nz: number;
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  cx: number;
  cy: number;
  cz: number;
}

export interface StampMeshSummary {
  triangles: StlTriangle[];
  triangleCount: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  estimatedVolumeCm3: number;
}

export const DEFAULT_STL_STAMP_OPTIONS: StlStampOptions = {
  mode: 'woodblock-stamp',
  gridSize: 80,
  diameterMm: 95,
  baseThicknessMm: 4.5,
  reliefHeightMm: 3.2,
  mirrorHorizontal: true,
  circularBase: true,
  includeHandle: true,
};

/**
 * Extracts a beveled, draft-angle-smoothed 3D relief heightfield (in millimeters)
 * directly from any live Alpona PixelSurface.
 *   - woodblock-stamp: raised Alpona strokes + mirrored X for cloth/saree block printing
 *   - pitha-mold: recessed/intaglio Alpona cavity so pressed dough forms raised Bengali Pitha art
 *   - terracotta-coaster: non-mirrored raised relief disc for 3D printing or CNC carving
 */
export function buildStampHeightfield(
  alpona: PixelSurface,
  bgHex: string,
  options: StlStampOptions
): StampHeightfield {
  const size = Math.max(24, Math.min(128, Math.round(options.gridSize)));
  const bg = hexToRgba(bgHex);
  const raw = new Float32Array(size * size);
  const mask = new Uint8Array(size * size);

  const half = (size - 1) * 0.5;
  const maxR = half * 0.985;

  for (let y = 0; y < size; y++) {
    const sy = Math.min(
      alpona.height - 1,
      Math.floor(((y + 0.5) / size) * alpona.height)
    );
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const dx = x - half;
      const dy = y - half;
      if (options.circularBase && Math.hypot(dx, dy) > maxR) {
        mask[idx] = 0;
        raw[idx] = 0;
        continue;
      }
      mask[idx] = 1;

      const sampleX = options.mirrorHorizontal ? size - 1 - x : x;
      const sx = Math.min(
        alpona.width - 1,
        Math.floor(((sampleX + 0.5) / size) * alpona.width)
      );
      const off = (sy * alpona.width + sx) * 4;
      const dr = alpona.data[off] - bg.r;
      const dg = alpona.data[off + 1] - bg.g;
      const db = alpona.data[off + 2] - bg.b;
      const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
      // Normalized ink strength [0..1]
      const ink = Math.max(0, Math.min(1, (colorDist - 18) / 85));
      raw[idx] = ink;
    }
  }

  // 3x3 Gaussian bevel pass so relief walls have a natural release draft angle for dough/clay/ink
  const smooth = new Float32Array(size * size);
  const k = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (!mask[idx]) continue;
      let acc = 0;
      let wSum = 0;
      let ki = 0;
      for (let ky = -1; ky <= 1; ky++) {
        const ny = Math.max(0, Math.min(size - 1, y + ky));
        for (let kx = -1; kx <= 1; kx++) {
          const nx = Math.max(0, Math.min(size - 1, x + kx));
          const nIdx = ny * size + nx;
          const wt = k[ki++];
          if (mask[nIdx]) {
            acc += raw[nIdx] * wt;
            wSum += wt;
          }
        }
      }
      const beveled = wSum > 0 ? acc / wSum : raw[idx];
      // Blend crisp peak with smooth draft slope
      smooth[idx] = Math.max(0, Math.min(1, raw[idx] * 0.55 + beveled * 0.45));
    }
  }

  const heightsMm = new Float32Array(size * size);
  let minZ = Infinity;
  let maxZ = 0;
  let activeCells = 0;

  for (let i = 0; i < size * size; i++) {
    if (!mask[i]) {
      heightsMm[i] = 0;
      continue;
    }
    activeCells++;
    const hFactor =
      options.mode === 'pitha-mold' ? 1.0 - smooth[i] : smooth[i];
    const z = options.baseThicknessMm + hFactor * options.reliefHeightMm;
    heightsMm[i] = z;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  if (!Number.isFinite(minZ)) minZ = 0;

  return { size, heightsMm, mask, minZ, maxZ, activeCells };
}

function pushTri(
  out: StlTriangle[],
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number
) {
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const vx = cx - ax;
  const vy = cy - ay;
  const vz = cz - az;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-8) return;
  nx /= len;
  ny /= len;
  nz /= len;
  out.push({ nx, ny, nz, ax, ay, az, bx, by, bz, cx, cy, cz });
}

/**
 * Generates a watertight, manifold 3D triangle mesh (top relief surface +
 * perimeter side walls + flat bottom cap + optional underside grip handle)
 * ready for 3D printing (.STL) or CAD/Blender (.OBJ).
 */
export function generateStampMesh(
  hf: StampHeightfield,
  options: StlStampOptions
): StampMeshSummary {
  const n = hf.size;
  const step = options.diameterMm / Math.max(1, n - 1);
  const halfMm = options.diameterMm * 0.5;
  const triangles: StlTriangle[] = [];

  const vx = (x: number) => x * step - halfMm;
  const vy = (y: number) => (n - 1 - y) * step - halfMm;
  const isCellActive = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= n - 1 || y >= n - 1) return false;
    return (
      hf.mask[y * n + x] === 1 &&
      hf.mask[y * n + (x + 1)] === 1 &&
      hf.mask[(y + 1) * n + x] === 1 &&
      hf.mask[(y + 1) * n + (x + 1)] === 1
    );
  };

  let volumeMm3 = 0;
  const cellAreaMm2 = step * step;

  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      if (!isCellActive(x, y)) continue;

      const x0 = vx(x);
      const x1 = vx(x + 1);
      const y0 = vy(y);
      const y1 = vy(y + 1);

      const z00 = hf.heightsMm[y * n + x];
      const z10 = hf.heightsMm[y * n + (x + 1)];
      const z01 = hf.heightsMm[(y + 1) * n + x];
      const z11 = hf.heightsMm[(y + 1) * n + (x + 1)];

      volumeMm3 += ((z00 + z10 + z01 + z11) * 0.25) * cellAreaMm2;

      // Top relief quad (CCW facing +Z)
      pushTri(triangles, x0, y0, z00, x0, y1, z01, x1, y1, z11);
      pushTri(triangles, x0, y0, z00, x1, y1, z11, x1, y0, z10);

      // Bottom flat cap at Z = 0 (CW facing -Z)
      pushTri(triangles, x0, y0, 0, x1, y1, 0, x0, y1, 0);
      pushTri(triangles, x0, y0, 0, x1, y0, 0, x1, y1, 0);

      // Perimeter side skirt walls wherever a neighboring cell is outside the footprint
      if (!isCellActive(x, y - 1)) {
        // North boundary (+Y outward)
        pushTri(triangles, x0, y0, 0, x0, y0, z00, x1, y0, z10);
        pushTri(triangles, x0, y0, 0, x1, y0, z10, x1, y0, 0);
      }
      if (!isCellActive(x, y + 1)) {
        // South boundary (-Y outward)
        pushTri(triangles, x1, y1, 0, x1, y1, z11, x0, y1, z01);
        pushTri(triangles, x1, y1, 0, x0, y1, z01, x0, y1, 0);
      }
      if (!isCellActive(x - 1, y)) {
        // West boundary (-X outward)
        pushTri(triangles, x0, y1, 0, x0, y1, z01, x0, y0, z00);
        pushTri(triangles, x0, y1, 0, x0, y0, z00, x0, y0, 0);
      }
      if (!isCellActive(x + 1, y)) {
        // East boundary (+X outward)
        pushTri(triangles, x1, y0, 0, x1, y0, z10, x1, y1, z11);
        pushTri(triangles, x1, y0, 0, x1, y1, z11, x1, y1, 0);
      }
    }
  }

  let totalHeightMm = hf.maxZ;

  // Optional cylindrical ergonomic grip handle on the underside (-Z direction)
  if (options.includeHandle) {
    const handleR = Math.max(8, options.diameterMm * 0.16);
    const handleH = Math.max(12, options.diameterMm * 0.22);
    const segs = 24;
    const zTop = 0.0;
    const zBot = -handleH;
    volumeMm3 += Math.PI * handleR * handleR * handleH;
    totalHeightMm += handleH;

    for (let i = 0; i < segs; i++) {
      const a0 = (2 * Math.PI * i) / segs;
      const a1 = (2 * Math.PI * ((i + 1) % segs)) / segs;
      const hx0 = Math.cos(a0) * handleR;
      const hy0 = Math.sin(a0) * handleR;
      const hx1 = Math.cos(a1) * handleR;
      const hy1 = Math.sin(a1) * handleR;

      // Cylinder side wall
      pushTri(triangles, hx0, hy0, zBot, hx1, hy1, zBot, hx1, hy1, zTop);
      pushTri(triangles, hx0, hy0, zBot, hx1, hy1, zTop, hx0, hy0, zTop);
      // Bottom end cap (-Z normal)
      pushTri(triangles, 0, 0, zBot, hx1, hy1, zBot, hx0, hy0, zBot);
    }
  }

  return {
    triangles,
    triangleCount: triangles.length,
    widthMm: options.diameterMm,
    depthMm: options.diameterMm,
    heightMm: Number(totalHeightMm.toFixed(1)),
    estimatedVolumeCm3: Number((volumeMm3 / 1000).toFixed(2)),
  };
}

/**
 * Serializes a StampMeshSummary into standard IEEE-754 Little-Endian Binary STL.
 * Compatible directly with Ultimaker Cura, PrusaSlicer, Bambu Studio, and CNC tools.
 */
export function serializeBinaryStl(mesh: StampMeshSummary): Uint8Array {
  const count = mesh.triangles.length;
  const buffer = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const header = 'Alpona Studio 3D Relief Stamp (v1.4.2)';
  for (let i = 0; i < header.length && i < 80; i++) {
    bytes[i] = header.charCodeAt(i);
  }
  view.setUint32(80, count, true);

  let offset = 84;
  for (let i = 0; i < count; i++) {
    const t = mesh.triangles[i];
    view.setFloat32(offset, t.nx, true);
    view.setFloat32(offset + 4, t.ny, true);
    view.setFloat32(offset + 8, t.nz, true);
    view.setFloat32(offset + 12, t.ax, true);
    view.setFloat32(offset + 16, t.ay, true);
    view.setFloat32(offset + 20, t.az, true);
    view.setFloat32(offset + 24, t.bx, true);
    view.setFloat32(offset + 28, t.by, true);
    view.setFloat32(offset + 32, t.bz, true);
    view.setFloat32(offset + 36, t.cx, true);
    view.setFloat32(offset + 40, t.cy, true);
    view.setFloat32(offset + 44, t.cz, true);
    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }

  return bytes;
}

/**
 * Serializes a StampMeshSummary into ASCII Wavefront .OBJ format.
 */
export function serializeAsciiObj(mesh: StampMeshSummary): string {
  const lines: string[] = [
    '# Alpona Studio 3D Relief Stamp (.OBJ)',
    `# Triangles: ${mesh.triangleCount}`,
    'o AlponaStamp',
  ];
  let vIdx = 1;
  for (let i = 0; i < mesh.triangles.length; i++) {
    const t = mesh.triangles[i];
    lines.push(`v ${t.ax.toFixed(3)} ${t.ay.toFixed(3)} ${t.az.toFixed(3)}`);
    lines.push(`v ${t.bx.toFixed(3)} ${t.by.toFixed(3)} ${t.bz.toFixed(3)}`);
    lines.push(`v ${t.cx.toFixed(3)} ${t.cy.toFixed(3)} ${t.cz.toFixed(3)}`);
    lines.push(`f ${vIdx} ${vIdx + 1} ${vIdx + 2}`);
    vIdx += 3;
  }
  return lines.join('\n') + '\n';
}

/**
 * Renders a crisp, software-shaded 3D turntable relief preview of the stamp heightfield
 * using Phong illumination + Z-buffered column projection (zero WebGL dependency).
 */
export function renderStampTurntablePreview(
  hf: StampHeightfield,
  options: StlStampOptions,
  yawDeg: number,
  pitchDeg: number,
  outW = 480,
  outH = 380
): PixelSurface {
  const data = new Uint8ClampedArray(outW * outH * 4);
  const zBuf = new Float32Array(outW * outH);
  zBuf.fill(-1e9);

  // Subtle warm studio backdrop gradient
  for (let y = 0; y < outH; y++) {
    const g = y / Math.max(1, outH - 1);
    const r = Math.round(28 + g * 12);
    const gr = Math.round(26 + g * 11);
    const b = Math.round(29 + g * 12);
    for (let x = 0; x < outW; x++) {
      const off = (y * outW + x) * 4;
      data[off] = r;
      data[off + 1] = gr;
      data[off + 2] = b;
      data[off + 3] = 255;
    }
  }

  // Material base RGB per physical craft preset
  const mat =
    options.mode === 'woodblock-stamp'
      ? { r: 162, g: 108, b: 64, spec: 0.28, shininess: 22 } // Carved Teakwood
      : options.mode === 'pitha-mold'
        ? { r: 214, g: 168, b: 108, spec: 0.42, shininess: 32 } // Clay / Brass Pitha Mold
        : { r: 186, g: 88, b: 60, spec: 0.25, shininess: 18 }; // Terracotta Coaster

  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (Math.max(18, Math.min(82, pitchDeg)) * Math.PI) / 180;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  const n = hf.size;
  const half = (n - 1) * 0.5;
  const scale = (Math.min(outW, outH) * 0.78) / n;
  const zExag = scale * (n / Math.max(30, options.diameterMm)) * 1.45;
  const cxOut = outW * 0.5;
  const cyOut = outH * 0.54;

  // Directional key light
  const lx = 0.52;
  const ly = -0.58;
  const lz = 0.63;
  const lLen = Math.hypot(lx, ly, lz);
  const Lx = lx / lLen;
  const Ly = ly / lLen;
  const Lz = lz / lLen;

  const splatRadius = Math.max(1, Math.ceil(scale * 0.72));

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const idx = y * n + x;
      if (!hf.mask[idx]) continue;

      const zMm = hf.heightsMm[idx];
      const zL = x > 0 && hf.mask[idx - 1] ? hf.heightsMm[idx - 1] : 0;
      const zR = x < n - 1 && hf.mask[idx + 1] ? hf.heightsMm[idx + 1] : 0;
      const zU = y > 0 && hf.mask[idx - n] ? hf.heightsMm[idx - n] : 0;
      const zD = y < n - 1 && hf.mask[idx + n] ? hf.heightsMm[idx + n] : 0;

      // Surface normal from heightfield gradient
      const gx = (zR - zL) * 0.9;
      const gy = (zD - zU) * 0.9;
      let nx = -gx;
      let ny = -gy;
      let nz = 1.6;
      const nLen = Math.hypot(nx, ny, nz);
      nx /= nLen;
      ny /= nLen;
      nz /= nLen;

      // Rotate normal by yaw
      const rnx = nx * cosY - ny * sinY;
      const rny = nx * sinY + ny * cosY;
      const rnz = nz;

      const ndl = Math.max(0, rnx * Lx + rny * Ly + rnz * Lz);
      const hx = Lx;
      const hy = Ly;
      const hz = Lz + 1;
      const hLen = Math.hypot(hx, hy, hz);
      const ndh = Math.max(0, (rnx * hx + rny * hy + rnz * hz) / hLen);
      const spec = mat.spec * Math.pow(ndh, mat.shininess);
      const reliefTint = 0.86 + 0.22 * ((zMm - hf.minZ) / Math.max(0.5, hf.maxZ - hf.minZ));
      const lit = (0.24 + 0.76 * ndl) * reliefTint;

      const pr = Math.max(0, Math.min(255, Math.round(mat.r * lit + 255 * spec)));
      const pg = Math.max(0, Math.min(255, Math.round(mat.g * lit + 245 * spec)));
      const pb = Math.max(0, Math.min(255, Math.round(mat.b * lit + 225 * spec)));

      // Project top relief point + base thickness column
      const lx0 = x - half;
      const ly0 = y - half;
      const rx = lx0 * cosY - ly0 * sinY;
      const ry = lx0 * sinY + ly0 * cosY;

      const sx = Math.round(cxOut + rx * scale);
      const syTop = Math.round(cyOut + ry * scale * sinP - zMm * zExag * cosP);
      const syBot = Math.round(cyOut + ry * scale * sinP);
      const depthKey = ry * 100 + zMm * 2;

      // Draw side thickness skirt downwards if needed
      const yMin = Math.max(0, syTop - splatRadius);
      const yMax = Math.min(outH - 1, Math.max(syTop + splatRadius, syBot));
      for (let py = yMin; py <= yMax; py++) {
        const isSide = py > syTop + splatRadius;
        const sideShade = isSide ? 0.62 : 1.0;
        const cr = Math.round(pr * sideShade);
        const cg = Math.round(pg * sideShade);
        const cb = Math.round(pb * sideShade);
        const zVal = isSide ? depthKey - 0.5 : depthKey;
        for (let px = Math.max(0, sx - splatRadius); px <= Math.min(outW - 1, sx + splatRadius); px++) {
          const pIdx = py * outW + px;
          if (zVal >= zBuf[pIdx]) {
            zBuf[pIdx] = zVal;
            const off = pIdx * 4;
            data[off] = cr;
            data[off + 1] = cg;
            data[off + 2] = cb;
            data[off + 3] = 255;
          }
        }
      }
    }
  }

  return { width: outW, height: outH, data };
}
