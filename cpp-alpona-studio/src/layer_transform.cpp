#include "layer_transform.h"
#include "bezier.h"
#include <algorithm>
#include <cmath>
#include <limits>

namespace alpona {

namespace {

double clampCoord(double v, double canvasSize) {
    const double lo = -canvasSize * 0.25;
    const double hi = canvasSize * 1.25;
    return std::max(lo, std::min(hi, v));
}

Point2D translatePt(Point2D p, double dx, double dy, double canvasSize) {
    return {
        clampCoord(p.x + dx, canvasSize),
        clampCoord(p.y + dy, canvasSize)
    };
}

Point2D scalePt(Point2D p, double scale, Point2D origin) {
    return {
        origin.x + (p.x - origin.x) * scale,
        origin.y + (p.y - origin.y) * scale
    };
}

Point2D rotatePt(Point2D p, double angleRad, Point2D origin) {
    const double dx = p.x - origin.x;
    const double dy = p.y - origin.y;
    const double c = std::cos(angleRad);
    const double s = std::sin(angleRad);
    return {
        origin.x + dx * c - dy * s,
        origin.y + dx * s + dy * c
    };
}

} // namespace

LayerBounds computeLayerBounds(const LayerStrokeOp& op) {
    double minX = std::numeric_limits<double>::infinity();
    double minY = std::numeric_limits<double>::infinity();
    double maxX = -std::numeric_limits<double>::infinity();
    double maxY = -std::numeric_limits<double>::infinity();

    auto include = [&](Point2D p, double pad) {
        if (p.x - pad < minX) minX = p.x - pad;
        if (p.y - pad < minY) minY = p.y - pad;
        if (p.x + pad > maxX) maxX = p.x + pad;
        if (p.y + pad > maxY) maxY = p.y + pad;
    };

    if (op.kind == LayerOpKind::Line) {
        include(op.p0, 0.0);
        include(op.p1, 0.0);
    } else if (op.kind == LayerOpKind::Circle) {
        include(op.p0, std::max(8.0, op.radius));
    } else if (op.kind == LayerOpKind::Polygon || op.kind == LayerOpKind::Freehand) {
        for (size_t i = 0; i < op.points.size(); ++i) {
            include(op.points[i], 0.0);
        }
    } else if (op.kind == LayerOpKind::Bezier) {
        include(op.p0, 0.0);
        include(op.p1, 0.0);
        include(op.p2, 0.0);
        include(op.p3, 0.0);
        std::vector<Point2D> sampled = sampleCubicBezier(op.p0, op.p1, op.p2, op.p3, 16);
        for (size_t i = 0; i < sampled.size(); ++i) {
            include(sampled[i], 0.0);
        }
    } else if (op.kind == LayerOpKind::Fill) {
        include(op.p0, 18.0);
    }

    if (!std::isfinite(minX)) {
        minX = 340.0;
        minY = 340.0;
        maxX = 380.0;
        maxY = 380.0;
    }

    const double minHalf = 14.0;
    if (maxX - minX < minHalf * 2.0) {
        const double mid = (minX + maxX) * 0.5;
        minX = mid - minHalf;
        maxX = mid + minHalf;
    }
    if (maxY - minY < minHalf * 2.0) {
        const double mid = (minY + maxY) * 0.5;
        minY = mid - minHalf;
        maxY = mid + minHalf;
    }

    return {
        minX,
        minY,
        maxX,
        maxY,
        maxX - minX,
        maxY - minY,
        (minX + maxX) * 0.5,
        (minY + maxY) * 0.5
    };
}

LayerStrokeOp translateLayerOp(
    const LayerStrokeOp& op,
    double dx,
    double dy,
    double canvasSize
) {
    if (op.locked) return op;
    LayerStrokeOp out = op;
    if (out.kind == LayerOpKind::Line) {
        out.p0 = translatePt(out.p0, dx, dy, canvasSize);
        out.p1 = translatePt(out.p1, dx, dy, canvasSize);
    } else if (out.kind == LayerOpKind::Circle || out.kind == LayerOpKind::Fill) {
        out.p0 = translatePt(out.p0, dx, dy, canvasSize);
    } else if (out.kind == LayerOpKind::Polygon || out.kind == LayerOpKind::Freehand) {
        for (size_t i = 0; i < out.points.size(); ++i) {
            out.points[i] = translatePt(out.points[i], dx, dy, canvasSize);
        }
    } else if (out.kind == LayerOpKind::Bezier) {
        out.p0 = translatePt(out.p0, dx, dy, canvasSize);
        out.p1 = translatePt(out.p1, dx, dy, canvasSize);
        out.p2 = translatePt(out.p2, dx, dy, canvasSize);
        out.p3 = translatePt(out.p3, dx, dy, canvasSize);
    }
    return out;
}

LayerStrokeOp scaleLayerOpAroundPoint(
    const LayerStrokeOp& op,
    double scaleFactor,
    Point2D origin
) {
    if (op.locked) return op;
    const double s = std::max(0.15, std::min(4.0, scaleFactor));
    LayerStrokeOp out = op;
    if (out.kind == LayerOpKind::Line) {
        out.p0 = scalePt(out.p0, s, origin);
        out.p1 = scalePt(out.p1, s, origin);
    } else if (out.kind == LayerOpKind::Circle) {
        out.p0 = scalePt(out.p0, s, origin);
        out.radius = std::max(3.0, std::min(350.0, out.radius * s));
    } else if (out.kind == LayerOpKind::Polygon || out.kind == LayerOpKind::Freehand) {
        for (size_t i = 0; i < out.points.size(); ++i) {
            out.points[i] = scalePt(out.points[i], s, origin);
        }
    } else if (out.kind == LayerOpKind::Bezier) {
        out.p0 = scalePt(out.p0, s, origin);
        out.p1 = scalePt(out.p1, s, origin);
        out.p2 = scalePt(out.p2, s, origin);
        out.p3 = scalePt(out.p3, s, origin);
    } else if (out.kind == LayerOpKind::Fill) {
        out.p0 = scalePt(out.p0, s, origin);
    }
    return out;
}

LayerStrokeOp rotateLayerOpAroundPoint(
    const LayerStrokeOp& op,
    double angleRad,
    Point2D origin
) {
    if (op.locked) return op;
    LayerStrokeOp out = op;
    if (out.kind == LayerOpKind::Line) {
        out.p0 = rotatePt(out.p0, angleRad, origin);
        out.p1 = rotatePt(out.p1, angleRad, origin);
    } else if (out.kind == LayerOpKind::Circle || out.kind == LayerOpKind::Fill) {
        out.p0 = rotatePt(out.p0, angleRad, origin);
    } else if (out.kind == LayerOpKind::Polygon || out.kind == LayerOpKind::Freehand) {
        for (size_t i = 0; i < out.points.size(); ++i) {
            out.points[i] = rotatePt(out.points[i], angleRad, origin);
        }
    } else if (out.kind == LayerOpKind::Bezier) {
        out.p0 = rotatePt(out.p0, angleRad, origin);
        out.p1 = rotatePt(out.p1, angleRad, origin);
        out.p2 = rotatePt(out.p2, angleRad, origin);
        out.p3 = rotatePt(out.p3, angleRad, origin);
    }
    return out;
}

LayerStrokeOp mirrorLayerOp(
    const LayerStrokeOp& op,
    bool flipHorizontal,
    bool flipVertical,
    Point2D origin
) {
    if (op.locked || (!flipHorizontal && !flipVertical)) return op;
    auto mirrorPt = [&](Point2D p) -> Point2D {
        return {
            flipHorizontal ? (2.0 * origin.x - p.x) : p.x,
            flipVertical ? (2.0 * origin.y - p.y) : p.y
        };
    };

    LayerStrokeOp out = op;
    if (out.kind == LayerOpKind::Line) {
        out.p0 = mirrorPt(out.p0);
        out.p1 = mirrorPt(out.p1);
    } else if (out.kind == LayerOpKind::Circle || out.kind == LayerOpKind::Fill) {
        out.p0 = mirrorPt(out.p0);
    } else if (out.kind == LayerOpKind::Polygon || out.kind == LayerOpKind::Freehand) {
        for (size_t i = 0; i < out.points.size(); ++i) {
            out.points[i] = mirrorPt(out.points[i]);
        }
    } else if (out.kind == LayerOpKind::Bezier) {
        out.p0 = mirrorPt(out.p0);
        out.p1 = mirrorPt(out.p1);
        out.p2 = mirrorPt(out.p2);
        out.p3 = mirrorPt(out.p3);
    }
    return out;
}

} // namespace alpona
