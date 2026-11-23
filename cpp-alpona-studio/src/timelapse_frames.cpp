#include "timelapse_frames.h"
#include <algorithm>
#include <cmath>

namespace alpona {

namespace {
const double kTwoPi = 6.28318530717958647692;
const double kHalfPi = 1.57079632679489661923;
}

ReelProgress computeReelProgress(int totalOps, double u) {
    if (totalOps <= 0) {
        return {0, -1, 0.0};
    }
    const double clamped = std::max(0.0, std::min(1.0, u));
    if (clamped >= 1.0) {
        return {totalOps, -1, 1.0};
    }
    const double scaled = clamped * totalOps;
    const int activeIdx = std::min(totalOps - 1, static_cast<int>(std::floor(scaled)));
    const double activeT = scaled - activeIdx;
    return {activeIdx, activeIdx, activeT};
}

Point2D samplePartialLineEnd(Point2D p0, Point2D p1, double t) {
    const double tt = std::max(0.0, std::min(1.0, t));
    return {
        p0.x + (p1.x - p0.x) * tt,
        p0.y + (p1.y - p0.y) * tt
    };
}

std::vector<Point2D> samplePartialCircleArc(
    Point2D center,
    double radius,
    double t,
    int maxSteps
) {
    const double tt = std::max(0.01, std::min(1.0, t));
    const int steps = std::max(2, static_cast<int>(std::ceil(maxSteps * tt)));
    std::vector<Point2D> pts;
    pts.reserve(static_cast<size_t>(steps + 1));
    const double sweep = kTwoPi * tt;
    for (int i = 0; i <= steps; ++i) {
        const double ang = -kHalfPi + (sweep * i) / steps;
        pts.push_back({
            center.x + radius * std::cos(ang),
            center.y + radius * std::sin(ang)
        });
    }
    return pts;
}

} // namespace alpona
