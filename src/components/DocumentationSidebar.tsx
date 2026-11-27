import { useState } from 'react';
import {
  BookOpen,
  Compass,
  FileText,
  Printer,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  filterDocumentationSteps,
  getDocumentationGuide,
  type DocGuideTab,
} from '../graphics/documentationGuides';

interface DocumentationSidebarProps {
  open: boolean;
  activeTab: DocGuideTab;
  onChangeTab: (tab: DocGuideTab) => void;
  onClose: () => void;
}

export function DocumentationSidebar({
  open,
  activeTab,
  onChangeTab,
  onClose,
}: DocumentationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!open) return null;

  const doc = getDocumentationGuide(activeTab);
  const filteredSteps = filterDocumentationSteps(activeTab, searchQuery);

  return (
    <aside
      aria-label="Engine Documentation Sidebar"
      data-testid="documentation-sidebar"
      data-active-guide={activeTab}
      className="fixed top-12 right-0 bottom-0 z-30 flex w-full max-w-[430px] flex-col border-l border-zinc-300/90 bg-[#EDEBE4] shadow-xl md:top-16"
    >
      {/* Top Document Viewer Toolbar (PDF Reader Chrome) */}
      <div className="flex items-center justify-between border-b border-zinc-300 bg-[#18181B] px-4 py-2.5 text-zinc-100">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-4 w-4 shrink-0 text-[#EF4444]" aria-hidden="true" />
          <div className="truncate">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-zinc-200 uppercase">
              Engine Reference Manual
            </span>
            <span className="mx-1.5 text-zinc-500" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-[10px] text-zinc-400">
              PDF Spec View
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            title="Print current PDF-style specification sheet"
            className="inline-flex h-7 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 text-[11px] font-medium text-zinc-200 transition-colors hover:bg-zinc-700 hover:text-white"
          >
            <Printer className="h-3 w-3" aria-hidden="true" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-documentation-sidebar"
            aria-label="Close documentation sidebar"
            title="Close Documentation Sidebar"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Guide Selector Tabs ("Quick Start" vs "Advanced Techniques") & Search */}
      <div className="border-b border-zinc-300/90 bg-[#F6F5F1] px-3.5 py-2.5 space-y-2">
        <div
          role="tablist"
          aria-label="Documentation guides"
          className="grid grid-cols-2 gap-1.5 rounded-lg border border-zinc-200 bg-zinc-200/60 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'quick-start'}
            data-testid="doc-tab-quick-start"
            onClick={() => onChangeTab('quick-start')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'quick-start'
                ? 'bg-white text-zinc-950 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <Compass className="h-3.5 w-3.5 text-[#B91C1C]" aria-hidden="true" />
            <span>Quick Start</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'advanced-techniques'}
            data-testid="doc-tab-advanced-techniques"
            onClick={() => onChangeTab('advanced-techniques')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'advanced-techniques'
                ? 'bg-white text-zinc-950 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-[#B91C1C]" aria-hidden="true" />
            <span>Advanced Techniques</span>
          </button>
        </div>

        {/* Filter / Search within Guide */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="doc-search-input"
            placeholder={`Search in ${doc.title}...`}
            aria-label="Filter documentation sections"
            className="h-8 w-full rounded-md border border-zinc-300 bg-white pr-3 pl-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Scrollable PDF-Style Folio Document Sheet */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4">
        <article
          data-testid="pdf-document-sheet"
          className="rounded-md border border-zinc-300 bg-white p-5 shadow-sm"
        >
          {/* PDF Header Metadata Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-zinc-900 pb-3">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider text-[#B91C1C] uppercase">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{doc.documentCode}</span>
            </div>
            <div className="font-mono text-[10px] text-zinc-500">
              {doc.edition} · {doc.pageCountLabel}
            </div>
          </div>

          {/* Document Title & Abstract Block */}
          <header className="mt-3.5 border-b border-zinc-200 pb-4">
            <h2
              data-testid="pdf-guide-title"
              className="font-display text-lg font-semibold leading-snug tracking-tight text-zinc-950"
            >
              {doc.title}
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-zinc-600">
              {doc.subtitle}
            </p>
            <div className="mt-3 rounded border-l-2 border-[#B91C1C] bg-[#FAF9F5] px-3 py-2 text-[11px] leading-relaxed text-zinc-700">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-zinc-900 uppercase">
                Abstract —{' '}
              </span>
              {doc.abstractText}
            </div>
          </header>

          {/* Numbered PDF Specification Sections */}
          <div className="mt-4 divide-y divide-zinc-200/80">
            {filteredSteps.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">
                No specification sections match &ldquo;{searchQuery}&rdquo;.
              </p>
            ) : (
              filteredSteps.map((step) => (
                <section
                  key={step.stepNumber}
                  data-testid={`pdf-step-${step.stepNumber}`}
                  className="py-3.5 first:pt-1 last:pb-1"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs font-bold text-[#B91C1C]">
                        §{step.stepNumber}
                      </span>
                      <h3 className="text-xs font-semibold text-zinc-950">
                        {step.title}
                      </h3>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-600">
                    {step.summary}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 rounded bg-zinc-50 px-2.5 py-1.5 font-mono text-[10px]">
                    <span className="font-medium text-zinc-700">
                      {step.specRef}
                    </span>
                    {step.commandOrShortcut && (
                      <span className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-zinc-800">
                        {step.commandOrShortcut}
                      </span>
                    )}
                  </div>
                </section>
              ))
            )}
          </div>

          {/* PDF Folio Footer Stamp */}
          <footer className="mt-5 flex items-center justify-between border-t border-zinc-200 pt-3 font-mono text-[10px] text-zinc-400">
            <span>Alpona Studio Pro</span>
            <span>
              {doc.documentCode} · {doc.pageCountLabel}
            </span>
          </footer>
        </article>
      </div>

      {/* Non-Modal Status Bar */}
      <div className="flex items-center justify-between border-t border-zinc-300 bg-[#F6F5F1] px-4 py-2 text-[11px] text-zinc-600">
        <span>Non-modal viewer — canvas remains live while reading</span>
        <span className="font-mono text-[10px] text-zinc-500">v1.4.2</span>
      </div>
    </aside>
  );
}
