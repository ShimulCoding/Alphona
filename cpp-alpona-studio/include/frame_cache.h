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
};

} // namespace alpona

#endif // ALPONA_FRAME_CACHE_H
