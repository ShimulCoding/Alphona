import type { DrawOperation } from './types';

export const UNDO_HISTORY_LIMIT = 40;

/**
 * Pushes the current drawing onto the Undo stack before it is replaced by a template,
 * a gallery project or a loaded .alpona file, so Undo can bring it back.
 * An empty canvas has nothing to lose and adds no snapshot.
 */
export function pushUndoSnapshot(
  past: DrawOperation[][],
  current: DrawOperation[],
  limit = UNDO_HISTORY_LIMIT
): DrawOperation[][] {
  if (current.length === 0) return past;
  return [...past, current].slice(-Math.max(1, limit));
}
