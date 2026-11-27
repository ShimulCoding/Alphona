import { sampleCubicBezier } from './bezier';
import type { RenderOptions } from './engine';
import {
  applyMat3,
  buildHomogeneousTransform2D,
  generateSymmetricPoints,
  generateSymmetricPolygons,
  generateSymmetricSegments,
  isIdentityTransform2D,
} from './transforms';
import {
  DEFAULT_TRANSFORM_2D,
  type CanvasSurface,
  type DrawOperation,
  type Point2D,
} from './types';

function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates an infinite-resolution, standalone Vector SVG document from Alpona Studio's
 * geometric command stack (Lines, Midpoint Circles, Polygons, Freehand paths, and
 * native Cubic Bezier `<path d="M ... C ...">`), preserving all C_n/D_n symmetry and
 * 3x3 homogeneous 2D transforms. Ready for Cricut/vinyl cutters, laser engravers & print banners.
 */
export function generateAlponaSvg(
  operations: DrawOperation[],
  surface: CanvasSurface,
  canvasSize: number,
  options: RenderOptions = {},
  optionsExtra: { includeBackground?: boolean; monochromeCutLines?: boolean } = {}
): string {
  const includeBackground = optionsExtra.includeBackground ?? true;
  const monochromeCutLines = optionsExtra.monochromeCutLines ?? false;
  const center: Point2D = { x: canvasSize / 2, y: canvasSize / 2 };
  const transform2D = options.transform2D ?? DEFAULT_TRANSFORM_2D;
  const mat3 = isIdentityTransform2D(transform2D)
    ? null
    : buildHomogeneousTransform2D(transform2D, center);
  const xf = (pt: Point2D): Point2D => (mat3 ? applyMat3(mat3, pt) : pt);

  const elements: string[] = [];

  if (includeBackground) {
    elements.push(
      `  <rect x="0" y="0" width="${canvasSize}" height="${canvasSize}" fill="${escapeXml(
        monochromeCutLines ? '#FFFFFF' : surface.hex
      )}" />`
    );
  }

  for (const op of operations) {
    if (op.hidden || op.kind === 'fill') continue;
    const strokeColor = monochromeCutLines ? '#111111' : op.color;
    const strokeW = Math.max(1, op.thickness);
    const opacityAttr =
      !monochromeCutLines &&
      typeof op.opacity === 'number' &&
      op.opacity < 0.995
        ? ` stroke-opacity="${fmt(Math.max(0.1, Math.min(1, op.opacity)))}"`
        : '';

    if (op.kind === 'line') {
      const copies = generateSymmetricSegments(op.p0, op.p1, center, op.symmetry);
      for (const seg of copies) {
        const a = xf(seg.p0);
        const b = xf(seg.p1);
        elements.push(
          `  <line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(
            b.y
          )}" stroke="${escapeXml(strokeColor)}"${opacityAttr} stroke-width="${fmt(
            strokeW
          )}" stroke-linecap="round" />`
        );
      }
    } else if (op.kind === 'circle') {
      const centers = generateSymmetricPoints(op.center, center, op.symmetry);
      const seen = new Set<string>();
      const avgScale =
        (Math.abs(transform2D.scaleX) + Math.abs(transform2D.scaleY)) / 2;
      for (const cPt of centers) {
        const key = `${Math.round(cPt.x)},${Math.round(cPt.y)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const tc = xf(cPt);
        elements.push(
          `  <circle cx="${fmt(tc.x)}" cy="${fmt(tc.y)}" r="${fmt(
            op.radius * avgScale
          )}" fill="none" stroke="${escapeXml(strokeColor)}"${opacityAttr} stroke-width="${fmt(
            strokeW
          )}" />`
        );
      }
    } else if (op.kind === 'polygon') {
      const polys = generateSymmetricPolygons(op.vertices, center, op.symmetry);
      for (const poly of polys) {
        const ptsAttr = poly
          .map((p) => {
            const tp = xf(p);
            return `${fmt(tp.x)},${fmt(tp.y)}`;
          })
          .join(' ');
        elements.push(
          `  <polygon points="${ptsAttr}" fill="none" stroke="${escapeXml(
            strokeColor
          )}"${opacityAttr} stroke-width="${fmt(strokeW)}" stroke-linejoin="round" />`
        );
      }
    } else if (op.kind === 'freehand') {
      if (op.points.length < 2) continue;
      const n = Math.max(1, Math.round(op.symmetry.sectors));
      const basePts = op.points;
      for (let k = 0; k < n; k++) {
        const theta = (2 * Math.PI * k) / n;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const rot = (p: Point2D): Point2D => {
          const dx = p.x - center.x;
          const dy = p.y - center.y;
          return xf({
            x: center.x + dx * cosT - dy * sinT,
            y: center.y + dx * sinT + dy * cosT,
          });
        };
        const dRot = basePts
          .map((p, idx) => {
            const rp = rot(p);
            return `${idx === 0 ? 'M' : 'L'}${fmt(rp.x)} ${fmt(rp.y)}`;
          })
          .join(' ');
        elements.push(
          `  <path d="${dRot}" fill="none" stroke="${escapeXml(
            strokeColor
          )}"${opacityAttr} stroke-width="${fmt(strokeW)}" stroke-linecap="round" stroke-linejoin="round" />`
        );
        if (op.symmetry.reflect) {
          const dRef = basePts
            .map((p, idx) => {
              const mirrored: Point2D = { x: 2 * center.x - p.x, y: p.y };
              const rp = rot(mirrored);
              return `${idx === 0 ? 'M' : 'L'}${fmt(rp.x)} ${fmt(rp.y)}`;
            })
            .join(' ');
          elements.push(
            `  <path d="${dRef}" fill="none" stroke="${escapeXml(
              strokeColor
            )}"${opacityAttr} stroke-width="${fmt(strokeW)}" stroke-linecap="round" stroke-linejoin="round" />`
          );
        }
      }
    } else if (op.kind === 'bezier') {
      const n = Math.max(1, Math.round(op.symmetry.sectors));
      for (let k = 0; k < n; k++) {
        const theta = (2 * Math.PI * k) / n;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const rot = (p: Point2D): Point2D => {
          const dx = p.x - center.x;
          const dy = p.y - center.y;
          return xf({
            x: center.x + dx * cosT - dy * sinT,
            y: center.y + dx * sinT + dy * cosT,
          });
        };
        const b0 = rot(op.p0);
        const b1 = rot(op.p1);
        const b2 = rot(op.p2);
        const b3 = rot(op.p3);
        elements.push(
          `  <path d="M ${fmt(b0.x)} ${fmt(b0.y)} C ${fmt(b1.x)} ${fmt(
            b1.y
          )}, ${fmt(b2.x)} ${fmt(b2.y)}, ${fmt(b3.x)} ${fmt(
            b3.y
          )}" fill="none" stroke="${escapeXml(strokeColor)}"${opacityAttr} stroke-width="${fmt(
            strokeW
          )}" stroke-linecap="round" />`
        );
        if (op.symmetry.reflect) {
          const mir = (p: Point2D): Point2D => rot({ x: 2 * center.x - p.x, y: p.y });
          const m0 = mir(op.p0);
          const m1 = mir(op.p1);
          const m2 = mir(op.p2);
          const m3 = mir(op.p3);
          elements.push(
            `  <path d="M ${fmt(m0.x)} ${fmt(m0.y)} C ${fmt(m1.x)} ${fmt(
              m1.y
            )}, ${fmt(m2.x)} ${fmt(m2.y)}, ${fmt(m3.x)} ${fmt(
              m3.y
            )}" fill="none" stroke="${escapeXml(strokeColor)}"${opacityAttr} stroke-width="${fmt(
              strokeW
            )}" stroke-linecap="round" />`
          );
        }
      }
      void sampleCubicBezier;
    }
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}" width="${canvasSize}" height="${canvasSize}">`,
    `  <title>Alpona Studio — Vector Artwork</title>`,
    `  <desc>Generated by Alpona Studio (Commercial 2D/3D Vector &amp; Raster Design Suite)</desc>`,
    ...elements,
    `</svg>`,
  ].join('\n');
}

export function downloadAlponaSvg(
  svgString: string,
  filename = 'alpona-studio-vector.svg'
): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
