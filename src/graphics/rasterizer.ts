import type { LineAlgorithm, Point2D, RGBA } from './types';

export interface PixelSurface {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * Plots a single pixel with strict bounds clipping.
 * Returns 1 if plotted inside bounds, 0 otherwise.
 */
export function plotPixel(
  surface: PixelSurface,
  x: number,
  y: number,
  color: RGBA
): number {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= surface.width || iy < 0 || iy >= surface.height) {
    return 0;
  }
  const idx = (iy * surface.width + ix) * 4;
  if (color.a >= 255) {
    surface.data[idx] = color.r;
    surface.data[idx + 1] = color.g;
    surface.data[idx + 2] = color.b;
    surface.data[idx + 3] = 255;
  } else if (color.a > 0) {
    const alpha = color.a / 255;
    const inv = 1 - alpha;
    surface.data[idx] = Math.round(color.r * alpha + surface.data[idx] * inv);
    surface.data[idx + 1] = Math.round(
      color.g * alpha + surface.data[idx + 1] * inv
    );
    surface.data[idx + 2] = Math.round(
      color.b * alpha + surface.data[idx + 2] * inv
    );
    surface.data[idx + 3] = 255;
  }
  return 1;
}

/**
 * Stamps a solid integer brush disk of diameter `thickness` centered at (cx, cy).
 * For thickness <= 1, plots a single crisp raster pixel.
 */
export function stampBrush(
  surface: PixelSurface,
  cx: number,
  cy: number,
  color: RGBA,
  thickness: number
): number {
  if (thickness <= 1) {
    return plotPixel(surface, cx, cy, color);
  }
  const radius = Math.floor(thickness / 2);
  const r2 = radius * radius + radius;
  let count = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= r2) {
        count += plotPixel(surface, cx + dx, cy + dy, color);
      }
    }
  }
  return count;
}

/**
 * Bresenham's Integer Line Drawing Algorithm (all 8 octants).
 * Uses only integer additions and comparisons to step from (x0, y0) to (x1, y1).
 * Returns the number of rasterized pixels written.
 */
export function drawBresenhamLine(
  surface: PixelSurface,
  x0Input: number,
  y0Input: number,
  x1Input: number,
  y1Input: number,
  color: RGBA,
  thickness = 1
): number {
  let x0 = Math.round(x0Input);
  let y0 = Math.round(y0Input);
  const x1 = Math.round(x1Input);
  const y1 = Math.round(y1Input);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let pixelsWritten = 0;

  while (true) {
    pixelsWritten += stampBrush(surface, x0, y0, color, thickness);
    if (x0 === x1 && y0 === y1) {
      break;
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return pixelsWritten;
}

/**
 * Digital Differential Analyzer (DDA) Line Drawing Algorithm (CSE 401 Week 3).
 * Uses floating-point incremental stepping along the major axis for comparison
 * against integer Bresenham line rasterization.
 */
export function drawDdaLine(
  surface: PixelSurface,
  x0Input: number,
  y0Input: number,
  x1Input: number,
  y1Input: number,
  color: RGBA,
  thickness = 1
): number {
  const dx = x1Input - x0Input;
  const dy = y1Input - y0Input;
  const steps = Math.max(Math.abs(Math.round(dx)), Math.abs(Math.round(dy)));

  if (steps === 0) {
    return stampBrush(surface, Math.round(x0Input), Math.round(y0Input), color, thickness);
  }

  const xInc = dx / steps;
  const yInc = dy / steps;
  let x = x0Input;
  let y = y0Input;
  let pixelsWritten = 0;

  for (let i = 0; i <= steps; i++) {
    pixelsWritten += stampBrush(surface, Math.round(x), Math.round(y), color, thickness);
    x += xInc;
    y += yInc;
  }

  return pixelsWritten;
}

/**
 * Draws a closed polygon outline by rasterizing each edge sequentially.
 */
export function drawPolygonOutline(
  surface: PixelSurface,
  vertices: Point2D[],
  color: RGBA,
  thickness = 1,
  algorithm: LineAlgorithm = 'bresenham'
): number {
  if (vertices.length < 2) return 0;
  let pixels = 0;
  const drawFn = algorithm === 'dda' ? drawDdaLine : drawBresenhamLine;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    pixels += drawFn(surface, a.x, a.y, b.x, b.y, color, thickness);
  }
  return pixels;
}

/**
 * Bresenham's / Midpoint Circle Drawing Algorithm using 8-way octant symmetry.
 * Decision parameter d starts at 3 - 2*r and updates purely with integer arithmetic.
 * Returns the number of rasterized pixels written.
 */
export function drawBresenhamCircle(
  surface: PixelSurface,
  cxInput: number,
  cyInput: number,
  radiusInput: number,
  color: RGBA,
  thickness = 1
): number {
  const cx = Math.round(cxInput);
  const cy = Math.round(cyInput);
  const r = Math.max(0, Math.round(radiusInput));

  if (r === 0) {
    return stampBrush(surface, cx, cy, color, thickness);
  }

  let x = 0;
  let y = r;
  let d = 3 - 2 * r;
  let pixelsWritten = 0;

  const plotOctants = (px: number, py: number) => {
    pixelsWritten += stampBrush(surface, cx + px, cy + py, color, thickness);
    pixelsWritten += stampBrush(surface, cx - px, cy + py, color, thickness);
    pixelsWritten += stampBrush(surface, cx + px, cy - py, color, thickness);
    pixelsWritten += stampBrush(surface, cx - px, cy - py, color, thickness);
    if (px !== py) {
      pixelsWritten += stampBrush(surface, cx + py, cy + px, color, thickness);
      pixelsWritten += stampBrush(surface, cx - py, cy + px, color, thickness);
      pixelsWritten += stampBrush(surface, cx + py, cy - px, color, thickness);
      pixelsWritten += stampBrush(surface, cx - py, cy - px, color, thickness);
    }
  };

  while (x <= y) {
    plotOctants(x, y);
    if (d < 0) {
      d = d + 4 * x + 6;
    } else {
      d = d + 4 * (x - y) + 10;
      y--;
    }
    x++;
  }

  return pixelsWritten;
}

/**
 * Helper to construct a 4-vertex Bengali Alpona diamond petal polygon
 * between drag anchor p0 and tip p1.
 */
export function buildDiamondPetalPolygon(p0: Point2D, p1: Point2D): Point2D[] {
  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const halfWidth = 0.28;
  const px = -dy * halfWidth;
  const py = dx * halfWidth;

  return [
    { x: p0.x, y: p0.y },
    { x: mx + px, y: my + py },
    { x: p1.x, y: p1.y },
    { x: mx - px, y: my - py },
  ];
}

/**
 * Constructs a concave 8-vertex Bengali Shapla / Kalka twin-horned motif polygon
 * between anchor p0 and tip p1 — ideal for demonstrating Weiler-Atherton vs.
 * Sutherland-Hodgman concave polygon clipping!
 */
export function buildConcaveStarPetalPolygon(p0: Point2D, p1: Point2D): Point2D[] {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const px = -dy;
  const py = dx;

  return [
    { x: p0.x, y: p0.y },
    { x: p0.x + dx * 0.42 + px * 0.42, y: p0.y + dy * 0.42 + py * 0.42 },
    { x: p0.x + dx * 0.56 + px * 0.12, y: p0.y + dy * 0.56 + py * 0.12 },
    { x: p0.x + dx * 0.92 + px * 0.34, y: p0.y + dy * 0.92 + py * 0.34 },
    { x: p0.x + dx * 0.68, y: p0.y + dy * 0.68 },
    { x: p0.x + dx * 0.92 - px * 0.34, y: p0.y + dy * 0.92 - py * 0.34 },
    { x: p0.x + dx * 0.56 - px * 0.12, y: p0.y + dy * 0.56 - py * 0.12 },
    { x: p0.x + dx * 0.42 - px * 0.42, y: p0.y + dy * 0.42 - py * 0.42 },
  ];
}

export interface RasterStep {
  step: number;
  points: Array<{ x: number; y: number }>;
  decisionParam: string;
  formulaNote: string;
}

/**
 * Generates step-by-step integer Bresenham line trace for the viva Pixel-Grid Stepper.
 */
export function traceBresenhamLineSteps(
  x0In: number,
  y0In: number,
  x1In: number,
  y1In: number
): RasterStep[] {
  let x0 = Math.round(x0In);
  let y0 = Math.round(y0In);
  const x1 = Math.round(x1In);
  const y1 = Math.round(y1In);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  const steps: RasterStep[] = [];
  let k = 0;

  while (k < 64) {
    const e2 = 2 * err;
    const stepX = e2 > -dy;
    const stepY = e2 < dx;
    steps.push({
      step: k,
      points: [{ x: x0, y: y0 }],
      decisionParam: `err = ${err}, 2·err = ${e2}`,
      formulaNote:
        x0 === x1 && y0 === y1
          ? `Reached endpoint (${x1}, ${y1})`
          : `Plot (${x0}, ${y0}) → next ${stepX ? `x${sx > 0 ? '+1' : '-1'}` : 'x'} ${stepY ? `y${sy > 0 ? '+1' : '-1'}` : 'y'}`,
    });
    if (x0 === x1 && y0 === y1) break;
    if (stepX) {
      err -= dy;
      x0 += sx;
    }
    if (stepY) {
      err += dx;
      y0 += sy;
    }
    k++;
  }
  return steps;
}

/**
 * Generates step-by-step floating-point DDA line trace for comparison with Bresenham.
 */
export function traceDdaLineSteps(
  x0In: number,
  y0In: number,
  x1In: number,
  y1In: number
): RasterStep[] {
  const dx = x1In - x0In;
  const dy = y1In - y0In;
  const totalSteps = Math.max(Math.abs(Math.round(dx)), Math.abs(Math.round(dy)));
  if (totalSteps === 0) {
    return [
      {
        step: 0,
        points: [{ x: Math.round(x0In), y: Math.round(y0In) }],
        decisionParam: 'steps = 0',
        formulaNote: `Single pixel (${Math.round(x0In)}, ${Math.round(y0In)})`,
      },
    ];
  }
  const xInc = dx / totalSteps;
  const yInc = dy / totalSteps;
  let x = x0In;
  let y = y0In;
  const steps: RasterStep[] = [];
  for (let i = 0; i <= totalSteps && i < 64; i++) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    steps.push({
      step: i,
      points: [{ x: rx, y: ry }],
      decisionParam: `x=${x.toFixed(2)}, y=${y.toFixed(2)}`,
      formulaNote: `round(${x.toFixed(2)}, ${y.toFixed(2)}) = (${rx}, ${ry}) · inc=(${xInc.toFixed(2)}, ${yInc.toFixed(2)})`,
    });
    x += xInc;
    y += yInc;
  }
  return steps;
}

/**
 * Generates step-by-step 8-octant Midpoint/Bresenham circle trace for the Pixel-Grid Stepper.
 */
export function traceMidpointCircleSteps(
  cxIn: number,
  cyIn: number,
  rIn: number
): RasterStep[] {
  const cx = Math.round(cxIn);
  const cy = Math.round(cyIn);
  const r = Math.max(1, Math.round(rIn));
  let x = 0;
  let y = r;
  let d = 3 - 2 * r;
  const steps: RasterStep[] = [];
  let k = 0;

  while (x <= y && k < 48) {
    const octants = [
      { x: cx + x, y: cy + y },
      { x: cx - x, y: cy + y },
      { x: cx + x, y: cy - y },
      { x: cx - x, y: cy - y },
      { x: cx + y, y: cy + x },
      { x: cx - y, y: cy + x },
      { x: cx + y, y: cy - x },
      { x: cx - y, y: cy - x },
    ];
    const nextD = d < 0 ? d + 4 * x + 6 : d + 4 * (x - y) + 10;
    steps.push({
      step: k,
      points: octants,
      decisionParam: `d_${k} = ${d}`,
      formulaNote:
        d < 0
          ? `d < 0: keep y=${y}, d_next = d + 4(${x}) + 6 = ${nextD}`
          : `d ≥ 0: decrement y→${y - 1}, d_next = d + 4(${x}-${y}) + 10 = ${nextD}`,
    });
    if (d < 0) {
      d = nextD;
    } else {
      d = nextD;
      y--;
    }
    x++;
    k++;
  }
  return steps;
}

