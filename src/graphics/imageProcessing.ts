import type { PixelSurface } from './rasterizer';

export type PointOpKind =
  | 'original'
  | 'grayscale'
  | 'negative'
  | 'log'
  | 'gamma'
  | 'contrast-stretch'
  | 'hist-equalize';

export type SpatialFilterKind =
  | 'box-blur'
  | 'gaussian-blur'
  | 'laplacian-sharpen'
  | 'sobel-edge'
  | 'printable-stencil';

export type FrequencyFilterKind =
  | 'ideal-lowpass'
  | 'gaussian-lowpass'
  | 'ideal-highpass'
  | 'gaussian-highpass';

export interface HistogramData {
  bins: number[]; // length 256
  minIntensity: number;
  maxIntensity: number;
  meanIntensity: number;
}

function clampByte(v: number): number {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return Math.round(v);
}

/**
 * Computes a 256-bin luminance histogram for an RGBA PixelSurface.
 */
export function computeLuminanceHistogram(surface: PixelSurface): HistogramData {
  const bins = new Array<number>(256).fill(0);
  const { data } = surface;
  let minIntensity = 255;
  let maxIntensity = 0;
  let sum = 0;
  const count = surface.width * surface.height;

  for (let i = 0; i < data.length; i += 4) {
    const y = clampByte(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    bins[y]++;
    if (y < minIntensity) minIntensity = y;
    if (y > maxIntensity) maxIntensity = y;
    sum += y;
  }

  return {
    bins,
    minIntensity: count > 0 ? minIntensity : 0,
    maxIntensity: count > 0 ? maxIntensity : 0,
    meanIntensity: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
  };
}

/**
 * Applies CSE 401/402 Week 13–14 Point Processing & Gray-Level Transformations.
 */
export function applyPointOperation(
  src: PixelSurface,
  kind: PointOpKind,
  gamma = 1.0
): PixelSurface {
  const out: PixelSurface = {
    width: src.width,
    height: src.height,
    data: new Uint8ClampedArray(src.data.length),
  };

  if (kind === 'original') {
    out.data.set(src.data);
    return out;
  }

  const { data } = src;
  const dst = out.data;

  if (kind === 'grayscale') {
    for (let i = 0; i < data.length; i += 4) {
      const y = clampByte(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      dst[i] = y;
      dst[i + 1] = y;
      dst[i + 2] = y;
      dst[i + 3] = 255;
    }
    return out;
  }

  if (kind === 'negative') {
    for (let i = 0; i < data.length; i += 4) {
      dst[i] = 255 - data[i];
      dst[i + 1] = 255 - data[i + 1];
      dst[i + 2] = 255 - data[i + 2];
      dst[i + 3] = 255;
    }
    return out;
  }

  if (kind === 'log') {
    // s = c * ln(1 + r), c = 255 / ln(256)
    const c = 255 / Math.log(256);
    for (let i = 0; i < data.length; i += 4) {
      dst[i] = clampByte(c * Math.log(1 + data[i]));
      dst[i + 1] = clampByte(c * Math.log(1 + data[i + 1]));
      dst[i + 2] = clampByte(c * Math.log(1 + data[i + 2]));
      dst[i + 3] = 255;
    }
    return out;
  }

  if (kind === 'gamma') {
    const safeGamma = Math.max(0.15, Math.min(4.0, gamma));
    const lut = new Uint8Array(256);
    for (let v = 0; v < 256; v++) {
      lut[v] = clampByte(255 * Math.pow(v / 255, safeGamma));
    }
    for (let i = 0; i < data.length; i += 4) {
      dst[i] = lut[data[i]];
      dst[i + 1] = lut[data[i + 1]];
      dst[i + 2] = lut[data[i + 2]];
      dst[i + 3] = 255;
    }
    return out;
  }

  if (kind === 'contrast-stretch') {
    let minVal = 255;
    let maxVal = 0;
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const v = data[i + c];
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
    const span = Math.max(1, maxVal - minVal);
    for (let i = 0; i < data.length; i += 4) {
      dst[i] = clampByte(((data[i] - minVal) * 255) / span);
      dst[i + 1] = clampByte(((data[i + 1] - minVal) * 255) / span);
      dst[i + 2] = clampByte(((data[i + 2] - minVal) * 255) / span);
      dst[i + 3] = 255;
    }
    return out;
  }

  // Histogram Equalization via Cumulative Distribution Function (CDF)
  const hist = computeLuminanceHistogram(src);
  const totalPixels = src.width * src.height;
  const cdf = new Array<number>(256).fill(0);
  let running = 0;
  let cdfMin = 0;
  for (let i = 0; i < 256; i++) {
    running += hist.bins[i];
    cdf[i] = running;
    if (cdfMin === 0 && running > 0) {
      cdfMin = running;
    }
  }
  const denom = Math.max(1, totalPixels - cdfMin);
  const eqLut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    eqLut[i] = clampByte(((cdf[i] - cdfMin) / denom) * 255);
  }

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = clampByte(0.299 * r + 0.587 * g + 0.114 * b);
    const eqLum = eqLut[lum];
    if (lum === 0) {
      dst[i] = eqLum;
      dst[i + 1] = eqLum;
      dst[i + 2] = eqLum;
    } else {
      const ratio = eqLum / lum;
      dst[i] = clampByte(r * ratio);
      dst[i + 1] = clampByte(g * ratio);
      dst[i + 2] = clampByte(b * ratio);
    }
    dst[i + 3] = 255;
  }
  return out;
}

/**
 * Applies CSE 401/402 Week 14 Spatial Domain 3x3 Convolution Filters.
 */
export function applySpatialFilter(
  src: PixelSurface,
  kind: SpatialFilterKind
): PixelSurface {
  const { width, height, data } = src;
  const out: PixelSurface = {
    width,
    height,
    data: new Uint8ClampedArray(data.length),
  };
  const dst = out.data;

  if (kind === 'sobel-edge') {
    // Convert to luminance first for clean Sobel gradient magnitude sqrt(Gx^2 + Gy^2)
    const lum = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const off = i * 4;
      lum[i] = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const y0 = Math.max(0, y - 1);
        const y2 = Math.min(height - 1, y + 1);
        const x0 = Math.max(0, x - 1);
        const x2 = Math.min(width - 1, x + 1);

        const p00 = lum[y0 * width + x0];
        const p01 = lum[y0 * width + x];
        const p02 = lum[y0 * width + x2];
        const p10 = lum[y * width + x0];
        const p12 = lum[y * width + x2];
        const p20 = lum[y2 * width + x0];
        const p21 = lum[y2 * width + x];
        const p22 = lum[y2 * width + x2];

        const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
        const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;
        const mag = clampByte(Math.hypot(gx, gy));

        const idx = (y * width + x) * 4;
        dst[idx] = mag;
        dst[idx + 1] = mag;
        dst[idx + 2] = mag;
        dst[idx + 3] = 255;
      }
    }
    return out;
  }

  if (kind === 'printable-stencil') {
    return extractPrintableStencil(src, 48);
  }

  let kernel: number[];
  let divisor = 1;

  if (kind === 'box-blur') {
    kernel = [1, 1, 1, 1, 1, 1, 1, 1, 1];
    divisor = 9;
  } else if (kind === 'gaussian-blur') {
    kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    divisor = 16;
  } else {
    // Laplacian Sharpening: I - Laplacian(I)
    kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    divisor = 1;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;

      for (let ky = -1; ky <= 1; ky++) {
        const sy = Math.max(0, Math.min(height - 1, y + ky));
        for (let kx = -1; kx <= 1; kx++) {
          const sx = Math.max(0, Math.min(width - 1, x + kx));
          const w = kernel[(ky + 1) * 3 + (kx + 1)];
          const off = (sy * width + sx) * 4;
          rSum += data[off] * w;
          gSum += data[off + 1] * w;
          bSum += data[off + 2] * w;
        }
      }

      const idx = (y * width + x) * 4;
      dst[idx] = clampByte(rSum / divisor);
      dst[idx + 1] = clampByte(gSum / divisor);
      dst[idx + 2] = clampByte(bSum / divisor);
      dst[idx + 3] = 255;
    }
  }

  return out;
}

/**
 * In-place 1D Cooley-Tukey Radix-2 Fast Fourier Transform (N must be power of 2).
 */
export function fft1d(
  re: Float64Array,
  im: Float64Array,
  inverse = false
): void {
  const n = re.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + half] * wRe - im[i + j + half] * wIm;
        const vIm = re[i + j + half] * wIm + im[i + j + half] * wRe;

        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;

        const nextWRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextWRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

/**
 * Separable 2D Radix-2 FFT on an N x N complex grid (N must be power of 2).
 */
export function fft2d(
  re: Float64Array,
  im: Float64Array,
  size: number,
  inverse = false
): void {
  const rowRe = new Float64Array(size);
  const rowIm = new Float64Array(size);

  // Transform rows
  for (let y = 0; y < size; y++) {
    const rowOff = y * size;
    for (let x = 0; x < size; x++) {
      rowRe[x] = re[rowOff + x];
      rowIm[x] = im[rowOff + x];
    }
    fft1d(rowRe, rowIm, inverse);
    for (let x = 0; x < size; x++) {
      re[rowOff + x] = rowRe[x];
      im[rowOff + x] = rowIm[x];
    }
  }

  // Transform columns
  const colRe = new Float64Array(size);
  const colIm = new Float64Array(size);
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      colRe[y] = re[y * size + x];
      colIm[y] = im[y * size + x];
    }
    fft1d(colRe, colIm, inverse);
    for (let y = 0; y < size; y++) {
      re[y * size + x] = colRe[y];
      im[y * size + x] = colIm[y];
    }
  }
}

export interface FrequencyFilterResult {
  filtered: PixelSurface;
  spectrum: PixelSurface;
  size: number;
}

/**
 * Downsamples an RGBA PixelSurface to power-of-2 N x N grayscale, computes its
 * centered 2D Fourier Transform, applies an Ideal or Gaussian Low-Pass / High-Pass
 * frequency filter with cutoff radius D0, and returns both the filtered image
 * and the log-scaled 2D Magnitude Spectrum!
 */
export function applyFrequencyDomainFilter(
  src: PixelSurface,
  filterKind: FrequencyFilterKind,
  cutoffD0: number,
  fftSize = 128
): FrequencyFilterResult {
  const N = fftSize;
  const re = new Float64Array(N * N);
  const im = new Float64Array(N * N);

  // Sample grayscale luminance + center frequency spectrum via (-1)^(x+y) modulation
  for (let y = 0; y < N; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / N));
    for (let x = 0; x < N; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / N));
      const off = (sy * src.width + sx) * 4;
      const lum =
        0.299 * src.data[off] +
        0.587 * src.data[off + 1] +
        0.114 * src.data[off + 2];
      const sign = (x + y) % 2 === 0 ? 1 : -1;
      re[y * N + x] = lum * sign;
      im[y * N + x] = 0;
    }
  }

  // Forward 2D FFT
  fft2d(re, im, N, false);

  const half = N / 2;
  const d0 = Math.max(2, Math.min(half, cutoffD0));
  const twoD0Sq = 2 * d0 * d0;

  // Build magnitude spectrum visualization & apply transfer function H(u, v)
  const logMags = new Float64Array(N * N);
  let maxLogMag = 1e-6;

  for (let v = 0; v < N; v++) {
    for (let u = 0; u < N; u++) {
      const idx = v * N + u;
      const dist = Math.hypot(u - half, v - half);

      let h = 1;
      if (filterKind === 'ideal-lowpass') {
        h = dist <= d0 ? 1 : 0;
      } else if (filterKind === 'gaussian-lowpass') {
        h = Math.exp(-(dist * dist) / twoD0Sq);
      } else if (filterKind === 'ideal-highpass') {
        h = dist > d0 ? 1 : 0;
      } else {
        // gaussian-highpass
        h = 1 - Math.exp(-(dist * dist) / twoD0Sq);
      }

      re[idx] *= h;
      im[idx] *= h;

      const mag = Math.hypot(re[idx], im[idx]);
      const lm = Math.log(1 + mag);
      logMags[idx] = lm;
      if (lm > maxLogMag) maxLogMag = lm;
    }
  }

  // Render spectrum image with warm gold/amber spectral tint on dark slate
  const spectrumData = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const norm = logMags[i] / maxLogMag;
    const v = clampByte(norm * 255);
    const off = i * 4;
    spectrumData[off] = clampByte(Math.min(255, v * 1.15));
    spectrumData[off + 1] = clampByte(v * 0.88);
    spectrumData[off + 2] = clampByte(v * 0.45);
    spectrumData[off + 3] = 255;
  }

  // Inverse 2D FFT back to spatial domain
  fft2d(re, im, N, true);

  const filteredData = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const idx = y * N + x;
      const sign = (x + y) % 2 === 0 ? 1 : -1;
      let val = re[idx] * sign;
      // High-pass results are zero-mean around 0; take abs & boost slightly for crisp visibility
      if (filterKind === 'ideal-highpass' || filterKind === 'gaussian-highpass') {
        val = Math.abs(val) * 1.8;
      }
      const byte = clampByte(val);
      const off = idx * 4;
      filteredData[off] = byte;
      filteredData[off + 1] = byte;
      filteredData[off + 2] = byte;
      filteredData[off + 3] = 255;
    }
  }

  return {
    filtered: { width: N, height: N, data: filteredData },
    spectrum: { width: N, height: N, data: spectrumData },
    size: N,
  };
}

/**
 * Extracts a crisp black-on-white Printable Alpona Floor Stencil by running
 * a slight 3x3 Gaussian denoise, Sobel gradient magnitude, and adaptive ink thresholding.
 */
export function extractPrintableStencil(
  src: PixelSurface,
  threshold = 48
): PixelSurface {
  const blurred = applySpatialFilter(src, 'gaussian-blur');
  const edges = applySpatialFilter(blurred, 'sobel-edge');
  const { width, height, data } = edges;
  const out: PixelSurface = {
    width,
    height,
    data: new Uint8ClampedArray(data.length),
  };
  const dst = out.data;
  const safeThresh = Math.max(12, Math.min(220, Math.round(threshold)));

  for (let i = 0; i < data.length; i += 4) {
    const mag = data[i];
    // Strong edge -> crisp dark charcoal ink; background -> clean printable paper white
    const isInk = mag >= safeThresh;
    const v = isInk ? 20 : 255;
    dst[i] = v;
    dst[i + 1] = v;
    dst[i + 2] = v;
    dst[i + 3] = 255;
  }
  return out;
}

export interface PixelPointCoord {
  x: number;
  y: number;
}

export interface PixelRelationshipReport {
  p1: PixelPointCoord;
  p2: PixelPointCoord;
  lum1: number;
  lum2: number;
  n4OfP1: PixelPointCoord[];
  n8OfP1: PixelPointCoord[];
  d4CityBlock: number;
  d8Chessboard: number;
  deEuclidean: number;
  is4Adjacent: boolean;
  is8Adjacent: boolean;
  sameIntensityBand: boolean;
  component4Size: number;
  component8Size: number;
  connected4Path: boolean;
  connected8Path: boolean;
}

function getLuminanceAt(surface: PixelSurface, x: number, y: number): number {
  const cx = Math.max(0, Math.min(surface.width - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(surface.height - 1, Math.round(y)));
  const off = (cy * surface.width + cx) * 4;
  return clampByte(
    0.299 * surface.data[off] +
      0.587 * surface.data[off + 1] +
      0.114 * surface.data[off + 2]
  );
}

/**
 * Computes CSE 401/402 Week 13 Basic Pixel Relationships between two pixel coordinates:
 * N4(p), N8(p), City-Block distance D4, Chessboard distance D8, Euclidean distance De,
 * 4-adjacency / 8-adjacency, and iterative BFS 4- & 8-connected component analysis.
 */
export function computePixelRelationships(
  surface: PixelSurface,
  rawP1: PixelPointCoord,
  rawP2: PixelPointCoord,
  intensityTolerance = 28
): PixelRelationshipReport {
  const { width, height } = surface;
  const p1: PixelPointCoord = {
    x: Math.max(0, Math.min(width - 1, Math.round(rawP1.x))),
    y: Math.max(0, Math.min(height - 1, Math.round(rawP1.y))),
  };
  const p2: PixelPointCoord = {
    x: Math.max(0, Math.min(width - 1, Math.round(rawP2.x))),
    y: Math.max(0, Math.min(height - 1, Math.round(rawP2.y))),
  };

  const lum1 = getLuminanceAt(surface, p1.x, p1.y);
  const lum2 = getLuminanceAt(surface, p2.x, p2.y);
  const dx = Math.abs(p1.x - p2.x);
  const dy = Math.abs(p1.y - p2.y);

  const d4CityBlock = dx + dy;
  const d8Chessboard = Math.max(dx, dy);
  const deEuclidean = Math.round(Math.hypot(dx, dy) * 100) / 100;

  const n4Offsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const n8Offsets = [
    ...n4Offsets,
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  const n4OfP1: PixelPointCoord[] = [];
  for (const [ox, oy] of n4Offsets) {
    const nx = p1.x + ox;
    const ny = p1.y + oy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      n4OfP1.push({ x: nx, y: ny });
    }
  }

  const n8OfP1: PixelPointCoord[] = [];
  for (const [ox, oy] of n8Offsets) {
    const nx = p1.x + ox;
    const ny = p1.y + oy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      n8OfP1.push({ x: nx, y: ny });
    }
  }

  const sameIntensityBand = Math.abs(lum1 - lum2) <= intensityTolerance;
  const is4Adjacent = d4CityBlock === 1 && sameIntensityBand;
  const is8Adjacent = d8Chessboard === 1 && sameIntensityBand;

  // Iterative BFS for 4-connected & 8-connected components starting from p1
  const bfsComponent = (useEight: boolean): { size: number; reachesP2: boolean } => {
    const total = width * height;
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;
    const startIdx = p1.y * width + p1.x;
    const targetIdx = p2.y * width + p2.x;
    visited[startIdx] = 1;
    queue[tail++] = startIdx;

    const dirs = useEight ? n8Offsets : n4Offsets;
    let size = 0;
    let reachesP2 = startIdx === targetIdx;

    while (head < tail) {
      const idx = queue[head++];
      size++;
      const cy = Math.floor(idx / width);
      const cx = idx - cy * width;

      for (const [ox, oy] of dirs) {
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (visited[nIdx]) continue;
        const nLum = getLuminanceAt(surface, nx, ny);
        if (Math.abs(nLum - lum1) <= intensityTolerance) {
          visited[nIdx] = 1;
          if (nIdx === targetIdx) reachesP2 = true;
          queue[tail++] = nIdx;
        }
      }
    }
    return { size, reachesP2 };
  };

  const c4 = bfsComponent(false);
  const c8 = bfsComponent(true);

  return {
    p1,
    p2,
    lum1,
    lum2,
    n4OfP1,
    n8OfP1,
    d4CityBlock,
    d8Chessboard,
    deEuclidean,
    is4Adjacent,
    is8Adjacent,
    sameIntensityBand,
    component4Size: c4.size,
    component8Size: c8.size,
    connected4Path: c4.reachesP2,
    connected8Path: c8.reachesP2,
  };
}

export type MorphologyOpKind = 'erode' | 'dilate' | 'open' | 'close';

export interface MorphologyResult {
  surface: PixelSurface;
  foregroundBefore: number;
  foregroundAfter: number;
  pixelsDelta: number;
  gapsBridged: number;
}

function binaryDilate(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = 0;
      for (let ky = -radius; ky <= radius && !hit; ky++) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) continue;
        for (let kx = -radius; kx <= radius; kx++) {
          const nx = x + kx;
          if (nx < 0 || nx >= width) continue;
          if (mask[ny * width + nx]) {
            hit = 1;
            break;
          }
        }
      }
      out[y * width + x] = hit;
    }
  }
  return out;
}

function binaryErode(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let all = 1;
      for (let ky = -radius; ky <= radius && all; ky++) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) {
          all = 0;
          break;
        }
        for (let kx = -radius; kx <= radius; kx++) {
          const nx = x + kx;
          if (nx < 0 || nx >= width || !mask[ny * width + nx]) {
            all = 0;
            break;
          }
        }
      }
      out[y * width + x] = all;
    }
  }
  return out;
}

/**
 * Applies CSE 401/402 CLO-6 Binary Mathematical Morphology (Erosion, Dilation,
 * Opening, or Closing = Dilate -> Erode) with a (2r+1)x(2r+1) square structuring element.
 * Closing seals 1-3 px micro-gaps in Alpona strokes so Seed Fill & laser/vinyl stencils
 * stay watertight without bloating stroke width.
 */
export function applyMorphology(
  src: PixelSurface,
  op: MorphologyOpKind,
  radius = 1,
  threshold = 72
): MorphologyResult {
  const { width, height, data } = src;
  const r = Math.max(1, Math.min(3, Math.round(radius)));
  const total = width * height;

  // Auto-detect whether background is light (paper/stencil) or dark (courtyard slate)
  // by sampling the 4 corners so foreground strokes are always mask === 1!
  const cornerLuma =
    (getLuminanceAt(src, 2, 2) +
      getLuminanceAt(src, width - 3, 2) +
      getLuminanceAt(src, 2, height - 3) +
      getLuminanceAt(src, width - 3, height - 3)) /
    4;
  const darkInkOnLightBg = cornerLuma > 160;

  const mask = new Uint8Array(total);
  let foregroundBefore = 0;

  for (let i = 0; i < total; i++) {
    const off = i * 4;
    const lum = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
    const isFg = darkInkOnLightBg ? lum < 255 - threshold : lum > threshold;
    if (isFg) {
      mask[i] = 1;
      foregroundBefore++;
    }
  }

  let resultMask: Uint8Array;
  if (op === 'dilate') {
    resultMask = binaryDilate(mask, width, height, r);
  } else if (op === 'erode') {
    resultMask = binaryErode(mask, width, height, r);
  } else if (op === 'open') {
    resultMask = binaryDilate(binaryErode(mask, width, height, r), width, height, r);
  } else {
    // 'close': Dilate -> Erode bridges micro-gaps while preserving line thickness
    resultMask = binaryErode(binaryDilate(mask, width, height, r), width, height, r);
  }

  const outData = new Uint8ClampedArray(data.length);
  let foregroundAfter = 0;
  let gapsBridged = 0;

  for (let i = 0; i < total; i++) {
    const fg = resultMask[i] === 1;
    if (fg) foregroundAfter++;
    const newlyBridged = fg && mask[i] === 0;
    if (newlyBridged) gapsBridged++;

    const off = i * 4;
    if (newlyBridged && op === 'close') {
      // Highlight sealed micro-gaps in warm Sindoor crimson so users see exactly what was repaired
      outData[off] = 220;
      outData[off + 1] = 38;
      outData[off + 2] = 38;
      outData[off + 3] = 255;
    } else if (fg) {
      const v = darkInkOnLightBg ? 22 : 248;
      outData[off] = v;
      outData[off + 1] = v;
      outData[off + 2] = v;
      outData[off + 3] = 255;
    } else {
      const v = darkInkOnLightBg ? 252 : 22;
      outData[off] = v;
      outData[off + 1] = v;
      outData[off + 2] = v;
      outData[off + 3] = 255;
    }
  }

  return {
    surface: { width, height, data: outData },
    foregroundBefore,
    foregroundAfter,
    pixelsDelta: foregroundAfter - foregroundBefore,
    gapsBridged,
  };
}

/**
 * CSE 401/402 Supersampling Anti-Aliasing (2x2 SSAA Box Filter):
 * Downsamples a 2W x 2H supersampled raster buffer to W x H by averaging
 * each 2x2 pixel block, eliminating stair-step aliasing along diagonal edges.
 */
export function downsample2xSSAA(src: PixelSurface): PixelSurface {
  const outW = Math.max(1, Math.floor(src.width / 2));
  const outH = Math.max(1, Math.floor(src.height / 2));
  const out = new Uint8ClampedArray(outW * outH * 4);
  const { width, data } = src;

  for (let y = 0; y < outH; y++) {
    const sy = y * 2;
    for (let x = 0; x < outW; x++) {
      const sx = x * 2;
      const i00 = (sy * width + sx) * 4;
      const i10 = (sy * width + (sx + 1)) * 4;
      const i01 = ((sy + 1) * width + sx) * 4;
      const i11 = ((sy + 1) * width + (sx + 1)) * 4;
      const dst = (y * outW + x) * 4;

      out[dst] = Math.round((data[i00] + data[i10] + data[i01] + data[i11]) / 4);
      out[dst + 1] = Math.round(
        (data[i00 + 1] + data[i10 + 1] + data[i01 + 1] + data[i11 + 1]) / 4
      );
      out[dst + 2] = Math.round(
        (data[i00 + 2] + data[i10 + 2] + data[i01 + 2] + data[i11 + 2]) / 4
      );
      out[dst + 3] = Math.round(
        (data[i00 + 3] + data[i10 + 3] + data[i01 + 3] + data[i11 + 3]) / 4
      );
    }
  }

  return { width: outW, height: outH, data: out };
}
