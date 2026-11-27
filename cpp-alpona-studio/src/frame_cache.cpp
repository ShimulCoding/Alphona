#include "frame_cache.h"
#include <cstring>

namespace alpona {

CommittedFrameCache::CommittedFrameCache()
    : baseBuffer_(1, 1),
      hasBase_(false),
      cachedWidth_(0),
      cachedHeight_(0),
      cachedBg_{0, 0, 0, 255},
      cachedRevision_(0),
      cachedHistorySize_(0),
      cacheHits_(0),
      fullRebuilds_(0),
      incrementalAppends_(0) {}

void CommittedFrameCache::invalidate() {
    hasBase_ = false;
}

void CommittedFrameCache::render(
    CanvasBuffer& target,
    Color bgColor,
    const std::vector<DrawOperation>& history,
    uint64_t historyRevision,
    const DrawOperation* previewOp
) {
    const int w = target.width();
    const int h = target.height();

    const bool valid =
        hasBase_ &&
        cachedWidth_ == w &&
        cachedHeight_ == h &&
        cachedBg_ == bgColor &&
        cachedRevision_ == historyRevision &&
        cachedHistorySize_ == history.size();

    if (valid) {
        std::memcpy(
            target.data(),
            baseBuffer_.data(),
            static_cast<size_t>(w) * static_cast<size_t>(h) * 4u
        );
        ++cacheHits_;
    } else {
        target.clear(bgColor);
        for (size_t i = 0; i < history.size(); ++i) {
            executeOperation(target, history[i]);
        }

        if (baseBuffer_.width() != w || baseBuffer_.height() != h) {
            baseBuffer_ = CanvasBuffer(w, h);
        }
        std::memcpy(
            baseBuffer_.data(),
            target.data(),
            static_cast<size_t>(w) * static_cast<size_t>(h) * 4u
        );
        cachedWidth_ = w;
        cachedHeight_ = h;
        cachedBg_ = bgColor;
        cachedRevision_ = historyRevision;
        cachedHistorySize_ = history.size();
        hasBase_ = true;
        ++fullRebuilds_;
    }

    if (previewOp != nullptr) {
        executeOperation(target, *previewOp);
    }
}

void CommittedFrameCache::appendCommitted(
    CanvasBuffer& target,
    Color bgColor,
    const std::vector<DrawOperation>& history,
    uint64_t historyRevision
) {
    const int w = target.width();
    const int h = target.height();
    const bool reusable =
        hasBase_ &&
        cachedWidth_ == w &&
        cachedHeight_ == h &&
        cachedBg_ == bgColor &&
        history.size() > cachedHistorySize_;
    if (!reusable) {
        render(target, bgColor, history, historyRevision);
        return;
    }
    const size_t bytes = static_cast<size_t>(w) * static_cast<size_t>(h) * 4u;
    std::memcpy(target.data(), baseBuffer_.data(), bytes);
    for (size_t i = cachedHistorySize_; i < history.size(); ++i) {
        executeOperation(target, history[i]);
    }
    std::memcpy(baseBuffer_.data(), target.data(), bytes);
    cachedRevision_ = historyRevision;
    cachedHistorySize_ = history.size();
    ++incrementalAppends_;
}

} // namespace alpona
