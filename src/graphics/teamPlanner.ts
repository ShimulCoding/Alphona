import type { PixelSurface } from './rasterizer';
import { ALPONA_PALETTE, hexToRgba } from './types';

/**
 * Team Floor Planner — splits a large alpona (Shaheed Minar, Pohela Boishakh road art)
 * into sections that separate teams paint at the same time, and estimates each team's
 * painted area and paint per colour from the rendered pixels.
 *
 *  - 'sectors': pie slices around the centre, numbered clockwise from 12 o'clock
 *    (suits round, radially symmetric alpona).
 *  - 'strips': horizontal bands from top to bottom (suits long floors and roads).
 *
 * Pixels are classified like the Floor Blueprint: a pixel within 24 RGB steps of the
 * floor colour is bare floor, otherwise it counts towards the nearest palette pigment.
 * C++11 twin: cpp-alpona-studio/src/team_planner.cpp.
 */
export type TeamSplitMode = 'sectors' | 'strips';

export interface TeamPlanConfig {
  diameterCm: number; // real width (= height) of the square design on the floor, 40..600
  teams: number; // 1..24
  mode: TeamSplitMode;
  paintMlPerSqM?: number; // default 175 mL of rice paste / paint per m2
}

export interface TeamPigment {
  name: string;
  bengali: string;
  hex: string;
  areaSqM: number;
  paintMl: number;
}

export interface TeamSection {
  team: number; // 1-based
  label: string;
  areaSqM: number;
  paintMl: number;
  pigments: TeamPigment[];
  startDeg?: number; // sectors: clockwise from 12 o'clock
  endDeg?: number;
  startCm?: number; // strips: distance from the top edge
  endCm?: number;
}

export interface TeamPlan {
  mode: TeamSplitMode;
  diameterCm: number;
  paintMlPerSqM: number;
  teams: TeamSection[];
  totalAreaSqM: number;
  totalPaintMl: number;
}

export const TEAM_PLAN_MIN_TEAMS = 1;
export const TEAM_PLAN_MAX_TEAMS = 24;
export const DEFAULT_PAINT_ML_PER_SQ_M = 175;
const BACKGROUND_TOLERANCE = 24;

export function clampTeamCount(teams: number): number {
  return Math.max(TEAM_PLAN_MIN_TEAMS, Math.min(TEAM_PLAN_MAX_TEAMS, Math.round(teams) || 1));
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** Which team (0-based) paints the pixel (x, y), judged at the pixel centre. */
export function teamIndexForPixel(
  x: number,
  y: number,
  width: number,
  height: number,
  teams: number,
  mode: TeamSplitMode
): number {
  const n = clampTeamCount(teams);
  if (mode === 'strips') {
    return Math.min(n - 1, Math.floor(((y + 0.5) / height) * n));
  }
  const dx = x + 0.5 - width / 2;
  const dy = y + 0.5 - height / 2;
  let angle = Math.atan2(dx, -dy); // 0 at 12 o'clock, growing clockwise
  if (angle < 0) angle += 2 * Math.PI;
  return Math.min(n - 1, Math.floor(angle / ((2 * Math.PI) / n)));
}

export function computeTeamPlan(
  surface: PixelSurface,
  backgroundHex: string,
  config: TeamPlanConfig
): TeamPlan {
  const teams = clampTeamCount(config.teams);
  const diameterCm = Math.max(40, Math.min(600, config.diameterCm));
  const mlPerSqM = Math.max(1, config.paintMlPerSqM ?? DEFAULT_PAINT_ML_PER_SQ_M);
  const { width, height, data } = surface;
  const pixelSqM = ((diameterCm / 100) * (diameterCm / 100)) / (width * height);

  const bg = hexToRgba(backgroundHex);
  const swatches = ALPONA_PALETTE.map((sw) => ({ ...sw, rgb: hexToRgba(sw.hex) }));
  const counts: number[][] = Array.from({ length: teams }, () => new Array(swatches.length).fill(0));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b) < BACKGROUND_TOLERANCE) continue;
      let best = 0;
      let bestDist = Infinity;
      for (let s = 0; s < swatches.length; s++) {
        const c = swatches[s].rgb;
        const d = Math.abs(r - c.r) + Math.abs(g - c.g) + Math.abs(b - c.b);
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      counts[teamIndexForPixel(x, y, width, height, teams, config.mode)][best]++;
    }
  }

  const sections: TeamSection[] = counts.map((row, t) => {
    const pigments: TeamPigment[] = row
      .map((count, s) => ({ count, s }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count || a.s - b.s)
      .map(({ count, s }) => {
        const areaSqM = round4(count * pixelSqM);
        return {
          name: swatches[s].name,
          bengali: swatches[s].bengali,
          hex: swatches[s].hex,
          areaSqM,
          paintMl: Math.round(areaSqM * mlPerSqM),
        };
      });
    const painted = row.reduce((sum, c) => sum + c, 0);
    const section: TeamSection = {
      team: t + 1,
      label: `Team ${t + 1}`,
      areaSqM: round4(painted * pixelSqM),
      paintMl: pigments.reduce((sum, p) => sum + p.paintMl, 0),
      pigments,
    };
    if (config.mode === 'sectors') {
      section.startDeg = round4((360 * t) / teams);
      section.endDeg = round4((360 * (t + 1)) / teams);
    } else {
      section.startCm = round4((diameterCm * t) / teams);
      section.endCm = round4((diameterCm * (t + 1)) / teams);
    }
    return section;
  });

  return {
    mode: config.mode,
    diameterCm,
    paintMlPerSqM: mlPerSqM,
    teams: sections,
    totalAreaSqM: round4(sections.reduce((sum, t) => sum + t.areaSqM, 0)),
    totalPaintMl: sections.reduce((sum, t) => sum + t.paintMl, 0),
  };
}

/** CSV in the same format as AlponaCLI --export-team-plan (one row per team and colour). */
export function exportTeamPlanCsv(plan: TeamPlan): string {
  const rows = ['team,colour,area_m2,paint_ml'];
  for (const team of plan.teams) {
    for (const p of team.pigments) {
      rows.push(`${team.label},${p.name},${p.areaSqM.toFixed(4)},${p.paintMl}`);
    }
    rows.push(`${team.label},All colours,${team.areaSqM.toFixed(4)},${team.paintMl}`);
  }
  rows.push(`Total,,${plan.totalAreaSqM.toFixed(4)},${plan.totalPaintMl}`);
  return rows.join('\n') + '\n';
}

/** Where to draw team t's number on a size x size preview: the middle of its section. */
export function teamLabelAnchor(
  team: number,
  teams: number,
  mode: TeamSplitMode,
  size: number
): { x: number; y: number } {
  const n = clampTeamCount(teams);
  const t = Math.max(0, Math.min(n - 1, team));
  if (mode === 'strips') {
    return { x: size / 2, y: ((t + 0.5) / n) * size };
  }
  const angle = ((t + 0.5) / n) * 2 * Math.PI;
  const r = size * 0.3;
  return { x: size / 2 + r * Math.sin(angle), y: size / 2 - r * Math.cos(angle) };
}
