import { Download, FlaskConical, FolderOpen } from 'lucide-react';

export type StudioView =
  | 'studio'
  | 'image-lab'
  | '3d-view'
  | 'floor-print'
  | 'algorithms'
  | 'cpp';

interface HeaderBarProps {
  activeView: StudioView;
  labMode: boolean;
  savedProjectsCount: number;
  onChangeView: (view: StudioView) => void;
  onToggleLabMode: () => void;
  onOpenGallery: () => void;
  onExportPng: () => void;
}

const NAV_ITEMS: Array<{
  id: StudioView;
  label: string;
  mobileLabel: string;
  academicOnly?: boolean;
}> = [
  { id: 'studio', label: 'Studio', mobileLabel: 'Studio' },
  { id: 'image-lab', label: 'Image Lab', mobileLabel: 'Image' },
  { id: '3d-view', label: '3D View', mobileLabel: '3D' },
  { id: 'floor-print', label: 'Floor & Print', mobileLabel: 'Floor' },
  {
    id: 'algorithms',
    label: 'Algorithms',
    mobileLabel: 'Algo',
    academicOnly: true,
  },
  { id: 'cpp', label: 'C++ & Git', mobileLabel: 'C++', academicOnly: true },
];

export function HeaderBar({
  activeView,
  labMode,
  savedProjectsCount,
  onChangeView,
  onToggleLabMode,
  onOpenGallery,
  onExportPng,
}: HeaderBarProps) {
  const visibleNav = NAV_ITEMS.filter((item) => labMode || !item.academicOnly);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/90 bg-[#F6F5F1]/95 backdrop-blur-sm">
      {/* Primary Bar */}
      <div className="mx-auto flex h-12 max-w-[1360px] items-center justify-between gap-2 px-3 sm:px-6 md:h-16 lg:px-8">
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            onChangeView('studio');
          }}
          className="font-display text-base font-semibold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 md:text-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B91C1C]"
        >
          Alpona Studio
        </a>

        {/* Desktop Centered Navigation */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-4 md:flex lg:gap-6"
        >
          {visibleNav.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B91C1C] ${
                  isActive
                    ? 'text-zinc-950'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute right-0 bottom-0 left-0 h-0.5 bg-[#B91C1C]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenGallery}
            data-testid="open-projects-gallery"
            title="Open local multi-project IndexedDB gallery"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950 whitespace-nowrap shrink-0 md:h-9 md:px-3"
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Projects</span>
            {savedProjectsCount > 0 && (
              <span className="font-mono text-[10px] text-zinc-500">
                {savedProjectsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleLabMode}
            data-testid="toggle-lab-mode"
            aria-pressed={labMode}
            title={
              labMode
                ? 'CSE 401/402 Lab Mode active — click for distraction-free Artist Mode'
                : 'Artist Mode active — click to show CSE 401/402 Lab controls & C++ tabs'
            }
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 md:h-9 md:px-3 ${
              labMode
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950'
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden lg:inline">
              {labMode ? 'Lab Mode' : 'Artist Mode'}
            </span>
          </button>

          <button
            type="button"
            onClick={onExportPng}
            aria-label="Export 4K PNG"
            title="Export 4K Ultra-HD (2880 × 2880 px) anti-aliased PNG"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#B91C1C] px-2.5 text-xs font-medium text-white transition-colors hover:bg-[#991B1B] active:scale-[0.99] whitespace-nowrap shrink-0 md:h-9 md:gap-2 md:px-3.5 md:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C]"
          >
            <Download className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />
            <span>
              Export<span className="hidden sm:inline"> 4K PNG</span>
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Compact Navigation Bar (Zero Horizontal Overflow at 390px) */}
      <nav
        aria-label="Mobile navigation"
        className="flex items-center justify-between border-t border-zinc-200/80 px-3 md:hidden"
      >
        {visibleNav.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative py-2.5 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C] ${
                isActive ? 'text-zinc-950' : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {item.mobileLabel}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute right-0 bottom-0 left-0 h-0.5 bg-[#B91C1C]"
                />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
