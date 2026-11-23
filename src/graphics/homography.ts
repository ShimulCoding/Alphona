import type { PixelSurface } from './rasterizer';
import type { Point2D } from './types';

export type FloorBlendMode = 'chalk-screen' | 'ink-multiply' | 'opaque';

export interface HomographyQuad {
  tl: Point2D; // maps (0, 0)
  tr: Point2D; // maps (1, 0)
  br: Point2D; // maps (1, 1)
  bl: Point2D; // maps (0, 1)
}

export interface HomographyResult {
  matrix: number[]; // 3x3 row-major H mapping unit square -> destination floor quad
  inverse: number[]; // 3x3 row-major H^-1 mapping floor pixel -> unit square (u, v)
  valid: boolean;
}

/**
 * Solves an 8x8 linear system Ax = b via Gaussian elimination with partial pivoting.
 */
function solveLinearSystem8(A: number[][], b: number[]): number[] | null {
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > maxAbs) {
        maxAbs = v;
        pivotRow = r;
      }
    }
    if (maxAbs < 1e-10) return null;
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    const pivot = M[col][col];
    for (let j = col; j <= n; j++) {
      M[col][j] /= pivot;
    }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j <= n; j++) {
        M[r][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Analytically inverts a 3x3 row-major matrix.
 */
export function invertMat3x3(m: number[]): number[] | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-10) return null;
  const invDet = 1 / det;
  return [
    A * invDet,
    D * invDet,
    G * invDet,
    B * invDet,
    E * invDet,
    H * invDet,
    C * invDet,
    F * invDet,
    I * invDet,
  ];
}

/**
 * Computes exact 3x3 Projective Homography H mapping unit square
 * (0,0)->tl, (1,0)->tr, (1,1)->br, (0,1)->bl via Direct Linear Transform (8x8 solve).
 */
export function solveHomographyFromUnitSquare(
  quad: HomographyQuad
): HomographyResult {
  const src: Point2D[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const dst: Point2D[] = [quad.tl, quad.tr, quad.br, quad.bl];

  const A: number[][] = [];
  const b: number[] = [];

  for (let k = 0; k < 4; k++) {
    const u = src[k].x;
    const v = src[k].y;
    const x = dst[k].x;
    const y = dst[k].y;
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  const sol = solveLinearSystem8(A, b);
  if (!sol) {
    return {
      matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      inverse: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      valid: false,
    };
  }

  const H = [sol[0], sol[1], sol[2], sol[3], sol[4], sol[5], sol[6], sol[7], 1];
  const inv = invertMat3x3(H);
  if (!inv) {
    return {
      matrix: H,
      inverse: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      valid: false,
    };
  }

  return { matrix: H, inverse: inv, valid: true };
}

export function applyHomography(H: number[], x: number, y: number): Point2D {
  const w = H[6] * x + H[7] * y + H[8];
  const safeW = Math.abs(w) < 1e-8 ? 1e-8 : w;
  return {
    x: (H[0] * x + H[1] * y + H[2]) / safeW,
    y: (H[3] * x + H[4] * y + H[5]) / safeW,
  };
}

/**
 * Generates a realistic, deterministic Bengali red-brick & limestone courtyard floor photo
 * purely in software (no external images needed) so users can test Virtual Try-On immediately.
 */
export function generateCourtyardFloorPhoto(
  width: number,
  height: number
): PixelSurface {
  const data = new Uint8ClampedArray(width * height * 4);
  const horizonY = height * 0.22;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      if (y < horizonY) {
        // Warm sunlit veranda wall & shadow ledge at top
        const t = y / Math.max(1, horizonY);
        const wallR = Math.round(214 - t * 34);
        const wallG = Math.round(196 - t * 38);
        const wallB = Math.round(174 - t * 38);
        const trim = y > horizonY - 8 ? -28 : 0;
        data[idx] = Math.max(0, Math.min(255, wallR + trim));
        data[idx + 1] = Math.max(0, Math.min(255, wallG + trim));
        data[idx + 2] = Math.max(0, Math.min(255, wallB + trim));
        data[idx + 3] = 255;
        continue;
      }

      // Perspective courtyard terracotta tile plane
      const depth = (y - horizonY) / Math.max(1, height - horizonY); // 0 far .. 1 near
      const invZ = 1 / (0.18 + depth * 1.15);
      const worldX = ((x - width * 0.5) / width) * invZ * 4.2;
      const worldZ = invZ * 3.0;

      const tileU = worldX - Math.floor(worldX);
      const tileV = worldZ - Math.floor(worldZ);
      const mortar = tileU < 0.045 || tileU > 0.955 || tileV < 0.045 || tileV > 0.955;

      // Subtle deterministic per-tile warm terracotta variation + micro grain
      const tileHash =
        Math.sin(Math.floor(worldX) * 12.9898 + Math.floor(worldZ) * 78.233) *
        43758.5453;
      const tileVar = (tileHash - Math.floor(tileHash) - 0.5) * 18;
      const grain =
        (Math.sin(x * 0.37 + y * 0.71) * Math.cos(x * 0.19 - y * 0.53)) * 5;

      // Natural warm sun falloff across floor
      const light = 0.78 + 0.26 * (1 - Math.abs(x / width - 0.45)) * (0.65 + 0.35 * depth);

      let r: number;
      let g: number;
      let b: number;
      if (mortar) {
        r = 66 * light + grain;
        g = 54 * light + grain;
        b = 48 * light + grain;
      } else {
        r = (118 + tileVar) * light + grain;
        g = (72 + tileVar * 0.6) * light + grain;
        b = (58 + tileVar * 0.4) * light + grain;
      }

      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  return { width, height, data };
}

/**
 * Inverse-perspective warps the user's live Alpona texture onto a real floor photo
 * using the solved 3x3 inverse homography H^-1, bilinear texture interpolation,
 * and surface-aware chalk/ink blending.
 */
export function renderVirtualFloorTryOn(
  floorPhoto: PixelSurface,
  alponaTexture: PixelSurface,
  quad: HomographyQuad,
  blendMode: FloorBlendMode = 'chalk-screen',
  opacity = 0.92,
  bgHexRgb: { r: number; g: number; b: number } = { r: 22, g: 22, b: 27 }
): { surface: PixelSurface; homography: HomographyResult; warpedPixels: number } {
  const { width, height } = floorPhoto;
  const out = new Uint8ClampedArray(floorPhoto.data);
  const homography = solveHomographyFromUnitSquare(quad);

  if (!homography.valid) {
    return { surface: { width, height, data: out }, homography, warpedPixels: 0 };
  }

  const inv = homography.inverse;
  const minX = Math.max(
    0,
    Math.floor(Math.min(quad.tl.x, quad.tr.x, quad.br.x, quad.bl.x))
  );
  const maxX = Math.min(
    width - 1,
    Math.ceil(Math.max(quad.tl.x, quad.tr.x, quad.br.x, quad.bl.x))
  );
  const minY = Math.max(
    0,
    Math.floor(Math.min(quad.tl.y, quad.tr.y, quad.br.y, quad.bl.y))
  );
  const maxY = Math.min(
    height - 1,
    Math.ceil(Math.max(quad.tl.y, quad.tr.y, quad.br.y, quad.bl.y))
  );

  const tw = alponaTexture.width;
  const th = alponaTexture.height;
  const td = alponaTexture.data;
  const clampOp = Math.max(0.05, Math.min(1, opacity));
  let warpedPixels = 0;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w = inv[6] * x + inv[7] * y + inv[8];
      if (Math.abs(w) < 1e-8) continue;
      const u = (inv[0] * x + inv[1] * y + inv[2]) / w;
      const v = (inv[3] * x + inv[4] * y + inv[5]) / w;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;

      // Bilinear sampling from Alpona texture
      const fx = u * (tw - 1);
      const fy = v * (th - 1);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(tw - 1, x0 + 1);
      const y1 = Math.min(th - 1, y0 + 1);
      const sx = fx - x0;
      const sy = fy - y0;

      const i00 = (y0 * tw + x0) * 4;
      const i10 = (y0 * tw + x1) * 4;
      const i01 = (y1 * tw + x0) * 4;
      const i11 = (y1 * tw + x1) * 4;

      const w00 = (1 - sx) * (1 - sy);
      const w10 = sx * (1 - sy);
      const w01 = (1 - sx) * sy;
      const w11 = sx * sy;

      const sr = td[i00] * w00 + td[i10] * w10 + td[i01] * w01 + td[i11] * w11;
      const sg =
        td[i00 + 1] * w00 + td[i10 + 1] * w10 + td[i01 + 1] * w01 + td[i11 + 1] * w11;
      const sb =
        td[i00 + 2] * w00 + td[i10 + 2] * w10 + td[i01 + 2] * w01 + td[i11 + 2] * w11;

      const dstIdx = (y * width + x) * 4;
      const fr = out[dstIdx];
      const fg = out[dstIdx + 1];
      const fb = out[dstIdx + 2];

      let outR = fr;
      let outG = fg;
      let outB = fb;

      if (blendMode === 'chalk-screen') {
        // Knock out the digital canvas background so only the chalk/pigment sits on real tiles!
        const bgDiff =
          Math.abs(sr - bgHexRgb.r) +
          Math.abs(sg - bgHexRgb.g) +
          Math.abs(sb - bgHexRgb.b);
        const pigmentAlpha = Math.max(0, Math.min(1, (bgDiff - 18) / 72)) * clampOp;
        if (pigmentAlpha <= 0.01) continue;
        // Modulate slightly by floor luminance so tile mortar seams gently show through painted chalk
        const floorLuma = (0.299 * fr + 0.587 * fg + 0.114 * fb) / 255;
        const textureMod = 0.78 + 0.3 * floorLuma;
        const paintR = Math.min(255, sr * textureMod);
        const paintG = Math.min(255, sg * textureMod);
        const paintB = Math.min(255, sb * textureMod);
        outR = fr * (1 - pigmentAlpha) + paintR * pigmentAlpha;
        outG = fg * (1 - pigmentAlpha) + paintG * pigmentAlpha;
        outB = fb * (1 - pigmentAlpha) + paintB * pigmentAlpha;
      } else if (blendMode === 'ink-multiply') {
        const mr = (fr * sr) / 255;
        const mg = (fg * sg) / 255;
        const mb = (fb * sb) / 255;
        outR = fr * (1 - clampOp) + mr * clampOp;
        outG = fg * (1 - clampOp) + mg * clampOp;
        outB = fb * (1 - clampOp) + mb * clampOp;
      } else {
        outR = fr * (1 - clampOp) + sr * clampOp;
        outG = fg * (1 - clampOp) + sg * clampOp;
        outB = fb * (1 - clampOp) + sb * clampOp;
      }

      out[dstIdx] = Math.round(Math.max(0, Math.min(255, outR)));
      out[dstIdx + 1] = Math.round(Math.max(0, Math.min(255, outG)));
      out[dstIdx + 2] = Math.round(Math.max(0, Math.min(255, outB)));
      out[dstIdx + 3] = 255;
      warpedPixels++;
    }
  }

  return { surface: { width, height, data: out }, homography, warpedPixels };
}
