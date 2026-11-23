#include "viewport_camera.h"
#include <algorithm>
#include <cmath>

namespace alpona {

namespace {

const double kMinZoom = 1.0;
const double kMaxZoom = 4.0;

double clampDouble(double v, double lo, double hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

} // namespace

CanvasViewport clampCanvasViewport(const CanvasViewport& vp, int canvasSize) {
    double z = clampDouble(vp.zoom, kMinZoom, kMaxZoom);
    if (z <= 1.0001) {
        return CanvasViewport(1.0, 0.0, 0.0);
    }
    double maxPan = (static_cast<double>(canvasSize) * (z - 1.0)) / (2.0 * z);
    return CanvasViewport(
        z,
        clampDouble(vp.panX, -maxPan, maxPan),
        clampDouble(vp.panY, -maxPan, maxPan)
    );
}

CanvasViewport zoomCanvasViewportAtPoint(
    const CanvasViewport& current,
    double nextZoom,
    Point2D anchorCanvasPt,
    int canvasSize
) {
    double clampedNext = clampDouble(nextZoom, kMinZoom, kMaxZoom);
    if (clampedNext <= 1.0001) {
        return CanvasViewport(1.0, 0.0, 0.0);
    }
    double half = static_cast<double>(canvasSize) * 0.5;
    double vx = (anchorCanvasPt.x - half + current.panX) * current.zoom;
    double vy = (anchorCanvasPt.y - half + current.panY) * current.zoom;
    double nextPanX = vx / clampedNext - (anchorCanvasPt.x - half);
    double nextPanY = vy / clampedNext - (anchorCanvasPt.y - half);
    return clampCanvasViewport(CanvasViewport(clampedNext, nextPanX, nextPanY), canvasSize);
}

CanvasViewport panCanvasViewportByScreenDelta(
    const CanvasViewport& current,
    double deltaScreenX,
    double deltaScreenY,
    double stageWidth,
    int canvasSize
) {
    if (current.zoom <= 1.0001 || stageWidth <= 0.0) {
        return CanvasViewport(1.0, 0.0, 0.0);
    }
    double cssToCanvas = static_cast<double>(canvasSize) / stageWidth;
    return clampCanvasViewport(
        CanvasViewport(
            current.zoom,
            current.panX + (deltaScreenX * cssToCanvas) / current.zoom,
            current.panY + (deltaScreenY * cssToCanvas) / current.zoom
        ),
        canvasSize
    );
}

Point2D screenToCanvasWithViewport(
    double clientX,
    double clientY,
    const StageRect& stageRect,
    const CanvasViewport& vp,
    int canvasSize
) {
    double w = std::max(1.0, stageRect.width);
    double h = std::max(1.0, stageRect.height);
    double size = static_cast<double>(canvasSize);
    double half = size * 0.5;

    double normX = ((clientX - stageRect.left) / w - 0.5) * size;
    double normY = ((clientY - stageRect.top) / h - 0.5) * size;

    double z = std::max(kMinZoom, vp.zoom);
    double cx = std::floor(normX / z - vp.panX + half + 0.5);
    double cy = std::floor(normY / z - vp.panY + half + 0.5);

    return Point2D{
        clampDouble(cx, 0.0, size - 1.0),
        clampDouble(cy, 0.0, size - 1.0)
    };
}

Point2D canvasToStageNormalized(
    Point2D canvasPt,
    const CanvasViewport& vp,
    int canvasSize
) {
    double size = static_cast<double>(canvasSize);
    double half = size * 0.5;
    double vx = (canvasPt.x - half + vp.panX) * vp.zoom + half;
    double vy = (canvasPt.y - half + vp.panY) * vp.zoom + half;
    return Point2D{vx / size, vy / size};
}

} // namespace alpona
