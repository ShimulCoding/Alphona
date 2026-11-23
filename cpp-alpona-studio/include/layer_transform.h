#ifndef ALPONA_LAYER_TRANSFORM_H
#define ALPONA_LAYER_TRANSFORM_H

#include "layer_stack.h"

namespace alpona {

struct LayerBounds {
    double minX;
    double minY;
    double maxX;
    double maxY;
    double width;
    double height;
    double cx;
    double cy;
};

/**
 * Computes the axis-aligned bounding box and centroid for any LayerStrokeOp
 * (Line, Circle, Polygon, Freehand, Bezier, or Fill).
 */
LayerBounds computeLayerBounds(const LayerStrokeOp& op);

/**
 * Translates an unlocked LayerStrokeOp by (dx, dy) in logical canvas space.
 */
LayerStrokeOp translateLayerOp(
    const LayerStrokeOp& op,
    double dx,
    double dy,
    double canvasSize = 720.0
);

/**
 * Uniformly scales an unlocked LayerStrokeOp around `origin`.
 */
LayerStrokeOp scaleLayerOpAroundPoint(
    const LayerStrokeOp& op,
    double scaleFactor,
    Point2D origin
);

/**
 * Rotates an unlocked LayerStrokeOp by `angleRad` radians around `origin`.
 */
LayerStrokeOp rotateLayerOpAroundPoint(
    const LayerStrokeOp& op,
    double angleRad,
    Point2D origin
);

/**
 * Mirrors an unlocked LayerStrokeOp horizontally (left <-> right across origin.x)
 * and/or vertically (top <-> bottom across origin.y).
 */
LayerStrokeOp mirrorLayerOp(
    const LayerStrokeOp& op,
    bool flipHorizontal,
    bool flipVertical,
    Point2D origin = {360.0, 360.0}
);

} // namespace alpona

#endif // ALPONA_LAYER_TRANSFORM_H
