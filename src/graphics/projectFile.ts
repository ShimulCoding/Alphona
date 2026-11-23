import {
  DEFAULT_TRANSFORM_2D,
  type CanvasSurfaceId,
  type ClippingWindowConfig,
  type DrawOperation,
  type LineAlgorithm,
  type SymmetryConfig,
  type Transform2DConfig,
} from './types';

export interface AlponaProjectFile {
  format: 'alpona-studio-v2';
  savedAt: string;
  surfaceId: CanvasSurfaceId;
  symmetry: SymmetryConfig;
  lineAlgorithm: LineAlgorithm;
  clippingWindow: ClippingWindowConfig;
  transform2D: Transform2DConfig;
  operations: DrawOperation[];
}

export function serializeAlponaProject(
  payload: Omit<AlponaProjectFile, 'format' | 'savedAt'>
): string {
  const doc: AlponaProjectFile = {
    format: 'alpona-studio-v2',
    savedAt: new Date().toISOString(),
    ...payload,
  };
  return JSON.stringify(doc, null, 2);
}

export function parseAlponaProject(rawJson: string): AlponaProjectFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Invalid JSON file. Please select a valid .alpona.json file.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Project file must contain a JSON object.');
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.operations)) {
    throw new Error('Missing operations array in Alpona project file.');
  }

  const validSurfaces: CanvasSurfaceId[] = [
    'courtyard',
    'terracotta',
    'indigo',
    'paper',
  ];
  const surfaceId = validSurfaces.includes(obj.surfaceId as CanvasSurfaceId)
    ? (obj.surfaceId as CanvasSurfaceId)
    : 'courtyard';

  const symRaw = (obj.symmetry ?? {}) as Record<string, unknown>;
  const sectors =
    typeof symRaw.sectors === 'number'
      ? Math.max(3, Math.min(16, Math.round(symRaw.sectors)))
      : 8;
  const reflect = typeof symRaw.reflect === 'boolean' ? symRaw.reflect : true;

  const lineAlgorithm: LineAlgorithm =
    obj.lineAlgorithm === 'dda' ? 'dda' : 'bresenham';

  const clipRaw = (obj.clippingWindow ?? {}) as Record<string, unknown>;
  const clippingWindow: ClippingWindowConfig = {
    enabled: Boolean(clipRaw.enabled),
    inset:
      typeof clipRaw.inset === 'number'
        ? Math.max(40, Math.min(210, clipRaw.inset))
        : 110,
    algorithm:
      clipRaw.algorithm === 'liang-barsky' ? 'liang-barsky' : 'cohen-sutherland',
    polygonAlgorithm:
      clipRaw.polygonAlgorithm === 'weiler-atherton'
        ? 'weiler-atherton'
        : 'sutherland-hodgman',
  };

  const tRaw = (obj.transform2D ?? {}) as Record<string, unknown>;
  const transform2D: Transform2DConfig = {
    translateX:
      typeof tRaw.translateX === 'number'
        ? tRaw.translateX
        : DEFAULT_TRANSFORM_2D.translateX,
    translateY:
      typeof tRaw.translateY === 'number'
        ? tRaw.translateY
        : DEFAULT_TRANSFORM_2D.translateY,
    scaleX:
      typeof tRaw.scaleX === 'number' ? tRaw.scaleX : DEFAULT_TRANSFORM_2D.scaleX,
    scaleY:
      typeof tRaw.scaleY === 'number' ? tRaw.scaleY : DEFAULT_TRANSFORM_2D.scaleY,
    rotateDeg:
      typeof tRaw.rotateDeg === 'number'
        ? tRaw.rotateDeg
        : DEFAULT_TRANSFORM_2D.rotateDeg,
    shearX:
      typeof tRaw.shearX === 'number' ? tRaw.shearX : DEFAULT_TRANSFORM_2D.shearX,
    shearY:
      typeof tRaw.shearY === 'number' ? tRaw.shearY : DEFAULT_TRANSFORM_2D.shearY,
    flipX: Boolean(tRaw.flipX),
    flipY: Boolean(tRaw.flipY),
  };

  return {
    format: 'alpona-studio-v2',
    savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : new Date().toISOString(),
    surfaceId,
    symmetry: { sectors, reflect },
    lineAlgorithm,
    clippingWindow,
    transform2D,
    operations: obj.operations as DrawOperation[],
  };
}
