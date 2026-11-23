#ifndef ALPONA_RASTERIZER_H
#define ALPONA_RASTERIZER_H

#include "canvas_buffer.h"
#include <vector>

namespace alpona {

int stampBrush(
    CanvasBuffer& buffer,
    int cx,
    int cy,
    Color color,
    int thickness = 1
);

int drawBresenhamLine(
    CanvasBuffer& buffer,
    int x0,
    int y0,
    int x1,
    int y1,
    Color color,
    int thickness = 1
);

int drawDdaLine(
    CanvasBuffer& buffer,
    double x0,
    double y0,
    double x1,
    double y1,
    Color color,
    int thickness = 1
);

int drawPolygonOutline(
    CanvasBuffer& buffer,
    const std::vector<Point2D>& vertices,
    Color color,
    int thickness = 1,
    bool useDda = false
);

int drawBresenhamCircle(
    CanvasBuffer& buffer,
    int cx,
    int cy,
    int radius,
    Color color,
    int thickness = 1
);

} // namespace alpona

#endif // ALPONA_RASTERIZER_H
