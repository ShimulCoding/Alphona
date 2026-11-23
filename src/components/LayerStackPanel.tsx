import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  Lock,
  Move,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import {
  areAllGroupsCollapsed,
  describeOperation,
  getLayerGroupAccent,
  groupOperationsByCategory,
  LAYER_GROUP_PRESETS,
  listOperationGroups,
  setAllGroupsCollapsed,
  toggleGroupCollapsed,
} from '../graphics/layerStack';
import type { DrawOperation } from '../graphics/types';

interface LayerStackPanelProps {
  operations: DrawOperation[];
  activeColor: string;
  selectedLayerId: string | null;
  selectedGroupName: string | null;
  selectedGroupLayerIds: string[];
  onClearGroupSelection?: () => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onChangeOpacity: (id: string, opacity: number) => void;
  onToggleGroupVisibility: (group: string) => void;
  onAssignGroup: (id: string, nextGroup: string) => void;
  onEditLayer: (id: string) => void;
  onShowAll: () => void;
  onMoveOrder: (id: string, direction: 'up' | 'down') => void;
  onRecolor: (id: string, colorHex: string) => void;
  onDelete: (id: string) => void;
}

function slugifyGroup(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function LayerStackPanel({
  operations,
  activeColor,
  selectedLayerId,
  selectedGroupName,
  selectedGroupLayerIds,
  onClearGroupSelection,
  onToggleVisibility,
  onToggleLock,
  onChangeOpacity,
  onToggleGroupVisibility,
  onAssignGroup,
  onEditLayer,
  onShowAll,
  onMoveOrder,
  onRecolor,
  onDelete,
}: LayerStackPanelProps) {
  const [groupFilter, setGroupFilter] = useState<string>('All');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set()
  );
  const [opacityExpandedId, setOpacityExpandedId] = useState<string | null>(
    null
  );

  // Auto-expand the group containing a newly selected layer so it stays immediately editable
  useEffect(() => {
    if (!selectedLayerId) return;
    const target = operations.find((op) => op.id === selectedLayerId);
    if (!target) return;
    const grpName = target.group && target.group.trim() ? target.group.trim() : 'Motifs';
    setCollapsedGroups((prev) => {
      if (!prev.has(grpName)) return prev;
      const next = new Set(prev);
      next.delete(grpName);
      return next;
    });
  }, [selectedLayerId, operations]);

  // Auto-expand, reveal, and scroll into view a group selected on canvas via the Group Select tool
  useEffect(() => {
    if (!selectedGroupName) return;
    setCollapsedGroups((prev) => {
      if (!prev.has(selectedGroupName)) return prev;
      const next = new Set(prev);
      next.delete(selectedGroupName);
      return next;
    });
    setGroupFilter((cur) =>
      cur !== 'All' && cur !== selectedGroupName ? 'All' : cur
    );
    const slug = slugifyGroup(selectedGroupName);
    const raf = window.requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-testid="layer-group-section-${slug}"]`
      );
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [selectedGroupName]);

  const hiddenCount = operations.filter((op) => op.hidden).length;
  const visibleCount = operations.length - hiddenCount;
  const groups = listOperationGroups(operations);
  const sections = groupOperationsByCategory(operations, groupFilter);
  const sectionNames = sections.map((s) => s.name);
  const allCollapsed = areAllGroupsCollapsed(collapsedGroups, sectionNames);
  const selectedGroupIdSet = new Set(selectedGroupLayerIds);

  const cycleGroup = (currentGroup: string | undefined): string => {
    const cur = currentGroup ?? 'Motifs';
    const idx = (LAYER_GROUP_PRESETS as readonly string[]).indexOf(cur);
    if (idx < 0) return LAYER_GROUP_PRESETS[0];
    return LAYER_GROUP_PRESETS[(idx + 1) % LAYER_GROUP_PRESETS.length];
  };

  const handleSelectGroupFilter = (nextFilter: string) => {
    setGroupFilter(nextFilter);
    if (nextFilter !== 'All') {
      setCollapsedGroups((prev) => {
        if (!prev.has(nextFilter)) return prev;
        const next = new Set(prev);
        next.delete(nextFilter);
        return next;
      });
    }
  };

  return (
    <div className="p-5" data-testid="layer-stack-panel">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">Stroke Layers</h2>
        <div className="flex items-center gap-2 text-xs">
          <span
            data-testid="layer-stack-count"
            className="font-mono tabular-nums text-zinc-500"
          >
            {visibleCount}/{operations.length} visible
          </span>
          {sections.length > 0 && (
            <button
              type="button"
              data-testid="layers-collapse-all-btn"
              onClick={() =>
                setCollapsedGroups(
                  setAllGroupsCollapsed(sectionNames, !allCollapsed)
                )
              }
              aria-label={
                allCollapsed
                  ? 'Expand all layer groups'
                  : 'Collapse all layer groups'
              }
              title={
                allCollapsed
                  ? 'Expand all group categories'
                  : 'Collapse all group categories'
              }
              className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900"
            >
              {allCollapsed ? (
                <ChevronsUpDown className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ChevronsDownUp className="h-3 w-3" aria-hidden="true" />
              )}
              <span>{allCollapsed ? 'Expand all' : 'Collapse all'}</span>
            </button>
          )}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={onShowAll}
              className="font-medium text-[#B91C1C] hover:underline"
            >
              Show all
            </button>
          )}
        </div>
      </div>

      {/* Named Ring Group Filter + Quick Group Visibility Bar */}
      {groups.length > 0 && (
        <div className="mb-3 space-y-1.5" data-testid="layer-groups-bar">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => handleSelectGroupFilter('All')}
              aria-pressed={groupFilter === 'All'}
              className={`h-7 rounded border px-2 text-[11px] font-medium transition-colors ${
                groupFilter === 'All'
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
              }`}
            >
              All ({operations.length})
            </button>
            {groups.map((grp) => {
              const active = groupFilter === grp.name;
              const allHidden = grp.visible === 0;
              const accent = getLayerGroupAccent(grp.name);
              return (
                <div
                  key={grp.name}
                  className="inline-flex items-center overflow-hidden rounded border border-zinc-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectGroupFilter(grp.name)}
                    data-testid={`group-filter-${slugifyGroup(grp.name)}`}
                    aria-pressed={active}
                    className={`inline-flex h-7 items-center gap-1.5 px-2 text-[11px] font-medium transition-colors ${
                      active
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-1 shrink-0 rounded-[1px]"
                      style={{ backgroundColor: accent }}
                    />
                    <span>{grp.name}</span>
                    <span className="font-mono text-[10px] opacity-75">
                      {grp.visible}/{grp.total}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleGroupVisibility(grp.name)}
                    data-testid={`group-visibility-toggle-${slugifyGroup(grp.name)}`}
                    aria-label={`${allHidden ? 'Show' : 'Hide'} ${grp.name} group`}
                    title={`${allHidden ? 'Show' : 'Hide'} all strokes in ${grp.name}`}
                    className={`inline-flex h-7 w-6 items-center justify-center border-l border-zinc-200 transition-colors ${
                      allHidden
                        ? 'bg-zinc-100 text-zinc-400 hover:text-zinc-700'
                        : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {allHidden ? (
                      <EyeOff className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Eye className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {operations.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/70 px-3 py-3 text-xs text-zinc-500">
          No strokes yet. Draw on the canvas or pick a starter motif to manage
          individual rings here.
        </p>
      ) : (
        <div className="max-h-[360px] space-y-2.5 overflow-y-auto pr-1">
          {sections.map((section) => {
            const slug = slugifyGroup(section.name);
            const isCollapsed = collapsedGroups.has(section.name);
            const allGroupHidden = section.visible === 0;
            const isGroupSelected = selectedGroupName === section.name;
            const panelId = `layer-group-panel-${slug}`;

            return (
              <section
                key={section.name}
                data-testid={`layer-group-section-${slug}`}
                data-group-name={section.name}
                data-collapsed={isCollapsed ? 'true' : 'false'}
                data-group-selected={isGroupSelected ? 'true' : 'false'}
                className={`rounded-md overflow-hidden transition-colors ${
                  isGroupSelected
                    ? 'border-2 shadow-xs'
                    : 'border border-zinc-200/90 bg-zinc-50/60'
                }`}
                style={
                  isGroupSelected
                    ? {
                        borderColor: section.accentHex,
                        backgroundColor: `${section.accentHex}0D`,
                      }
                    : undefined
                }
              >
                {/* Collapsible Group Category Header with Color-Coded Accent Bar */}
                <div
                  className={`flex items-center justify-between gap-1.5 border-l-[3px] px-2 py-1.5 transition-colors ${
                    allGroupHidden
                      ? 'bg-zinc-100/80 text-zinc-500'
                      : isGroupSelected
                        ? 'text-zinc-950'
                        : 'bg-white/95 text-zinc-900'
                  } ${isCollapsed ? '' : 'border-b border-zinc-200/80'}`}
                  style={{
                    borderLeftColor: section.accentHex,
                    backgroundColor:
                      isGroupSelected && !allGroupHidden
                        ? `${section.accentHex}1A`
                        : undefined,
                  }}
                >
                  <button
                    type="button"
                    data-testid={`group-collapse-toggle-${slug}`}
                    aria-expanded={!isCollapsed}
                    aria-controls={panelId}
                    onClick={() =>
                      setCollapsedGroups((prev) =>
                        toggleGroupCollapsed(prev, section.name)
                      )
                    }
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight
                        className="h-3.5 w-3.5 shrink-0 text-zinc-500"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronDown
                        className="h-3.5 w-3.5 shrink-0 text-zinc-500"
                        aria-hidden="true"
                      />
                    )}
                    {isCollapsed ? (
                      <Folder
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: section.accentHex }}
                        aria-hidden="true"
                      />
                    ) : (
                      <FolderOpen
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: section.accentHex }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate text-xs font-semibold text-zinc-900">
                      {section.name}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-zinc-500">
                      {section.visible}/{section.total}
                    </span>
                    {section.lockedCount > 0 && (
                      <Lock
                        className="h-2.5 w-2.5 shrink-0 text-zinc-400"
                        aria-label={`${section.lockedCount} locked in ${section.name}`}
                      />
                    )}
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    {isGroupSelected && (
                      <span
                        data-testid={`group-selected-indicator-${slug}`}
                        className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none"
                        style={{
                          borderColor: `${section.accentHex}80`,
                          color: section.accentHex,
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        Selected
                        {onClearGroupSelection && (
                          <button
                            type="button"
                            onClick={onClearGroupSelection}
                            aria-label={`Clear ${section.name} group selection`}
                            title="Clear group selection"
                            className="ml-0.5 inline-flex items-center justify-center rounded hover:opacity-70"
                          >
                            <X className="h-2.5 w-2.5" aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    )}
                    {isCollapsed && (
                      <span className="font-mono text-[10px] text-zinc-400">
                        Collapsed
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleGroupVisibility(section.name)}
                      aria-label={`${allGroupHidden ? 'Show' : 'Hide'} ${section.name} category`}
                      title={`${allGroupHidden ? 'Show' : 'Hide'} all ${section.total} layers in ${section.name}`}
                      className={`inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 transition-colors ${
                        allGroupHidden
                          ? 'bg-zinc-100 text-zinc-400 hover:text-zinc-700'
                          : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      {allGroupHidden ? (
                        <EyeOff className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Eye className="h-3 w-3" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Indented Member Layers with Continuous Group Connector Rail */}
                {!isCollapsed && (
                  <div
                    id={panelId}
                    data-testid={`group-items-${slug}`}
                    className="py-1.5 pl-2 pr-1.5"
                  >
                    <div
                      className="space-y-1.5 border-l-2 pl-1.5"
                      style={{ borderLeftColor: `${section.accentHex}66` }}
                    >
                      {section.entries.map(({ op, index }) => {
                        const meta = describeOperation(op, index);
                        const isTop = index === operations.length - 1;
                        const isBottom = index === 0;
                        const isHidden = Boolean(op.hidden);
                        const isLocked = Boolean(op.locked);
                        const opacityPct = Math.round((op.opacity ?? 1) * 100);
                        const groupLabel = op.group ?? 'Motifs';
                        const isSelected = selectedLayerId === op.id;
                        const isInSelectedGroup = selectedGroupIdSet.has(op.id);
                        const showOpacitySlider =
                          opacityExpandedId === op.id || isSelected;

                        return (
                          <div
                            key={op.id}
                            data-testid={`layer-row-${index}`}
                            data-group={groupLabel}
                            data-locked={isLocked ? 'true' : 'false'}
                            data-opacity={opacityPct}
                            data-group-selected={isInSelectedGroup ? 'true' : 'false'}
                            className={`rounded-md border px-1.5 py-1.5 text-xs transition-colors ${
                              isSelected
                                ? 'border-[#B91C1C] bg-red-50/35'
                                : isInSelectedGroup
                                  ? 'shadow-[inset_3px_0_0_var(--grp-accent)]'
                                  : isHidden
                                    ? 'border-zinc-200/80 bg-zinc-50/80 opacity-60'
                                    : 'border-zinc-200/90 bg-white hover:border-zinc-300'
                            }`}
                            style={
                              !isSelected && isInSelectedGroup
                                ? ({
                                    '--grp-accent': section.accentHex,
                                    borderColor: `${section.accentHex}99`,
                                    backgroundColor: `${section.accentHex}14`,
                                  } as React.CSSProperties)
                                : undefined
                            }
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => onToggleVisibility(op.id)}
                                  aria-label={`${isHidden ? 'Show' : 'Hide'} ${meta.title}`}
                                  aria-pressed={!isHidden}
                                  title={
                                    isHidden
                                      ? 'Show stroke layer'
                                      : 'Hide stroke layer'
                                  }
                                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                                >
                                  {isHidden ? (
                                    <EyeOff
                                      className="h-3 w-3 text-zinc-400"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Eye
                                      className="h-3 w-3 text-zinc-800"
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onRecolor(op.id, activeColor)}
                                  disabled={isLocked}
                                  aria-label={`Recolor ${meta.title} with active pigment`}
                                  title={
                                    isLocked
                                      ? 'Layer is locked'
                                      : `Click to recolor with active pigment (${activeColor})`
                                  }
                                  className="h-3.5 w-3.5 shrink-0 rounded-sm border border-black/25 transition-transform hover:scale-110 disabled:opacity-45"
                                  style={{
                                    backgroundColor: op.color,
                                    opacity: op.opacity ?? 1,
                                  }}
                                />

                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <div
                                    className={`truncate text-[11px] font-medium leading-tight ${
                                      isHidden
                                        ? 'line-through text-zinc-500'
                                        : 'text-zinc-900'
                                    }`}
                                  >
                                    {meta.title}
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-1 overflow-hidden text-[10px] leading-none text-zinc-400">
                                    <span className="shrink-0 font-mono">
                                      {meta.symmetryTag}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpacityExpandedId((cur) =>
                                          cur === op.id ? null : op.id
                                        )
                                      }
                                      data-testid={`layer-opacity-toggle-${index}`}
                                      title="Adjust layer opacity"
                                      className={`shrink-0 font-mono hover:text-[#B91C1C] hover:underline ${
                                        opacityPct < 100
                                          ? 'font-semibold text-[#B91C1C]'
                                          : 'text-zinc-500'
                                      }`}
                                    >
                                      {opacityPct}%
                                    </button>
                                    <span aria-hidden="true">·</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onAssignGroup(
                                          op.id,
                                          cycleGroup(op.group)
                                        )
                                      }
                                      title={`Group: ${groupLabel}. Click to move to ${cycleGroup(op.group)}`}
                                      className="truncate font-mono text-zinc-500 hover:text-[#B91C1C] hover:underline"
                                    >
                                      →{cycleGroup(op.group)}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => onEditLayer(op.id)}
                                  disabled={isLocked}
                                  data-testid={`transform-layer-${index}`}
                                  aria-label={`Transform or edit ${meta.title}`}
                                  title={
                                    op.kind === 'bezier'
                                      ? 'Edit P0–P3 Bézier handles'
                                      : 'Move, scale, or rotate this layer on canvas'
                                  }
                                  className={`inline-flex h-5 w-5 items-center justify-center rounded transition-colors disabled:opacity-30 ${
                                    isSelected
                                      ? 'bg-[#B91C1C] text-white'
                                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-[#B91C1C]'
                                  }`}
                                >
                                  <Move
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onToggleLock(op.id)}
                                  data-testid={`lock-layer-${index}`}
                                  aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${meta.title}`}
                                  aria-pressed={isLocked}
                                  title={
                                    isLocked
                                      ? 'Unlock layer (currently protected from erase/edit)'
                                      : 'Lock layer to protect from accidental erase or edits'
                                  }
                                  className={`inline-flex h-5 w-5 items-center justify-center rounded transition-colors ${
                                    isLocked
                                      ? 'bg-zinc-900 text-white'
                                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                                  }`}
                                >
                                  {isLocked ? (
                                    <Lock
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Unlock
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onMoveOrder(op.id, 'up')}
                                  disabled={isTop}
                                  aria-label={`Move ${meta.title} up`}
                                  title="Bring forward"
                                  className="inline-flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30"
                                >
                                  <ArrowUp
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onMoveOrder(op.id, 'down')}
                                  disabled={isBottom}
                                  aria-label={`Move ${meta.title} down`}
                                  title="Send backward"
                                  className="inline-flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30"
                                >
                                  <ArrowDown
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDelete(op.id)}
                                  disabled={isLocked}
                                  aria-label={`Delete ${meta.title}`}
                                  title={
                                    isLocked
                                      ? 'Unlock layer to delete'
                                      : 'Delete this stroke layer'
                                  }
                                  className="inline-flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-red-50 hover:text-[#B91C1C] disabled:opacity-30"
                                >
                                  <Trash2
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                </button>
                              </div>
                            </div>

                            {showOpacitySlider && (
                              <div className="mt-1.5 flex items-center gap-2 border-t border-zinc-100 pt-1.5">
                                <span className="text-[10px] font-medium text-zinc-500">
                                  Opacity
                                </span>
                                <input
                                  type="range"
                                  min={10}
                                  max={100}
                                  step={5}
                                  disabled={isLocked}
                                  value={opacityPct}
                                  onChange={(e) =>
                                    onChangeOpacity(
                                      op.id,
                                      Number(e.target.value) / 100
                                    )
                                  }
                                  data-testid={`layer-opacity-slider-${index}`}
                                  aria-label={`Opacity for ${meta.title}`}
                                  className="h-1 flex-1 accent-[#B91C1C] disabled:opacity-40"
                                />
                                <span className="w-8 text-right font-mono text-[10px] tabular-nums text-zinc-700">
                                  {opacityPct}%
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
