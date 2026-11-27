#include "frame_cache.h"
#include <algorithm>
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
      incrementalAppends_(0),
      snapshotRestores_(0) {}

void CommittedFrameCache::invalidate() {
    hasBase_ = false;
    snapshots_.clear();
}

namespace {
const size_t kSnapshotBudgetBytes = 128u * 1024u * 1024u;
const size_t kMaxSnapshots = 40;

// FNV-1a over every field that affects how an operation is drawn.
uint64_t fingerprint(const std::vector<DrawOperation>& history) {
    uint64_t h = 1469598103934665603ull;
    auto mix = [&h](const void* data, size_t n) {
        const unsigned char* p = static_cast<const unsigned char*>(data);
        for (size_t i = 0; i < n; ++i) {
            h ^= p[i];
            h *= 1099511628211ull;
        }
    };
    if (history.empty()) return h;
    const DrawOperation& op = history.back();
    const int kind = static_cast<int>(op.kind);
    mix(&kind, sizeof(kind));
    mix(&op.p0, sizeof(op.p0));
    mix(&op.p1, sizeof(op.p1));
    mix(&op.radius, sizeof(op.radius));
    mix(&op.color, sizeof(op.color));
    mix(&op.thickness, sizeof(op.thickness));
    mix(&op.symmetricFill, sizeof(op.symmetricFill));
    mix(&op.symmetry.sectors, sizeof(op.symmetry.sectors));
    mix(&op.symmetry.reflect, sizeof(op.symmetry.reflect));
    if (!op.points.empty()) mix(op.points.data(), op.points.size() * sizeof(Point2D));
    return h;
}
}

// Keeps the current base frame for its history length. Frames for longer histories
// belong to a branch that was just replaced, so they are dropped.
void CommittedFrameCache::storeSnapshot(const std::vector<DrawOperation>& history) {
    std::vector<Snapshot> kept;
    for (size_t i = 0; i < snapshots_.size(); ++i) {
        if (snapshots_[i].historySize < cachedHistorySize_) kept.push_back(snapshots_[i]);
    }
    const size_t bytes = static_cast<size_t>(cachedWidth_) * static_cast<size_t>(cachedHeight_) * 4u;
    Snapshot snap;
    snap.historySize = cachedHistorySize_;
    snap.lastOpFingerprint = fingerprint(history);
    snap.pixels.assign(baseBuffer_.data(), baseBuffer_.data() + bytes);
    kept.push_back(snap);
    const size_t maxCount = std::min(kMaxSnapshots, std::max<size_t>(2, kSnapshotBudgetBytes / std::max<size_t>(1, bytes)));
    if (kept.size() > maxCount) kept.erase(kept.begin(), kept.end() - static_cast<long>(maxCount));
    snapshots_.swap(kept);
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
        snapshots_.clear();
        storeSnapshot(history);
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
    storeSnapshot(history);
}

void CommittedFrameCache::jumpToCommitted(
    CanvasBuffer& target,
    Color bgColor,
    const std::vector<DrawOperation>& history,
    uint64_t historyRevision
) {
    const int w = target.width();
    const int h = target.height();
    if (hasBase_ && cachedWidth_ == w && cachedHeight_ == h && cachedBg_ == bgColor) {
        for (size_t i = 0; i < snapshots_.size(); ++i) {
            if (snapshots_[i].historySize != history.size() ||
                snapshots_[i].lastOpFingerprint != fingerprint(history)) continue;
            const size_t bytes = static_cast<size_t>(w) * static_cast<size_t>(h) * 4u;
            std::memcpy(target.data(), snapshots_[i].pixels.data(), bytes);
            std::memcpy(baseBuffer_.data(), snapshots_[i].pixels.data(), bytes);
            cachedRevision_ = historyRevision;
            cachedHistorySize_ = history.size();
            ++snapshotRestores_;
            return;
        }
        if (history.size() > cachedHistorySize_) {
            appendCommitted(target, bgColor, history, historyRevision);
            return;
        }
    }
    render(target, bgColor, history, historyRevision);
}

} // namespace alpona
