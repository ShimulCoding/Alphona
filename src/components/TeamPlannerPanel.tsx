import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Users } from 'lucide-react';
import type { PixelSurface } from '../graphics/rasterizer';
import {
  DEFAULT_PAINT_ML_PER_SQ_M,
  TEAM_PLAN_MAX_TEAMS,
  TEAM_PLAN_MIN_TEAMS,
  clampTeamCount,
  computeTeamPlan,
  exportTeamPlanCsv,
  teamLabelAnchor,
  type TeamPlan,
  type TeamSplitMode,
} from '../graphics/teamPlanner';
import type { CanvasSurface } from '../graphics/types';

interface TeamPlannerPanelProps {
  studioSurface: PixelSurface;
  surface: CanvasSurface;
}

const FLOOR_PRESETS = [
  { label: '6 ft', cm: 180 },
  { label: '10 ft', cm: 300 },
  { label: '15 ft', cm: 460 },
  { label: '20 ft', cm: 600 },
];

/** Draws the design with section lines and big team numbers; `highlight` dims the others. */
function drawTeamOverlay(
  ctx: CanvasRenderingContext2D,
  studioSurface: PixelSurface,
  plan: TeamPlan,
  size: number,
  highlight: number | null
): void {
  const src = document.createElement('canvas');
  src.width = studioSurface.width;
  src.height = studioSurface.height;
  const sctx = src.getContext('2d');
  if (!sctx) return;
  const img = sctx.createImageData(studioSurface.width, studioSurface.height);
  img.data.set(studioSurface.data);
  sctx.putImageData(img, 0, 0);
  ctx.drawImage(src, 0, 0, size, size);

  const n = plan.teams.length;
  const c = size / 2;
  const sectionPath = (t: number) => {
    ctx.beginPath();
    if (plan.mode === 'strips') {
      ctx.rect(0, (t / n) * size, size, size / n);
    } else {
      const a0 = (t / n) * 2 * Math.PI - Math.PI / 2;
      const a1 = ((t + 1) / n) * 2 * Math.PI - Math.PI / 2;
      ctx.moveTo(c, c);
      ctx.arc(c, c, size, a0, a1);
      ctx.closePath();
    }
  };

  if (highlight !== null) {
    for (let t = 0; t < n; t++) {
      if (t === highlight) continue;
      sectionPath(t);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(10,10,12,0.62)';
      ctx.fillRect(0, 0, size, size);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = Math.max(2, size / 240);
  ctx.setLineDash([size / 60, size / 90]);
  if (n > 1) {
    for (let t = 0; t < n; t++) {
      ctx.beginPath();
      if (plan.mode === 'strips') {
        if (t === 0) continue;
        const y = (t / n) * size;
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
      } else {
        const a = (t / n) * 2 * Math.PI;
        ctx.moveTo(c, c);
        ctx.lineTo(c + size * Math.sin(a), c - size * Math.cos(a));
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  const radius = Math.max(14, Math.min(size / 14, size / (n + 2)));
  ctx.font = `600 ${Math.round(radius)}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let t = 0; t < n; t++) {
    const p = teamLabelAnchor(t, n, plan.mode, size);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 0.85, 0, 2 * Math.PI);
    ctx.fillStyle = t === highlight ? '#B91C1C' : 'rgba(24,24,27,0.88)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#F59E0B';
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(String(t + 1), p.x, p.y + 1);
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function TeamPlannerPanel({ studioSurface, surface }: TeamPlannerPanelProps) {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const [teams, setTeams] = useState(6);
  const [mode, setMode] = useState<TeamSplitMode>('sectors');
  const [diameterCm, setDiameterCm] = useState(300);
  const [mlPerSqM, setMlPerSqM] = useState(DEFAULT_PAINT_ML_PER_SQ_M);
  const [highlight, setHighlight] = useState<number | null>(null);

  const plan = useMemo(
    () => computeTeamPlan(studioSurface, surface.hex, { diameterCm, teams, mode, paintMlPerSqM: mlPerSqM }),
    [studioSurface, surface.hex, diameterCm, teams, mode, mlPerSqM]
  );
  const activeHighlight = highlight !== null && highlight < plan.teams.length ? highlight : null;

  useEffect(() => {
    const canvas = previewRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawTeamOverlay(ctx, studioSurface, plan, canvas.width, activeHighlight);
  }, [studioSurface, plan, activeHighlight]);

  const unitLabel = (cm: number) => `${(cm / 100).toFixed(2)} m (${(cm / 30.48).toFixed(1)} ft)`;
  const sectionText = (t: TeamPlan['teams'][number]) =>
    plan.mode === 'sectors'
      ? `${t.startDeg}°–${t.endDeg}° clockwise from top`
      : `${((t.startCm ?? 0) / 100).toFixed(2)}–${((t.endCm ?? 0) / 100).toFixed(2)} m from top`;

  const downloadTeamSheet = () => {
    const W = 1240;
    const rowH = 30;
    const rows = plan.teams.reduce((sum, t) => sum + Math.max(1, t.pigments.length), 0);
    const H = 170 + 760 + 60 + rows * rowH + plan.teams.length * 14 + 80;
    const sheet = document.createElement('canvas');
    sheet.width = W;
    sheet.height = H;
    const ctx = sheet.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#18181B';
    ctx.font = '700 40px "Inter", system-ui, sans-serif';
    ctx.fillText('Alpona Studio — Team Floor Plan', 60, 80);
    ctx.font = '400 22px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#52525B';
    ctx.fillText(
      `${plan.teams.length} teams · ${plan.mode === 'sectors' ? 'pie-slice sectors, clockwise from top' : 'strips from the top edge'} · floor ${unitLabel(plan.diameterCm)} square`,
      60,
      120
    );
    ctx.fillText(
      `Painted area ${plan.totalAreaSqM.toFixed(2)} m² · paint ${(plan.totalPaintMl / 1000).toFixed(2)} L at ${plan.paintMlPerSqM} mL/m²`,
      60,
      152
    );

    const tile = document.createElement('canvas');
    tile.width = 720;
    tile.height = 720;
    const tctx = tile.getContext('2d');
    if (tctx) drawTeamOverlay(tctx, studioSurface, plan, 720, null);
    ctx.drawImage(tile, (W - 720) / 2, 180, 720, 720);

    let y = 960;
    ctx.font = '700 22px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#18181B';
    ctx.fillText('Team', 60, y);
    ctx.fillText('Section', 200, y);
    ctx.fillText('Colour', 560, y);
    ctx.fillText('Area (m²)', 840, y);
    ctx.fillText('Paint (mL)', 1020, y);
    y += 14;
    ctx.fillStyle = '#E4E4E7';
    ctx.fillRect(60, y, W - 120, 2);
    y += 30;
    ctx.font = '400 20px "Inter", system-ui, sans-serif';
    for (const t of plan.teams) {
      ctx.fillStyle = '#18181B';
      ctx.font = '600 20px "Inter", system-ui, sans-serif';
      ctx.fillText(t.label, 60, y);
      ctx.font = '400 20px "Inter", system-ui, sans-serif';
      ctx.fillStyle = '#52525B';
      ctx.fillText(sectionText(t), 200, y);
      const lines = t.pigments.length > 0 ? t.pigments : null;
      if (!lines) {
        ctx.fillText('— nothing to paint', 560, y);
        y += rowH;
      } else {
        for (const p of lines) {
          ctx.fillStyle = p.hex;
          ctx.fillRect(560, y - 15, 18, 18);
          ctx.strokeStyle = '#A1A1AA';
          ctx.strokeRect(560, y - 15, 18, 18);
          ctx.fillStyle = '#18181B';
          ctx.fillText(p.name, 588, y);
          ctx.fillText(p.areaSqM.toFixed(3), 840, y);
          ctx.fillText(String(p.paintMl), 1020, y);
          y += rowH;
        }
      }
      ctx.fillStyle = '#F4F4F5';
      ctx.fillRect(60, y - 18, W - 120, 1);
      y += 14;
    }
    ctx.font = '700 22px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#B91C1C';
    ctx.fillText(`Total: ${plan.totalAreaSqM.toFixed(2)} m² · ${plan.totalPaintMl} mL`, 60, y + 20);

    sheet.toBlob((blob) => {
      if (blob) downloadBlob(blob, `alpona-team-plan-${plan.teams.length}-teams.png`);
    }, 'image/png');
  };

  const downloadCsv = () => {
    downloadBlob(
      new Blob([exportTeamPlanCsv(plan)], { type: 'text/csv;charset=utf-8' }),
      `alpona-team-plan-${plan.teams.length}-teams.csv`
    );
  };

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_390px]" data-testid="team-planner">
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-xs">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-zinc-900">Team Floor Plan</h2>
          <p className="text-xs text-zinc-500">
            Split a large alpona so several teams paint at once — like the Shaheed Minar or Pohela
            Boishakh road alpona. Click a team on the right to highlight its section.
          </p>
        </div>
        <canvas
          ref={previewRef}
          width={720}
          height={720}
          aria-label="Alpona with team sections"
          className="mx-auto block aspect-square w-full max-w-[600px] rounded-lg border border-zinc-200"
        />
      </div>

      <aside className="space-y-4">
        <div className="space-y-3 rounded-xl border border-zinc-200/90 bg-white p-4 shadow-xs">
          <label htmlFor="team-count" className="block space-y-1">
            <span className="flex items-baseline justify-between text-xs font-medium text-zinc-600">
              Teams
              <span className="font-mono tabular-nums text-zinc-900">{plan.teams.length}</span>
            </span>
            <input
              id="team-count"
              type="range"
              min={TEAM_PLAN_MIN_TEAMS}
              max={TEAM_PLAN_MAX_TEAMS}
              value={teams}
              onChange={(e) => setTeams(clampTeamCount(Number(e.target.value)))}
              className="w-full accent-[#B91C1C]"
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-zinc-600">Split into</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['sectors', 'Sectors (round)'],
                  ['strips', 'Strips (long floor)'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  aria-pressed={mode === id}
                  className={`h-8 rounded border text-xs font-medium transition-colors ${
                    mode === id
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="team-floor-cm" className="mb-1 flex items-baseline justify-between text-xs font-medium text-zinc-600">
              Design width on the floor
              <span className="font-mono text-[11px] text-zinc-500">{unitLabel(plan.diameterCm)}</span>
            </label>
            <div className="flex gap-1.5">
              <input
                id="team-floor-cm"
                type="number"
                min={40}
                max={600}
                value={diameterCm}
                onChange={(e) => setDiameterCm(Number(e.target.value) || 40)}
                className="h-8 w-20 rounded border border-zinc-300 px-2 font-mono text-xs tabular-nums"
              />
              <span className="self-center text-xs text-zinc-500">cm</span>
              {FLOOR_PRESETS.map((p) => (
                <button
                  key={p.cm}
                  type="button"
                  onClick={() => setDiameterCm(p.cm)}
                  className="h-8 rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <label htmlFor="team-ml" className="block space-y-1">
            <span className="flex items-baseline justify-between text-xs font-medium text-zinc-600">
              Paint coverage
              <span className="font-mono text-[11px] text-zinc-500">mL per m²</span>
            </span>
            <input
              id="team-ml"
              type="number"
              min={20}
              max={2000}
              value={mlPerSqM}
              onChange={(e) => setMlPerSqM(Math.max(1, Number(e.target.value) || DEFAULT_PAINT_ML_PER_SQ_M))}
              className="h-8 w-full rounded border border-zinc-300 px-2 font-mono text-xs tabular-nums"
            />
          </label>
        </div>

        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-xs">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
              <Users className="h-4 w-4 text-[#B91C1C]" aria-hidden="true" />
              Teams
            </h3>
            <span className="font-mono text-[11px] text-zinc-600" data-testid="team-plan-total">
              {plan.totalAreaSqM.toFixed(2)} m² · {(plan.totalPaintMl / 1000).toFixed(2)} L
            </span>
          </div>
          <ul className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
            {plan.teams.map((t, idx) => (
              <li key={t.team}>
                <button
                  type="button"
                  onClick={() => setHighlight(activeHighlight === idx ? null : idx)}
                  aria-pressed={activeHighlight === idx}
                  data-testid={`team-row-${t.team}`}
                  className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                    activeHighlight === idx
                      ? 'border-[#B91C1C] bg-red-50'
                      : 'border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-zinc-900">{t.label}</span>
                    <span className="font-mono tabular-nums text-zinc-700">
                      {t.areaSqM.toFixed(3)} m² · {t.paintMl} mL
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">{sectionText(t)}</div>
                  {t.pigments.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-1">
                      {t.pigments.map((p) => (
                        <span key={p.hex} className="inline-flex items-center gap-1 text-[11px] text-zinc-600">
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 rounded-full border border-zinc-300"
                            style={{ backgroundColor: p.hex }}
                          />
                          {p.name} {p.paintMl} mL
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={downloadTeamSheet}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#B91C1C] px-3 text-xs font-medium text-white hover:bg-[#991B1B]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Team Sheet PNG
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
              Paint List CSV
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
