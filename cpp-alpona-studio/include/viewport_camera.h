#ifndef ALPONA_VIEWPORT_CAMERA_H
#define ALPONA_VIEWPORT_CAMERA_H

#include "canvas_buffer.h"

namespace alpona {

struct CanvasViewport {
    double zoom; // 1.0 .. 4.0
    double panX; // logical canvas pixels
    double panY; // logical canvas pixels

    CanvasViewport() : zoom(1.0), panX(0.0), panY(0.0) {}
    CanvasViewport(double z, double px, double py) : zoom(z), panX(px), panY(py) {}
};

struct StageRect {
    double left;
    double top;
    double width;
    double height;
};

CanvasViewport clampCanvasViewport(const CanvasViewport& vp, int canvasSize);

CanvasViewport zoomCanvasViewportAtPoint(
    const CanvasViewport& current,
    double nextZoom,
    Point2D anchorCanvasPt,
    int canvasSize
);

CanvasViewport panCanvasViewportByScreenDelta(
    const CanvasViewport& current,
    double deltaScreenX,
    double deltaScreenY,
    double stageWidth,
    int canvasSize
);

Point2D screenToCanvasWithViewport(
    double clientX,
    double clientY,
    const StageRect& stageRect,
    const CanvasViewport& vp,
    int canvasSize
);

Point2D canvasToStageNormalized(
    Point2D canvasPt,
    const CanvasViewport& vp,
    int canvasSize
);

} // namespace alpona

#endif // ALPONA_VIEWPORT_CAMERA_H
