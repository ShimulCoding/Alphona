import type { RenderOptions } from './engine';
import { renderUltraHdAlponaCanvas } from './highResExport';
import type { CanvasSurface, DrawOperation } from './types';

export interface TracingStageSpec {
  stageNumber: 1 | 2 | 3 | 4;
  title: string;
  chalkTip: string;
  operations: DrawOperation[];
}

/**
 * Classifies any DrawOperation into one of 4 physical floor-chalking stages:
 *   Stage 1: Center & Compass Circles (tie chalk string to center nail)
 *   Stage 2: Geometric Petals & Spokes (straight chalk lines & diamond/star polygons)
 *   Stage 3: Kalka, Cubic Bézier & Freehand Flourishes (curved folk detailing)
 *   Stage 4: Pigment Fills & Final Accents (rice paste / sindoor / turmeric fills)
 */
export function classifyTracingStage(op: DrawOperation): 1 | 2 | 3 | 4 {
  if (op.kind === 'circle') return 1;
  if (op.kind === 'line' || op.kind === 'polygon') return 2;
  if (op.kind === 'bezier' || op.kind === 'freehand') return 3;
  return 4;
}

export function partitionTracingStages(
  operations: DrawOperation[]
): TracingStageSpec[] {
  const buckets: Record<1 | 2 | 3 | 4, DrawOperation[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
  };

  for (const op of operations) {
    buckets[classifyTracingStage(op)].push(op);
  }

  return [
    {
      stageNumber: 1,
      title: 'Compass Rings & Core',
      chalkTip:
        'Anchor chalk string at the floor center and swing the concentric guide circles first.',
      operations: buckets[1],
    },
    {
      stageNumber: 2,
      title: 'Petals & Radial Spokes',
      chalkTip:
        'Mark sector chord points along each ring, then connect diamond petals and radial lines.',
      operations: buckets[2],
    },
    {
      stageNumber: 3,
      title: 'Kalka, Bézier & Vine Curves',
      chalkTip:
        'Sweep arched Kalka paisleys, Shankha conches, and outer scalloped garlands around the rim.',
      operations: buckets[3],
    },
    {
      stageNumber: 4,
      title: 'Pigment Fills & Finishing',
      chalkTip:
        'Fill interior lotus petals and dots with thick rice paste (Chaler Guro), Sindoor, and Alta.',
      operations: buckets[4],
    },
  ];
}

export interface ProjectorGuideOptions {
  /** Active stage 1..4 (or 0 = show all stages simultaneously) */
  activeStage: 0 | 1 | 2 | 3 | 4;
  /** Pure luminous white on pitch-black #000000 for physical floor/wall mini-projectors */
  darkroomMode: boolean;
  /** Show subtle compass center crosshairs and ring alignment ticks */
  showCompassGuides: boolean;
  /** Vertical keystone compensation angle (-25..+25 deg) for tilted projectors */
  keystoneDeg: number;
}

/**
 * Renders a crisp high-contrast Floor Projector / Step-by-Step Chalk Tracing Guide
 * canvas where prior completed stages appear dimmed and the active physical chalking
 * stage glows brightly so students & home artists can trace layer by layer.
 */
export function renderProjectorGuideCanvas(
  operations: DrawOperation[],
  surface: CanvasSurface,
  logicalSize: number,
  renderOptions: RenderOptions,
  guideOptions: ProjectorGuideOptions,
  outputSize = 720
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = outputSize;
  out.height = outputSize;
  const ctx = out.getContext('2d');
  if (!ctx) return out;

  const stages = partitionTracingStages(operations);

  // Pitch-black background for physical projectors, or dark courtyard slate for tablet tracing
  ctx.fillStyle = guideOptions.darkroomMode ? '#000000' : '#121216';
  ctx.fillRect(0, 0, outputSize, outputSize);

  const pitchBlackSurface: CanvasSurface = {
    ...surface,
    hex: guideOptions.darkroomMode ? '#000000' : '#121216',
    isDark: true,
  };

  if (guideOptions.activeStage === 0) {
    // Full finished pattern in projector contrast
    const fullOps = guideOptions.darkroomMode
      ? operations.map((op) => ({ ...op, color: '#FFFFFF' }))
      : operations;
    const layer = renderUltraHdAlponaCanvas(
      fullOps,
      pitchBlackSurface,
      logicalSize,
      renderOptions,
      outputSize,
      false
    );
    ctx.drawImage(layer, 0, 0);
  } else {
    // 1. Prior completed stages (soft dimmed amber-slate reference)
    const completedOps = stages
      .filter((s) => s.stageNumber < guideOptions.activeStage)
      .flatMap((s) => s.operations)
      .map((op) => ({
        ...op,
        color: guideOptions.darkroomMode ? '#52525B' : '#71717A',
      }));

    if (completedOps.length > 0) {
      const doneCanvas = renderUltraHdAlponaCanvas(
        completedOps,
        pitchBlackSurface,
        logicalSize,
        renderOptions,
        outputSize,
        false
      );
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(doneCanvas, 0, 0);
      ctx.restore();
    }

    // 2. Active stage to chalk RIGHT NOW (luminous bright chalk white / gold!)
    const activeStageSpec = stages.find(
      (s) => s.stageNumber === guideOptions.activeStage
    );
    const activeOps = (activeStageSpec?.operations ?? []).map((op) =>
      guideOptions.darkroomMode
        ? { ...op, color: '#FFFFFF' }
        : op.kind === 'fill'
          ? op
          : { ...op, color: '#FDE68A' }
    );

    if (activeOps.length > 0) {
      const activeCanvas = renderUltraHdAlponaCanvas(
        activeOps,
        pitchBlackSurface,
        logicalSize,
        renderOptions,
        outputSize,
        false
      );
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(activeCanvas, 0, 0);
      ctx.restore();
    }
  }

  // Optional center nail crosshair & concentric 25/50/75/100% chalk-string rings
  if (guideOptions.showCompassGuides) {
    const c = outputSize / 2;
    ctx.save();
    ctx.strokeStyle = guideOptions.darkroomMode
      ? 'rgba(239, 68, 68, 0.72)'
      : 'rgba(248, 113, 113, 0.55)';
    ctx.lineWidth = Math.max(1, outputSize / 520);
    ctx.setLineDash([6, 6]);
    for (const frac of [0.22, 0.44, 0.66, 0.88]) {
      ctx.beginPath();
      ctx.arc(c, c, (outputSize / 2) * frac, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Center nail (+) target
    const arm = Math.max(10, outputSize * 0.025);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = Math.max(1.5, outputSize / 360);
    ctx.beginPath();
    ctx.moveTo(c - arm, c);
    ctx.lineTo(c + arm, c);
    ctx.moveTo(c, c - arm);
    ctx.lineTo(c, c + arm);
    ctx.stroke();
    ctx.restore();
  }

  return out;
}
