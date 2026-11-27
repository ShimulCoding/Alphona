#ifndef ALPONA_FRAME_CACHE_H
#define ALPONA_FRAME_CACHE_H

#include "canvas_buffer.h"
#include "motifs.h"
#include <cstdint>
#include <vector>

namespace alpona {

/**
 * Committed Framebuffer Cache (60fps Software Rasterization):
 * Caches the rasterized RGBA base buffer for the committed `history` vector
 * so live mouse/stylus drag previews (`composeWithPreview`) copy the cached
 * base in O(W*H) memory copy and rasterize ONLY the active preview operation.
 */
class CommittedFrameCache {
public:
    CommittedFrameCache();

    void invalidate();

    void render(
        CanvasBuffer& target,
        Color bgColor,
        const std::vector<DrawOperation>& history,
        uint64_t historyRevision,
        const DrawOperation* previewOp = nullptr
    );

    // Use after operations were only appended to `history` (new stroke, fill, redo): the
    // cached operations are unchanged, so only history[cachedSize..] is drawn on the cached
    // base. Falls back to a full render() when the base cannot be reused.
    void appendCommitted(CanvasBuffer& target, Color bgColor,
                         const std::vector<DrawOperation>& history, uint64_t historyRevision);
    int incrementalAppends() const { return incrementalAppends_; }
    // Use for undo / redo: restores the stored frame of a recent history length when one
    // exists, otherwise appends (history grew) or fully re-renders.
    void jumpToCommitted(CanvasBuffer& target, Color bgColor,
                         const std::vector<DrawOperation>& history, uint64_t historyRevision);
    int snapshotRestores() const { return snapshotRestores_; }

    int cacheHits() const { return cacheHits_; }
    int fullRebuilds() const { return fullRebuilds_; }
    bool isValid() const { return hasBase_; }

private:
    CanvasBuffer baseBuffer_;
    bool hasBase_;
    int cachedWidth_;
    int cachedHeight_;
    Color cachedBg_;
    uint64_t cachedRevision_;
    size_t cachedHistorySize_;
    int cacheHits_;
    int fullRebuilds_;
    int incrementalAppends_;
    int snapshotRestores_;

    // Frames of recent history lengths along the current undo/redo branch.
    struct Snapshot {
        size_t historySize;
        uint64_t lastOpFingerprint;  // guards against a different branch of the same length
        std::vector<uint8_t> pixels;
    };
    std::vector<Snapshot> snapshots_;
    void storeSnapshot(const std::vector<DrawOperation>& history);
};

} // namespace alpona

#endif // ALPONA_FRAME_CACHE_H
