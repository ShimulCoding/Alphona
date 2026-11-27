import { useState } from 'react';
import { Check, FolderOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { SavedAlponaProject } from '../graphics/projectGallery';

interface ProjectGalleryModalProps {
  open: boolean;
  projects: SavedAlponaProject[];
  currentStrokesCount: number;
  onClose: () => void;
  onSaveCurrent: (name: string) => void;
  onLoadProject: (project: SavedAlponaProject) => void;
  onRenameProject: (id: string, nextName: string) => void;
  onDeleteProject: (id: string) => void;
}

export function ProjectGalleryModal({
  open,
  projects,
  currentStrokesCount,
  onClose,
  onSaveCurrent,
  onLoadProject,
  onRenameProject,
  onDeleteProject,
}: ProjectGalleryModalProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraftName, setEditDraftName] = useState('');

  if (!open) return null;

  const handleSave = () => {
    const label =
      newName.trim() || `Alpona Study ${projects.length + 1}`;
    onSaveCurrent(label);
    setNewName('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Saved Alpona Projects Gallery"
      data-testid="project-gallery-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-zinc-300 bg-[#FAF9F6] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3.5">
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-900">
              Studio Projects Gallery
            </h2>
            <p className="text-xs text-zinc-500">
              Stored locally in your browser (IndexedDB) · {projects.length}{' '}
              {projects.length === 1 ? 'saved artwork' : 'saved artworks'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close projects gallery"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Save Current Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-[#F6F5F1] px-5 py-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder={`Name current canvas (${currentStrokesCount} strokes)…`}
            data-testid="gallery-name-input"
            className="h-9 min-w-[200px] flex-1 rounded-md border border-zinc-300 bg-white px-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#B91C1C] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSave}
            data-testid="gallery-save-current"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#B91C1C] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#991B1B]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Save to Gallery</span>
          </button>
        </div>

        {/* Saved Projects Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white py-12 text-center">
              <FolderOpen
                className="mb-2 h-7 w-7 text-zinc-400"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-zinc-800">
                No saved projects yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-zinc-500">
                Save your current Alpona above to keep multiple festival designs
                organized locally with visual thumbnails.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((proj) => {
                const isEditing = editingId === proj.id;
                const symLabel = `${proj.symmetry.reflect ? 'D' : 'C'}${proj.symmetry.sectors}`;
                const dateLabel = new Date(proj.updatedAt).toLocaleDateString(
                  [],
                  { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                );

                return (
                  <article
                    key={proj.id}
                    data-testid={`gallery-card-${proj.id}`}
                    className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white transition-colors hover:border-zinc-300"
                  >
                    <button
                      type="button"
                      onClick={() => onLoadProject(proj)}
                      className="relative aspect-square w-full overflow-hidden border-b border-zinc-200 bg-zinc-900 text-left focus-visible:outline-2 focus-visible:outline-[#B91C1C]"
                      title={`Open ${proj.name}`}
                    >
                      {proj.thumbnailDataUrl ? (
                        <img
                          src={proj.thumbnailDataUrl}
                          alt={proj.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                          No preview
                        </div>
                      )}
                    </button>

                    <div className="flex flex-1 flex-col justify-between gap-2 p-3">
                      <div>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editDraftName}
                              onChange={(e) => setEditDraftName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  onRenameProject(proj.id, editDraftName);
                                  setEditingId(null);
                                }
                              }}
                              className="h-7 min-w-0 flex-1 rounded border border-zinc-300 px-2 text-xs text-zinc-900 focus:border-[#B91C1C] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onRenameProject(proj.id, editDraftName);
                                setEditingId(null);
                              }}
                              aria-label="Confirm rename"
                              className="inline-flex h-7 w-7 items-center justify-center rounded bg-zinc-900 text-white"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <h3 className="truncate text-sm font-semibold text-zinc-900">
                            {proj.name}
                          </h3>
                        )}
                        <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
                          <span>{symLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{proj.strokesCount} strokes</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{dateLabel}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => onLoadProject(proj)}
                          data-testid={`gallery-open-${proj.id}`}
                          className="inline-flex h-7 flex-1 items-center justify-center rounded border border-zinc-300 bg-zinc-50 text-xs font-medium text-zinc-800 transition-colors hover:border-[#B91C1C] hover:text-[#B91C1C]"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(proj.id);
                            setEditDraftName(proj.name);
                          }}
                          aria-label={`Rename ${proj.name}`}
                          title="Rename project"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete "${proj.name}" from the Projects Gallery? This cannot be undone.`
                              )
                            ) {
                              onDeleteProject(proj.id);
                            }
                          }}
                          data-testid={`gallery-delete-${proj.id}`}
                          aria-label={`Delete ${proj.name}`}
                          title="Delete saved project"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:bg-red-50 hover:text-[#B91C1C]"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
