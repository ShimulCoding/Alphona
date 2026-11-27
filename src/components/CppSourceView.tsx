import { useState } from 'react';
import { Check, Copy, GitCommitHorizontal, Terminal } from 'lucide-react';
import {
  CPP_PROJECT_FILES,
  GIT_COMMIT_CYCLES,
  GIT_PUSH_SCRIPTS,
} from '../data/cppProjectFiles';

interface CppSourceViewProps {
  onReturnToStudio: () => void;
}

export function CppSourceView({ onReturnToStudio }: CppSourceViewProps) {
  const [selectedFileId, setSelectedFileId] = useState(CPP_PROJECT_FILES[0].id);
  const [scriptPlatform, setScriptPlatform] = useState<'bash' | 'powershell'>('bash');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeFile =
    CPP_PROJECT_FILES.find((f) => f.id === selectedFileId) ??
    CPP_PROJECT_FILES[0];

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Clipboard API may be restricted in some preview frames
    }
  };

  return (
    <div className="mx-auto max-w-[1220px] space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div className="max-w-2xl space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-950">
            C++11 OpenGL Desktop GUI, Headless CLI &amp; 68-Cycle Alternating Git Workflow
          </h1>
          <p className="text-sm leading-relaxed text-zinc-600">
            Complete C++11 / OpenGL / FreeGLUT point-and-click desktop studio application plus the
            standalone zero-OpenGL <span className="font-mono text-zinc-900">AlponaCLI</span>{' '}
            batch pipeline covering Core Subsystems I–VI, 37-Button Multi-View OpenGL Desktop GUI, Branded Startup Splash Transition, Non-Modal PDF Documentation Sidebar, Committed Framebuffer Caching, Universal Layer Transform,
            Horizontal &amp; Vertical Mirror Reflection, Collapsible Layer Group
            Categories, Group-Select Tool, Porter-Duff Per-Layer Opacity &amp; Lock,
            Stylus Pressure, Multi-Touch Gestures, IndexedDB Projects Gallery,
            2× Retina Preview, 3D .STL Pitha Molds, Jamdani Weave Charts, L-System
            Composer, and Natural Media NPR — packaged as 68 modular alternating
            milestone commits for{' '}
            <span className="font-mono text-zinc-900">
              ShimulCoding/Alphona
            </span>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={onReturnToStudio}
          className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
        >
          Back to Canvas
        </button>
      </div>

      {/* Interactive C++ Code Explorer */}
      <section aria-label="C++ source files">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">
            C++11 &amp; FreeGLUT Implementation{' '}
            <code className="font-mono text-sm font-normal text-zinc-500">
              cpp-alpona-studio/
            </code>
          </h2>
          <span className="text-xs text-zinc-500">
            Verified with g++ -std=c++11 -Wall -Wextra · 43/43 C++11 unit tests &amp; AlponaCLI passing
          </span>
        </div>

        <div className="grid overflow-hidden rounded-lg border border-zinc-200 bg-white lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* File list */}
          <div className="border-b border-zinc-200 bg-zinc-50/70 p-2 lg:border-r lg:border-b-0">
            <div className="space-y-1">
              {CPP_PROJECT_FILES.map((file) => {
                const active = file.id === activeFile.id;
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setSelectedFileId(file.id)}
                    className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                      active
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-700 hover:bg-zinc-200/60 hover:text-zinc-950'
                    }`}
                  >
                    <div className="font-mono text-xs font-medium">
                      {file.label}
                    </div>
                    <div
                      className={`mt-0.5 truncate text-[11px] ${
                        active ? 'text-zinc-300' : 'text-zinc-500'
                      }`}
                    >
                      {file.owner}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Code Viewer */}
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold text-zinc-900">
                  {activeFile.path}
                </div>
                <div className="text-xs text-zinc-500">{activeFile.role}</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(activeFile.content, activeFile.id)}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
              >
                {copiedId === activeFile.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy File</span>
                  </>
                )}
              </button>
            </div>

            <pre className="max-h-[480px] overflow-auto bg-[#16161B] p-4 font-mono text-xs leading-relaxed text-zinc-100">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Git Commit Cycles & Push Script */}
      <section aria-label="Git commit cycles and GitHub push workflow" className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              68-Cycle Alternating Git Commit &amp; Push Workflow{' '}
              <code className="font-mono text-sm font-normal text-zinc-500">
                ShimulCoding/Alphona
              </code>
            </h2>
            <p className="mt-1 text-xs text-zinc-600">
              Structured modular milestone commits attributing pair-programmed
              subsystems evenly — Odd cycles (1, 3, 5, …, 65, 67):{' '}
              <span className="font-mono text-zinc-900">
                ShimulCoding &lt;shimulc17@gmail.com&gt;
              </span>{' '}
              · Even cycles (2, 4, 6, …, 66, 68):{' '}
              <span className="font-mono text-zinc-900">
                dipro20debnath &lt;diprodebnath200@gmail.com&gt;
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setScriptPlatform('bash')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                scriptPlatform === 'bash'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Codespaces / Git Bash
            </button>
            <button
              type="button"
              onClick={() => setScriptPlatform('powershell')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                scriptPlatform === 'powershell'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Windows PowerShell
            </button>
          </div>
        </div>

        {/* Commit Cycles Timeline (2x5 balanced grid for 10 alternating cycles) */}
        <div className="grid gap-3 sm:grid-cols-2">
          {GIT_COMMIT_CYCLES.map((cycle) => {
            const isShimul = cycle.authorHandle === 'ShimulCoding';
            return (
              <div
                key={cycle.cycle}
                className="rounded-lg border border-zinc-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    className={`flex items-center gap-1.5 font-mono text-xs font-semibold ${
                      isShimul ? 'text-[#B91C1C]' : 'text-zinc-900'
                    }`}
                  >
                    <GitCommitHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Cycle {cycle.cycle}</span>
                    <span className="text-zinc-400">·</span>
                    <span>{cycle.authorHandle}</span>
                  </div>
                  <span className="font-mono text-[11px] text-zinc-500">
                    {cycle.schedule}
                  </span>
                </div>
                <div className="mt-1.5 text-xs font-semibold text-zinc-900">
                  {cycle.title}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
                  {cycle.scope}
                </p>
                <div className="mt-2 font-mono text-[11px] text-zinc-500">
                  Author: {cycle.authorHandle} &lt;{cycle.authorEmail}&gt;
                </div>
              </div>
            );
          })}
        </div>

        {/* Copyable Push Script */}
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
            <div className="flex items-center gap-2 font-mono text-xs font-medium text-zinc-800">
              <Terminal className="h-4 w-4 text-zinc-500" aria-hidden="true" />
              <span>
                {scriptPlatform === 'bash'
                  ? 'cpp-alpona-studio/push_to_github.sh'
                  : 'cpp-alpona-studio/push_to_github.ps1'}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  GIT_PUSH_SCRIPTS[scriptPlatform],
                  `script-${scriptPlatform}`
                )
              }
              className="inline-flex h-8 items-center gap-1.5 rounded border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
            >
              {copiedId === `script-${scriptPlatform}` ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Copied Script</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Script</span>
                </>
              )}
            </button>
          </div>
          <pre className="max-h-[340px] overflow-auto bg-[#16161B] p-4 font-mono text-xs leading-relaxed text-zinc-100">
            <code>{GIT_PUSH_SCRIPTS[scriptPlatform]}</code>
          </pre>
        </div>
      </section>
    </div>
  );
}
