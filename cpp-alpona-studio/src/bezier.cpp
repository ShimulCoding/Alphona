#include "bezier.h"
#include "rasterizer.h"
#include "transforms.h"
#include <algorithm>
#include <cmath>

namespace alpona {

static Point2D lerpPoint2D(const Point2D& a, const Point2D& b, double t) {
    return { a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t };
}

Point2D evaluateCubicBezier(
    const Point2D& p0,
    const Point2D& p1,
    const Point2D& p2,
    const Point2D& p3,
    double t
) {
    const double u = 1.0 - t;
    const double u2 = u * u;
    const double u3 = u2 * u;
    const double t2 = t * t;
    const double t3 = t2 * t;
    return {
        u3 * p0.x + 3.0 * u2 * t * p1.x + 3.0 * u * t2 * p2.x + t3 * p3.x,
        u3 * p0.y + 3.0 * u2 * t * p1.y + 3.0 * u * t2 * p2.y + t3 * p3.y
    };
}

DeCasteljauFrame deCasteljauSubdivision(
    const Point2D& p0,
    const Point2D& p1,
    const Point2D& p2,
    const Point2D& p3,
    double t
) {
    const double ct = std::max(0.0, std::min(1.0, t));
    DeCasteljauFrame frame;
    frame.t = ct;
    frame.q0 = lerpPoint2D(p0, p1, ct);
    frame.q1 = lerpPoint2D(p1, p2, ct);
    frame.q2 = lerpPoint2D(p2, p3, ct);
    frame.r0 = lerpPoint2D(frame.q0, frame.q1, ct);
    frame.r1 = lerpPoint2D(frame.q1, frame.q2, ct);
    frame.point = lerpPoint2D(frame.r0, frame.r1, ct);
    return frame;
}

std::vector<Point2D> sampleCubicBezier(
    const Point2D& p0,
    const Point2D& p1,
    const Point2D& p2,
    const Point2D& p3,
    int segments
) {
    const int steps = std::max(4, std::min(96, segments));
    std::vector<Point2D> pts;
    pts.reserve(static_cast<size_t>(steps + 1));
    for (int i = 0; i <= steps; ++i) {
        const double t = static_cast<double>(i) / static_cast<double>(steps);
        pts.push_back(evaluateCubicBezier(p0, p1, p2, p3, t));
    }
    return pts;
}

int drawSymmetricCubicBezier(
    CanvasBuffer& buf,
    const Point2D& p0,
    const Point2D& p1,
    const Point2D& p2,
    const Point2D& p3,
    const SymmetryConfig& sym,
    const Color& color,
    int thickness,
    int segments
) {
    const std::vector<Point2D> pts = sampleCubicBezier(p0, p1, p2, p3, segments);
    const Point2D center = { buf.width() * 0.5, buf.height() * 0.5 };
    const ClipBounds bounds = {
        0.0,
        0.0,
        static_cast<double>(buf.width() - 1),
        static_cast<double>(buf.height() - 1)
    };
    int written = 0;
    for (size_t i = 1; i < pts.size(); ++i) {
        const std::vector<std::pair<Point2D, Point2D>> copies =
            generateSymmetricSegments(pts[i - 1], pts[i], center, sym);
        for (size_t c = 0; c < copies.size(); ++c) {
            Point2D a = copies[c].first;
            Point2D b = copies[c].second;
            if (cohenSutherlandClip(a, b, bounds)) {
                written += drawBresenhamLine(
                    buf,
                    static_cast<int>(std::round(a.x)),
                    static_cast<int>(std::round(a.y)),
                    static_cast<int>(std::round(b.x)),
                    static_cast<int>(std::round(b.y)),
                    color,
                    thickness
                );
            }
        }
    }
    return written;
}

} // namespace alpona
