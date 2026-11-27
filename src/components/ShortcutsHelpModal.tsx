import { useState } from 'react';
import { Keyboard, Play, Terminal, X } from 'lucide-react';

interface ShortcutsHelpModalProps {
  open: boolean;
  onClose: () => void;
}

const TOOL_SHORTCUTS: Array<{ key: string; label: string; detail: string }> = [
  { key: 'F', label: 'Freehand Brush', detail: 'Tapered rice-paste calligraphy with Chaikin stabilizer' },
  { key: 'L', label: 'Line Spoke', detail: 'Bresenham / DDA integer line rasterizer with axis snap' },
  { key: 'O', label: 'Midpoint Circle', detail: '8-way symmetric integer Midpoint Circle ring' },
  { key: 'P', label: 'Star / Polygon', detail: 'Regular polygon or concave star with Weiler-Atherton clip' },
  { key: 'C', label: 'Cubic Bézier', detail: 'Parametric de Casteljau curve with P0–P3 handles' },
  { key: 'V', label: 'Transform / Edit', detail: 'On-canvas Move, Scale & Rotate box + Bézier P0–P3 edit' },
  { key: 'B', label: 'Seed Fill', detail: '4-connected scanline flood fill across symmetric sectors' },
  { key: 'E', label: 'Stroke Eraser', detail: 'Lock-aware symmetric hit-test stroke eraser' },
  { key: 'A', label: 'Group Select', detail: 'Click any stroke on canvas to select its entire Layer Group' },
];

const CANVAS_SHORTCUTS: Array<{ key: string; label: string; detail: string }> = [
  { key: '4 / 6 / 8 / 12 / 16', label: 'Radial Sectors', detail: 'Switch dihedral Cₙ / Dₙ rotational symmetry folds' },
  { key: 'R', label: 'Mirror Reflection', detail: 'Toggle dihedral Dₙ mirror reflection across sector axes' },
  { key: 'X', label: 'Symmetry Axes', detail: 'Show/hide dashed radial & mirror reflection axes overlay' },
  { key: 'G', label: 'Concentric Guides', detail: 'Show/hide concentric guide rings (120 / 240 / 330 px)' },
  { key: 'S', label: 'Magnetic Snap', detail: 'Toggle magnetic snap-to-axis & guide ring intersections' },
  { key: 'Space + Drag', label: 'Pan Viewport', detail: 'Pan across zoomed canvas (or two-finger pan on touch)' },
  { key: '+ / - / 0', label: 'Canvas Zoom', detail: 'Zoom 100%–400% anchored at cursor or reset to 100%' },
  { key: 'Ctrl+Z / Ctrl+Y', label: 'Undo / Redo', detail: '40-step snapshot undo/redo (or two-finger tap on tablet)' },
  { key: '?', label: 'Quick Run & Keys', detail: 'Toggle this Quick Run & Keyboard Shortcuts dialog anytime' },
];

export function ShortcutsHelpModal({ open, onClose }: ShortcutsHelpModalProps) {
  const [tab, setTab] = useState<'run' | 'shortcuts'>('run');

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-help-modal-title"
      data-testid="shortcuts-help-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-[#FAF9F5] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
          <div>
            <h2
              id="shortcuts-help-modal-title"
              className="font-display text-lg font-semibold text-zinc-950"
            >
              Quick Run Guide &amp; Studio Shortcuts
            </h2>
            <p className="text-xs text-zinc-500">
              Alpona Studio Pro (v1.4.2) · Complete Web Studio &amp; C++11 OpenGL Desktop Suite
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-shortcuts-help-modal"
            aria-label="Close help dialog"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-zinc-200 bg-white px-5">
          <button
            type="button"
            onClick={() => setTab('run')}
            data-testid="help-tab-run"
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
              tab === 'run'
                ? 'border-[#B91C1C] text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>How to Run (Web Studio &amp; C++11 Desktop)</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('shortcuts')}
            data-testid="help-tab-shortcuts"
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
              tab === 'shortcuts'
                ? 'border-[#B91C1C] text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Keyboard Shortcuts &amp; Controls</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs text-zinc-700">
          {tab === 'run' ? (
            <>
              {/* Option A: Interactive Web Studio */}
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-950">
                    1. Run Full Interactive Web Studio (Exactly as shown here)
                  </span>
                  <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-800">
                    Recommended · Localhost:3000
                  </span>
                </div>
                <p className="mt-1.5 leading-relaxed text-zinc-600">
                  On Windows, simply double-click{' '}
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-900">
                    RUN_STUDIO_WEB.bat
                  </code>{' '}
                  in the project root folder, or run these 2 commands in any terminal (VS Code / PowerShell / Terminal):
                </p>
                <pre className="mt-2.5 overflow-x-auto rounded-md bg-zinc-900 p-3 font-mono text-[11px] leading-relaxed text-zinc-100">
                  <code>{`npm install
npm run dev`}</code>
                </pre>
                <p className="mt-2 text-[11px] text-zinc-500">
                  Then open{' '}
                  <span className="font-mono font-medium text-zinc-800">
                    http://localhost:3000
                  </span>{' '}
                  in your browser. Includes all views: <strong>Studio</strong>,{' '}
                  <strong>Image Lab</strong>, <strong>3D View</strong>,{' '}
                  <strong>Floor &amp; Print</strong>, plus{' '}
                  <strong>C++ &amp; Specs</strong> mode in the top bar.
                </p>
              </div>

              {/* Option B: C++11 OpenGL Desktop App */}
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-950">
                    2. Run C++11 OpenGL / FreeGLUT Desktop Application (Code::Blocks)
                  </span>
                  <span className="rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-700">
                    37-Button Point &amp; Click GUI
                  </span>
                </div>
                <p className="mt-1.5 leading-relaxed text-zinc-600">
                  The native C++11 OpenGL application in{' '}
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-900">
                    cpp-alpona-studio/
                  </code>{' '}
                  now includes a full 37-button point-and-click toolbar &amp; left dock with live{' '}
                  <strong>2D Studio</strong>, <strong>Image Lab NPR</strong>,{' '}
                  <strong>3D Courtyard</strong>, and <strong>Night Diya 3D</strong> views:
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-600">
                  <li>
                    <strong>Windows (Code::Blocks IDE):</strong> Double-click{' '}
                    <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-zinc-900">
                      RUN_CPP_DESKTOP.bat
                    </code>{' '}
                    or open{' '}
                    <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-zinc-900">
                      cpp-alpona-studio/AlponaStudio.cbp
                    </code>{' '}
                    and press <strong>F9 (Build &amp; Run)</strong>.
                  </li>
                  <li>
                    <strong>Linux / macOS Terminal:</strong>{' '}
                    <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-900">
                      cd cpp-alpona-studio &amp;&amp; make &amp;&amp; ./AlponaStudio
                    </code>
                  </li>
                </ul>
              </div>

              {/* Option C: Automated Tests & Headless CLI */}
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 font-semibold text-zinc-950">
                  <Terminal className="h-3.5 w-3.5 text-[#B91C1C]" aria-hidden="true" />
                  <span>3. Verify Automated Unit Tests &amp; Zero-OpenGL Headless C++11 CLI</span>
                </div>
                <pre className="mt-2.5 overflow-x-auto rounded-md bg-zinc-900 p-3 font-mono text-[11px] leading-relaxed text-zinc-100">
                  <code>{`# Run 57/57 TypeScript Graphics Engine Tests
npm test

# Run 45/45 C++11 Unit Tests & Headless AlponaCLI (Zero OpenGL required)
cd cpp-alpona-studio && make test && make cli
./AlponaCLI --motif padma --export-png padma.png --export-svg padma.svg --export-stl padma_pitha.stl --mode pitha`}</code>
                </pre>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <h3 className="mb-2.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                  Drawing &amp; Layer Manipulation Tools
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TOOL_SHORTCUTS.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-start gap-2.5 rounded-md border border-zinc-100 bg-[#FAF9F5] p-2"
                    >
                      <kbd className="inline-flex min-w-[28px] shrink-0 items-center justify-center rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-900 shadow-2xs">
                        {item.key}
                      </kbd>
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900">{item.label}</div>
                        <div className="text-[11px] leading-snug text-zinc-500">
                          {item.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <h3 className="mb-2.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                  Symmetry, Viewport &amp; Snap Shortcuts (Web &amp; C++11 Desktop Parity)
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CANVAS_SHORTCUTS.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-start gap-2.5 rounded-md border border-zinc-100 bg-[#FAF9F5] p-2"
                    >
                      <kbd className="inline-flex shrink-0 items-center justify-center rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-900 shadow-2xs">
                        {item.key}
                      </kbd>
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900">{item.label}</div>
                        <div className="text-[11px] leading-snug text-zinc-500">
                          {item.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 bg-white px-5 py-3 text-xs text-zinc-500">
          <span>
            Press <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-800">?</kbd> anytime to open this guide
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md bg-zinc-900 px-3.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
