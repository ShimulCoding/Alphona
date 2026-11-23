import type { PixelSurface } from './rasterizer';
import { hexToRgba } from './types';

export type DiyaShadingModel = 'phong' | 'gouraud' | 'normal-map';

export interface DiyaLight {
  id: string;
  /** Normalized courtyard X coordinate in [0.05, 0.95] */
  x: number;
  /** Normalized courtyard Y coordinate in [0.05, 0.95] */
  y: number;
  /** Height above floor plane in normalized units (e.g. 0.14) */
  z: number;
  /** Flame RGB color (warm earthen oil lamp glow) */
  color: [number, number, number];
  intensity: number;
}

export interface PhongLightingParams {
  ka: number; // Ambient reflection coefficient (0.05..0.6)
  kd: number; // Diffuse reflection coefficient (0.2..1.5)
  ks: number; // Specular reflection coefficient (0.0..1.2)
  shininess: number; // Phong specular exponent n (4..64)
  reliefStrength: number; // Chalk/rice-paste bump relief height (0.5..4.0)
  shadingModel: DiyaShadingModel;
}

export const DEFAULT_PHONG_PARAMS: PhongLightingParams = {
  ka: 0.22,
  kd: 0.95,
  ks: 0.42,
  shininess: 22,
  reliefStrength: 2.2,
  shadingModel: 'phong',
};

export const DIYA_LIGHT_PRESETS: Record<
  'four-corners' | 'festival-ring' | 'dramatic-rim',
  { label: string; lights: DiyaLight[] }
> = {
  'four-corners': {
    label: '4-Corner Puja',
    lights: [
      { id: 'd1', x: 0.13, y: 0.13, z: 0.16, color: [1.0, 0.72, 0.34], intensity: 1.15 },
      { id: 'd2', x: 0.87, y: 0.13, z: 0.16, color: [1.0, 0.72, 0.34], intensity: 1.15 },
      { id: 'd3', x: 0.87, y: 0.87, z: 0.16, color: [1.0, 0.68, 0.3], intensity: 1.15 },
      { id: 'd4', x: 0.13, y: 0.87, z: 0.16, color: [1.0, 0.68, 0.3], intensity: 1.15 },
    ],
  },
  'festival-ring': {
    label: 'Ring of 6 Diyas',
    lights: Array.from({ length: 6 }, (_, i) => {
      const ang = (Math.PI * 2 * i) / 6 - Math.PI / 6;
      return {
        id: `ring-${i}`,
        x: Number((0.5 + 0.42 * Math.cos(ang)).toFixed(3)),
        y: Number((0.5 + 0.42 * Math.sin(ang)).toFixed(3)),
        z: 0.15,
        color: [1.0, 0.73, 0.36] as [number, number, number],
        intensity: 0.95,
      };
    }),
  },
  'dramatic-rim': {
    label: 'Evening Spotlight',
    lights: [
      { id: 'rim-1', x: 0.18, y: 0.22, z: 0.19, color: [1.0, 0.76, 0.4], intensity: 1.65 },
      { id: 'rim-2', x: 0.82, y: 0.78, z: 0.12, color: [1.0, 0.54, 0.24], intensity: 0.85 },
    ],
  },
};

/**
 * Computes a stroke relief heightfield h(x,y) from pixel contrast against
 * the courtyard surface background (raised chalk/rice-paste relief).
 */
export function buildStrokeHeightfield(
  surface: PixelSurface,
  backgroundHex: string
): Float32Array {
  const { width, height, data } = surface;
  const bg = hexToRgba(backgroundHex);
  const h = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const off = i * 4;
    const dr = Math.abs(data[off] - bg.r);
    const dg = Math.abs(data[off + 1] - bg.g);
    const db = Math.abs(data[off + 2] - bg.b);
    const contrast = (dr + dg + db) / 765;
    h[i] = Math.min(1, contrast * 1.45);
  }
  return h;
}

/**
 * Estimates unit surface normal N = normalize(-gx * strength, -gy * strength, 1)
 * using 3x3 Sobel partial derivatives of the rice-paste stroke heightfield.
 */
export function computeReliefNormal(
  heightfield: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  reliefStrength: number
): [number, number, number] {
  const xm = Math.max(0, x - 1);
  const xp = Math.min(width - 1, x + 1);
  const ym = Math.max(0, y - 1);
  const yp = Math.min(height - 1, y + 1);

  const tl = heightfield[ym * width + xm];
  const tc = heightfield[ym * width + x];
  const tr = heightfield[ym * width + xp];
  const ml = heightfield[y * width + xm];
  const mr = heightfield[y * width + xp];
  const bl = heightfield[yp * width + xm];
  const bc = heightfield[yp * width + x];
  const br = heightfield[yp * width + xp];

  const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
  const gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);

  const nx = -gx * reliefStrength;
  const ny = -gy * reliefStrength;
  const nz = 1.0;
  const invLen = 1 / Math.hypot(nx, ny, nz);
  return [nx * invLen, ny * invLen, nz * invLen];
}

function evaluatePhongAtPoint(
  u: number,
  v: number,
  nx: number,
  ny: number,
  nz: number,
  albedoR: number,
  albedoG: number,
  albedoB: number,
  lights: DiyaLight[],
  params: PhongLightingParams
): [number, number, number] {
  // Viewer sits overhead at (0.5, 0.5, 1.45) looking down at courtyard
  let vx = 0.5 - u;
  let vy = 0.5 - v;
  let vz = 1.45;
  const vLen = Math.hypot(vx, vy, vz);
  vx /= vLen;
  vy /= vLen;
  vz /= vLen;

  // Cool twilight ambient tint on night courtyard
  let rOut = params.ka * albedoR * 0.78;
  let gOut = params.ka * albedoG * 0.82;
  let bOut = params.ka * albedoB * 0.96;

  for (let i = 0; i < lights.length; i++) {
    const light = lights[i];
    const lxRaw = light.x - u;
    const lyRaw = light.y - v;
    const lzRaw = light.z;
    const distSq = lxRaw * lxRaw + lyRaw * lyRaw + lzRaw * lzRaw;
    const dist = Math.sqrt(distSq);
    const lx = lxRaw / dist;
    const ly = lyRaw / dist;
    const lz = lzRaw / dist;

    // Distance attenuation tuned for warm courtyard diya reach
    const atten = light.intensity / (0.35 + 4.8 * distSq);
    const nDotL = Math.max(0, nx * lx + ny * ly + nz * lz);

    // Blinn-Phong / Phong reflection vector R = 2(N.L)N - L
    let spec = 0;
    if (nDotL > 0 && params.ks > 0) {
      const rx = 2 * nDotL * nx - lx;
      const ry = 2 * nDotL * ny - ly;
      const rz = 2 * nDotL * nz - lz;
      const rDotV = Math.max(0, rx * vx + ry * vy + rz * vz);
      spec = params.ks * Math.pow(rDotV, params.shininess);
    }

    const diff = params.kd * nDotL;
    rOut += atten * light.color[0] * (diff * albedoR + spec * 255);
    gOut += atten * light.color[1] * (diff * albedoG + spec * 255);
    bOut += atten * light.color[2] * (diff * albedoB + spec * 255);
  }

  return [
    Math.max(0, Math.min(255, Math.round(rOut))),
    Math.max(0, Math.min(255, Math.round(gOut))),
    Math.max(0, Math.min(255, Math.round(bOut))),
  ];
}

/**
 * Renders the live Alpona under interactive CSE 401 Phong / Gouraud Night-Courtyard
 * Diya illumination (or Sobel Relief Normal Map visualization).
 */
export function renderPhongDiyaLitAlpona(
  alponaSurface: PixelSurface,
  backgroundHex: string,
  lights: DiyaLight[],
  params: PhongLightingParams
): { surface: PixelSurface; avgLuminance: number } {
  const { width, height, data } = alponaSurface;
  const out = new Uint8ClampedArray(width * height * 4);
  const heightfield = buildStrokeHeightfield(alponaSurface, backgroundHex);

  let lumSum = 0;

  if (params.shadingModel === 'normal-map') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [nx, ny, nz] = computeReliefNormal(
          heightfield,
          width,
          height,
          x,
          y,
          params.reliefStrength
        );
        const off = (y * width + x) * 4;
        const r = Math.round((nx * 0.5 + 0.5) * 255);
        const g = Math.round((ny * 0.5 + 0.5) * 255);
        const b = Math.round((nz * 0.5 + 0.5) * 255);
        out[off] = r;
        out[off + 1] = g;
        out[off + 2] = b;
        out[off + 3] = 255;
        lumSum += 0.299 * r + 0.587 * g + 0.114 * b;
      }
    }
    return {
      surface: { width, height, data: out },
      avgLuminance: Math.round(lumSum / Math.max(1, width * height)),
    };
  }

  if (params.shadingModel === 'gouraud') {
    // True Gouraud shading: evaluate lighting ONLY at coarse mesh vertices (gridStep = 12 px)
    // and bilinearly interpolate illumination across each quad so users see the CSE 401 contrast
    // vs. per-pixel Phong shading!
    const step = Math.max(8, Math.round(width / 36));
    const gw = Math.ceil(width / step) + 1;
    const gh = Math.ceil(height / step) + 1;
    const gridR = new Float32Array(gw * gh);
    const gridG = new Float32Array(gw * gh);
    const gridB = new Float32Array(gw * gh);

    for (let gy = 0; gy < gh; gy++) {
      const py = Math.min(height - 1, gy * step);
      const v = py / Math.max(1, height - 1);
      for (let gx = 0; gx < gw; gx++) {
        const px = Math.min(width - 1, gx * step);
        const u = px / Math.max(1, width - 1);
        const [nx, ny, nz] = computeReliefNormal(
          heightfield,
          width,
          height,
          px,
          py,
          params.reliefStrength
        );
        const [lr, lg, lb] = evaluatePhongAtPoint(
          u,
          v,
          nx,
          ny,
          nz,
          255,
          255,
          255,
          lights,
          params
        );
        const gIdx = gy * gw + gx;
        gridR[gIdx] = lr / 255;
        gridG[gIdx] = lg / 255;
        gridB[gIdx] = lb / 255;
      }
    }

    for (let y = 0; y < height; y++) {
      const gy0 = Math.floor(y / step);
      const gy1 = Math.min(gh - 1, gy0 + 1);
      const ty = (y - gy0 * step) / step;
      for (let x = 0; x < width; x++) {
        const gx0 = Math.floor(x / step);
        const gx1 = Math.min(gw - 1, gx0 + 1);
        const tx = (x - gx0 * step) / step;

        const i00 = gy0 * gw + gx0;
        const i10 = gy0 * gw + gx1;
        const i01 = gy1 * gw + gx0;
        const i11 = gy1 * gw + gx1;

        const w00 = (1 - tx) * (1 - ty);
        const w10 = tx * (1 - ty);
        const w01 = (1 - tx) * ty;
        const w11 = tx * ty;

        const ir = gridR[i00] * w00 + gridR[i10] * w10 + gridR[i01] * w01 + gridR[i11] * w11;
        const ig = gridG[i00] * w00 + gridG[i10] * w10 + gridG[i01] * w01 + gridG[i11] * w11;
        const ib = gridB[i00] * w00 + gridB[i10] * w10 + gridB[i01] * w01 + gridB[i11] * w11;

        const off = (y * width + x) * 4;
        const r = Math.max(0, Math.min(255, Math.round(data[off] * ir)));
        const g = Math.max(0, Math.min(255, Math.round(data[off + 1] * ig)));
        const b = Math.max(0, Math.min(255, Math.round(data[off + 2] * ib)));
        out[off] = r;
        out[off + 1] = g;
        out[off + 2] = b;
        out[off + 3] = 255;
        lumSum += 0.299 * r + 0.587 * g + 0.114 * b;
      }
    }
  } else {
    // True Per-Pixel Phong Shading with Sobel relief normals
    const invW = 1 / Math.max(1, width - 1);
    const invH = 1 / Math.max(1, height - 1);
    for (let y = 0; y < height; y++) {
      const v = y * invH;
      for (let x = 0; x < width; x++) {
        const u = x * invW;
        const [nx, ny, nz] = computeReliefNormal(
          heightfield,
          width,
          height,
          x,
          y,
          params.reliefStrength
        );
        const off = (y * width + x) * 4;
        const [r, g, b] = evaluatePhongAtPoint(
          u,
          v,
          nx,
          ny,
          nz,
          data[off],
          data[off + 1],
          data[off + 2],
          lights,
          params
        );
        out[off] = r;
        out[off + 1] = g;
        out[off + 2] = b;
        out[off + 3] = 255;
        lumSum += 0.299 * r + 0.587 * g + 0.114 * b;
      }
    }
  }

  // Paint soft glowing earthen diya bowls + warm flame halos directly into the raster buffer
  for (const light of lights) {
    const lx = light.x * width;
    const ly = light.y * height;
    const haloR = Math.max(18, width * 0.055);
    const bowlR = Math.max(6, width * 0.017);
    const flameR = Math.max(3, width * 0.0085);

    const minX = Math.max(0, Math.floor(lx - haloR));
    const maxX = Math.min(width - 1, Math.ceil(lx + haloR));
    const minY = Math.max(0, Math.floor(ly - haloR));
    const maxY = Math.min(height - 1, Math.ceil(ly + haloR));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x - lx, y - ly);
        if (dist > haloR) continue;
        const off = (y * width + x) * 4;

        if (dist < flameR) {
          // Bright golden-white wick core
          out[off] = 255;
          out[off + 1] = 248;
          out[off + 2] = 205;
        } else if (dist < bowlR) {
          // Terracotta earthen diya rim
          const rim = (dist - flameR) / Math.max(1, bowlR - flameR);
          out[off] = Math.round(235 * (1 - rim) + 148 * rim);
          out[off + 1] = Math.round(145 * (1 - rim) + 64 * rim);
          out[off + 2] = Math.round(48 * (1 - rim) + 36 * rim);
        } else {
          // Additive warm radial diya flame bloom
          const falloff = Math.pow(1 - (dist - bowlR) / Math.max(1, haloR - bowlR), 2.1);
          const glow = falloff * 0.62 * Math.min(1.4, light.intensity);
          out[off] = Math.min(255, Math.round(out[off] + 255 * light.color[0] * glow));
          out[off + 1] = Math.min(255, Math.round(out[off + 1] + 215 * light.color[1] * glow));
          out[off + 2] = Math.min(255, Math.round(out[off + 2] + 120 * light.color[2] * glow));
        }
      }
    }
  }

  return {
    surface: { width, height, data: out },
    avgLuminance: Math.round(lumSum / Math.max(1, width * height)),
  };
}
