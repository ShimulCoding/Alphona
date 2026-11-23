#ifndef ALPONA_BEZIER_H
#define ALPONA_BEZIER_H

#include <vector>
#include "canvas_buffer.h"

namespace alpona {

struct DeCasteljauFrame {
    double t;
    Point2D q0;
    Point2D q1;
    Point2D q2;
    Point2D r0;
    Point2D r1;
    Point2D point;
};

// Evaluates parametric cubic Bezier B(t) for t in [0, 1].
Point2D evaluateCubicBezier(
    const Point2D& p0,
    const Point2D& p1,
    const Point2D& p2,
    const Point2D& p3,
    double t
);

// Computes the de Casteljau recursive linear interpolation pyramid at parameter t.
DeCasteljauFrame deCasteljauSubdivision(
    const Point2D& p0,
    const Point2D& p1,
    const Point2D& p2,
    const Point2D& p3,
    double t
);

// Samples a cubic Bezier curve into a dense polyline for integer Bresenham/DDA rasterization.
std::vector<Point2D> sampleCubicBezier(
    const Point2D& p0,
    const Point2D& p1,
    const Point2D& p2,
    const Point2D& p3,
    int segments = 28
);

// Rasterizes a symmetric cubic Bezier stroke onto a CanvasBuffer using Bresenham lines.
int drawSymmetricCubicBezier(
    CanvasBuffer& buf,
    const Point2D& p0,
    const Point2D& p1,
    const Point2D& p2,
    const Point2D& p3,
    const SymmetryConfig& sym,
    const Color& color,
    int thickness = 2,
    int segments = 28
);

} // namespace alpona

#endif // ALPONA_BEZIER_H
