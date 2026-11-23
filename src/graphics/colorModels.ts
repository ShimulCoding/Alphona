import { hexToRgba, type RGBA } from './types';

export interface HSVColor {
  h: number; // 0..360 deg
  s: number; // 0..100 %
  v: number; // 0..100 %
}

export interface CMYKColor {
  c: number; // 0..100 %
  m: number; // 0..100 %
  y: number; // 0..100 %
  k: number; // 0..100 %
}

export interface ColorModelBreakdown {
  rgb: { r: number; g: number; b: number };
  hsv: HSVColor;
  cmyk: CMYKColor;
  luminance: number; // ITU-R BT.601 Y = 0.299R + 0.587G + 0.114B
}

/**
 * Converts RGB (0..255) into HSV (H in degrees 0..360, S & V in 0..100%).
 */
export function rgbToHsv(r: number, g: number, b: number): HSVColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta > 1e-6) {
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6);
    } else if (max === gn) {
      h = 60 * ((bn - rn) / delta + 2);
    } else {
      h = 60 * ((rn - gn) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;

  return {
    h: Math.round(h),
    s: Math.round(s),
    v: Math.round(v),
  };
}

/**
 * Converts RGB (0..255) into subtractive CMYK (0..100% each).
 */
export function rgbToCmyk(r: number, g: number, b: number): CMYKColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 1 - 1e-6) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  const denom = 1 - k;
  const c = ((1 - rn - k) / denom) * 100;
  const m = ((1 - gn - k) / denom) * 100;
  const y = ((1 - bn - k) / denom) * 100;

  return {
    c: Math.round(c),
    m: Math.round(m),
    y: Math.round(y),
    k: Math.round(k * 100),
  };
}

/**
 * Computes perceptual grayscale luminance (ITU-R BT.601).
 */
export function rgbToLuminance(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * Computes complete RGB, HSV, CMYK, and grayscale luminance models from a hex string.
 */
export function analyzeHexColor(hex: string): ColorModelBreakdown {
  const rgba: RGBA = hexToRgba(hex);
  return {
    rgb: { r: rgba.r, g: rgba.g, b: rgba.b },
    hsv: rgbToHsv(rgba.r, rgba.g, rgba.b),
    cmyk: rgbToCmyk(rgba.r, rgba.g, rgba.b),
    luminance: rgbToLuminance(rgba.r, rgba.g, rgba.b),
  };
}
