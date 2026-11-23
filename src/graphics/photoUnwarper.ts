import {
  applyHomography,
  solveHomographyFromUnitSquare,
  type HomographyQuad,
} from './homography';
import { applyMorphology } from './imageProcessing';
import type { PixelSurface } from './rasterizer';

export interface SymmetryDetectionScore {
  sectors: number;
  correlation: number; // 0..1 normalized angular similarity
}

export interface SymmetryDetectionReport {
  detectedSectors: number;
  confidencePercent: number;
  scores: SymmetryDetectionScore[];
}

export interface RestoredAlponaResult {
  rectified: PixelSurface;
  restored: PixelSurface;
  stencil: PixelSurface;
  symmetry: SymmetryDetectionReport;
}

function sampleBilinearRgba(
  src: PixelSurface,
  fx: number,
  fy: number
): [number, number, number] {
  const { width, height, data } = src;
  const x = Math.max(0, Math.min(width - 1.001, fx));
  const y = Math.max(0, Math.min(height - 1.001, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const dx = x - x0;
  const dy = y - y0;

  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;

  const w00 = (1 - dx) * (1 - dy);
  const w10 = dx * (1 - dy);
  const w01 = (1 - dx) * dy;
  const w11 = dx * dy;

  return [
    data[i00] * w00 + data[i10] * w10 + data[i01] * w01 + data[i11] * w11,
    data[i00 + 1] * w00 +
      data[i10 + 1] * w10 +
      data[i01 + 1] * w01 +
      data[i11 + 1] * w11,
    data[i00 + 2] * w00 +
      data[i10 + 2] * w10 +
      data[i01 + 2] * w01 +
      data[i11 + 2] * w11,
  ];
}

/**
 * Generates a realistic synthetic angled campus-street Alpona photograph
 * (perspective-foreshortened chalk 8-fold lotus on dark weathered asphalt,
 * with a deliberate scuffed/faded lower-right quadrant so users can see
 * Inverse-Homography Unwarping + Symmetry Restoration repair it in real time).
 */
export function generateAngledStreetAlponaPhoto(
  width = 640,
  height = 440
): { surface: PixelSurface; quad: HomographyQuad } {
  const data = new Uint8ClampedArray(width * height * 4);

  // Subtle asphalt courtyard road with angled perspective
  for (let y = 0; y < height; y++) {
    const ny = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x++) {
      const hash = ((x * 73856093) ^ (y * 19349663)) & 255;
      const grain = (hash / 255 - 0.5) * 16;
      const baseR = 54 + ny * 18 + grain;
      const baseG = 53 + ny * 16 + grain;
      const baseB = 58 + ny * 15 + grain;
      const off = (y * width + x) * 4;
      data[off] = Math.max(0, Math.min(255, Math.round(baseR)));
      data[off + 1] = Math.max(0, Math.min(255, Math.round(baseG)));
      data[off + 2] = Math.max(0, Math.min(255, Math.round(baseB)));
      data[off + 3] = 255;
    }
  }

  // Paint an angled 8-fold street chalk Alpona inside a perspective trapezoid
  const quad: HomographyQuad = {
    tl: { x: Math.round(width * 0.27), y: Math.round(height * 0.17) },
    tr: { x: Math.round(width * 0.74), y: Math.round(height * 0.19) },
    br: { x: Math.round(width * 0.87), y: Math.round(height * 0.87) },
    bl: { x: Math.round(width * 0.13), y: Math.round(height * 0.84) },
  };

  const hom = solveHomographyFromUnitSquare(quad);
  if (hom.valid) {
    const inv = hom.inverse;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const uv = applyHomography(inv, x, y);
        if (uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) continue;

        const dx = (uv.x - 0.5) * 2;
        const dy = (uv.y - 0.5) * 2;
        const r = Math.hypot(dx, dy);
        const theta = Math.atan2(dy, dx);

        // 8-fold chalk lotus petals + concentric rings + outer scallop garland
        const petalWave = 0.52 + 0.18 * Math.cos(8 * theta);
        const outerScallop = 0.82 + 0.06 * Math.cos(8 * theta);
        const ringCore = Math.abs(r - 0.16) < 0.025;
        const ringMid = Math.abs(r - 0.34) < 0.02;
        const petalOutline = Math.abs(r - petalWave) < 0.026 && r > 0.24;
        const outerOutline = Math.abs(r - outerScallop) < 0.025;
        const spokeLine =
          r > 0.16 && r < 0.74 && Math.abs(Math.sin(4 * theta)) < 0.045;
        const dotRing =
          Math.abs(r - 0.68) < 0.032 && Math.cos(8 * theta) > 0.9;

        const inPetalFill = r > 0.17 && r < 0.33 && Math.cos(8 * theta) > 0.1;

        // Deliberate foot-scuff / pavement fade in bottom-right quadrant (u>0.55, v>0.55)
        const scuffed = uv.x > 0.54 && uv.y > 0.52;
        const chalkStrength = scuffed ? 0.18 : 0.92;

        const off = (y * width + x) * 4;
        if (ringCore || ringMid || petalOutline || outerOutline || spokeLine || dotRing) {
          data[off] = Math.round(data[off] * (1 - chalkStrength) + 246 * chalkStrength);
          data[off + 1] = Math.round(data[off + 1] * (1 - chalkStrength) + 242 * chalkStrength);
          data[off + 2] = Math.round(data[off + 2] * (1 - chalkStrength) + 232 * chalkStrength);
        } else if (inPetalFill) {
          const fillAlpha = scuffed ? 0.15 : 0.76;
          data[off] = Math.round(data[off] * (1 - fillAlpha) + 196 * fillAlpha);
          data[off + 1] = Math.round(data[off + 1] * (1 - fillAlpha) + 46 * fillAlpha);
          data[off + 2] = Math.round(data[off + 2] * (1 - fillAlpha) + 42 * fillAlpha);
        }
      }
    }
  }

  return {
    surface: { width, height, data },
    quad,
  };
}

/**
 * CSE 401/402 CLO-4 Inverse Perspective Rectification:
 * Maps the unit square [0,1]^2 through the solved 3x3 homography H into the
 * user's angled floor/street photo with bilinear sampling, flattening any skewed
 * Alpona photograph into a top-down orthorectified square.
 */
export function rectifyPhotoQuad(
  photo: PixelSurface,
  quad: HomographyQuad,
  outSize = 360
): PixelSurface {
  const dim = Math.max(64, Math.min(720, Math.round(outSize)));
  const out = new Uint8ClampedArray(dim * dim * 4);
  const hom = solveHomographyFromUnitSquare(quad);

  if (!hom.valid) {
    return { width: dim, height: dim, data: out };
  }

  const invDenom = 1 / Math.max(1, dim - 1);
  for (let y = 0; y < dim; y++) {
    const v = y * invDenom;
    for (let x = 0; x < dim; x++) {
      const u = x * invDenom;
      const srcPt = applyHomography(hom.matrix, u, v);
      const [r, g, b] = sampleBilinearRgba(photo, srcPt.x, srcPt.y);
      const off = (y * dim + x) * 4;
      out[off] = Math.round(r);
      out[off + 1] = Math.round(g);
      out[off + 2] = Math.round(b);
      out[off + 3] = 255;
    }
  }

  return { width: dim, height: dim, data: out };
}

/**
 * CSE 401/402 CLO-6 Polar Angular Autocorrelation Symmetry Detector:
 * Samples luminance around concentric polar rings and correlates I(r, theta)
 * with I(r, theta + 2*pi/n) across candidate rotational folds n in {4, 6, 8, 12}
 * to automatically identify the Alpona's dominant symmetry fold order.
 */
export function detectRotationalSymmetryOrder(
  flatSurface: PixelSurface
): SymmetryDetectionReport {
  const { width, height } = flatSurface;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const maxR = Math.min(cx, cy) * 0.92;

  const angleBins = 96; // divisible by 4, 6, 8, 12 (96/4=24, 96/6=16, 96/8=12, 96/12=8)
  const radii = [0.24, 0.36, 0.48, 0.6, 0.72, 0.84];

  // Sample zero-mean luminance profiles per radial ring
  const ringProfiles: Float64Array[] = radii.map((rf) => {
    const arr = new Float64Array(angleBins);
    const r = rf * maxR;
    let mean = 0;
    for (let a = 0; a < angleBins; a++) {
      const th = (2 * Math.PI * a) / angleBins;
      const [R, G, B] = sampleBilinearRgba(
        flatSurface,
        cx + r * Math.cos(th),
        cy + r * Math.sin(th)
      );
      const lum = 0.299 * R + 0.587 * G + 0.114 * B;
      arr[a] = lum;
      mean += lum;
    }
    mean /= angleBins;
    for (let a = 0; a < angleBins; a++) {
      arr[a] -= mean;
    }
    return arr;
  });

  const candidates = [4, 6, 8, 12];
  const scores: SymmetryDetectionScore[] = candidates.map((n) => {
    const shift = angleBins / n;
    let num = 0;
    let den = 0;
    for (const prof of ringProfiles) {
      for (let a = 0; a < angleBins; a++) {
        const b = (a + shift) % angleBins;
        num += prof[a] * prof[b];
        den += prof[a] * prof[a];
      }
    }
    const corr = den > 1e-6 ? Math.max(0, Math.min(1, num / den)) : 0;
    return {
      sectors: n,
      correlation: Number(corr.toFixed(3)),
    };
  });

  // Prefer the highest fold order that achieves near-peak correlation (since 8-fold also correlates at 4-fold!)
  const maxCorr = Math.max(...scores.map((s) => s.correlation), 0.001);
  let best = scores[0];
  for (const sc of scores) {
    if (sc.correlation >= maxCorr - 0.035) {
      best = sc;
    }
  }

  return {
    detectedSectors: best.sectors,
    confidencePercent: Math.round(best.correlation * 100),
    scores,
  };
}

/**
 * Restores damaged, faded, or partially occluded street Alpona photos by
 * averaging (or taking upper-percentile chalk intensity across) all C_n / D_n
 * symmetry copies around the center, then producing a clean high-contrast
 * black-on-white printable stencil via Morphological Closing.
 */
export function restoreAlponaFromPhoto(
  photo: PixelSurface,
  quad: HomographyQuad,
  sectorsOverride: number | 'auto' = 'auto',
  reflect = true,
  outSize = 360
): RestoredAlponaResult {
  const rectified = rectifyPhotoQuad(photo, quad, outSize);
  const symmetry = detectRotationalSymmetryOrder(rectified);
  const sectors =
    sectorsOverride === 'auto'
      ? symmetry.detectedSectors
      : Math.max(3, Math.min(16, Math.round(sectorsOverride)));

  const dim = rectified.width;
  const cx = (dim - 1) / 2;
  const cy = (dim - 1) / 2;
  const restoredData = new Uint8ClampedArray(dim * dim * 4);

  // Precompute cos/sin for all rotational symmetry copies
  const cosArr: number[] = [];
  const sinArr: number[] = [];
  for (let k = 0; k < sectors; k++) {
    const th = (2 * Math.PI * k) / sectors;
    cosArr.push(Math.cos(th));
    sinArr.push(Math.sin(th));
  }

  // Blend top-75% brightest copies (robust against dark scuffs/shadows occluding 1 quadrant!)
  const copyCount = reflect ? sectors * 2 : sectors;
  const rs = new Float64Array(copyCount);
  const gs = new Float64Array(copyCount);
  const bs = new Float64Array(copyCount);
  const lums = new Float64Array(copyCount);
  const order = new Int32Array(copyCount);

  for (let y = 0; y < dim; y++) {
    const dy = y - cy;
    for (let x = 0; x < dim; x++) {
      const dx = x - cx;
      let idx = 0;
      for (let k = 0; k < sectors; k++) {
        const rx = cx + dx * cosArr[k] - dy * sinArr[k];
        const ry = cy + dx * sinArr[k] + dy * cosArr[k];
        const [r, g, b] = sampleBilinearRgba(rectified, rx, ry);
        rs[idx] = r;
        gs[idx] = g;
        bs[idx] = b;
        lums[idx] = 0.299 * r + 0.587 * g + 0.114 * b;
        order[idx] = idx;
        idx++;

        if (reflect) {
          const mx = cx - dx * cosArr[k] - dy * sinArr[k];
          const my = cy - dx * sinArr[k] + dy * cosArr[k];
          const [mr, mg, mb] = sampleBilinearRgba(rectified, mx, my);
          rs[idx] = mr;
          gs[idx] = mg;
          bs[idx] = mb;
          lums[idx] = 0.299 * mr + 0.587 * mg + 0.114 * mb;
          order[idx] = idx;
          idx++;
        }
      }

      // Insertion sort small array by luminance descending, average upper 65% to heal scuffed quadrants
      for (let i = 1; i < copyCount; i++) {
        const key = order[i];
        const keyLum = lums[key];
        let j = i - 1;
        while (j >= 0 && lums[order[j]] < keyLum) {
          order[j + 1] = order[j];
          j--;
        }
        order[j + 1] = key;
      }

      const keep = Math.max(1, Math.round(copyCount * 0.65));
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      for (let i = 0; i < keep; i++) {
        const c = order[i];
        sumR += rs[c];
        sumG += gs[c];
        sumB += bs[c];
      }

      const off = (y * dim + x) * 4;
      restoredData[off] = Math.round(sumR / keep);
      restoredData[off + 1] = Math.round(sumG / keep);
      restoredData[off + 2] = Math.round(sumB / keep);
      restoredData[off + 3] = 255;
    }
  }

  const restored: PixelSurface = { width: dim, height: dim, data: restoredData };

  // Build crisp printable black-on-white stencil using Binary Morphology Closing to seal floor cracks
  const morph = applyMorphology(restored, 'close', 1, 118);
  const stencilData = new Uint8ClampedArray(dim * dim * 4);
  for (let i = 0; i < dim * dim; i++) {
    const off = i * 4;
    const isStroke =
      morph.surface.data[off] > 180 ||
      (morph.surface.data[off] === 220 && morph.surface.data[off + 1] === 38);
    const v = isStroke ? 20 : 255;
    stencilData[off] = v;
    stencilData[off + 1] = v;
    stencilData[off + 2] = v;
    stencilData[off + 3] = 255;
  }

  return {
    rectified,
    restored,
    stencil: { width: dim, height: dim, data: stencilData },
    symmetry,
  };
}
