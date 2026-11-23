import type { PixelSurface } from './rasterizer';
import { rgbaEqual, type RGBA } from './types';

/**
 * Iterative scanline seed-fill (flood fill) with strict canvas bounds checking.
 * Uses an explicit stack (no recursion) so large regions never overflow the call stack.
 * Returns the exact number of pixels filled.
 */
export function iterativeSeedFill(
  surface: PixelSurface,
  seedXInput: number,
  seedYInput: number,
  fillColor: RGBA
): number {
  const { width, height, data } = surface;
  const sx = Math.round(seedXInput);
  const sy = Math.round(seedYInput);

  if (sx < 0 || sx >= width || sy < 0 || sy >= height) {
    return 0;
  }

  const startOffset = (sy * width + sx) * 4;
  const targetColor: RGBA = {
    r: data[startOffset],
    g: data[startOffset + 1],
    b: data[startOffset + 2],
    a: data[startOffset + 3],
  };

  // No-op if target pixel already matches fill color
  if (
    targetColor.r === fillColor.r &&
    targetColor.g === fillColor.g &&
    targetColor.b === fillColor.b &&
    targetColor.a === fillColor.a
  ) {
    return 0;
  }

  // Span-based iterative flood fill (fast and strictly bounded to width * height)
  const stack: number[] = [sx, sy];
  let filledCount = 0;

  const matchesTarget = (x: number, y: number): boolean => {
    const off = (y * width + x) * 4;
    return rgbaEqual(data, off, targetColor);
  };

  const setPixel = (x: number, y: number): void => {
    const off = (y * width + x) * 4;
    data[off] = fillColor.r;
    data[off + 1] = fillColor.g;
    data[off + 2] = fillColor.b;
    data[off + 3] = fillColor.a;
  };

  while (stack.length > 0) {
    const y = stack.pop()!;
    let x = stack.pop()!;

    if (y < 0 || y >= height || x < 0 || x >= width) {
      continue;
    }
    if (!matchesTarget(x, y)) {
      continue;
    }

    // Move to the leftmost pixel of this horizontal span
    while (x > 0 && matchesTarget(x - 1, y)) {
      x--;
    }

    let spanAbove = false;
    let spanBelow = false;

    while (x < width && matchesTarget(x, y)) {
      setPixel(x, y);
      filledCount++;

      if (y > 0) {
        const aboveMatches = matchesTarget(x, y - 1);
        if (!spanAbove && aboveMatches) {
          stack.push(x, y - 1);
          spanAbove = true;
        } else if (spanAbove && !aboveMatches) {
          spanAbove = false;
        }
      }

      if (y < height - 1) {
        const belowMatches = matchesTarget(x, y + 1);
        if (!spanBelow && belowMatches) {
          stack.push(x, y + 1);
          spanBelow = true;
        } else if (spanBelow && !belowMatches) {
          spanBelow = false;
        }
      }

      x++;
    }
  }

  return filledCount;
}
