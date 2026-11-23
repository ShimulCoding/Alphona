#include "../include/rasterizer.h"
#include <algorithm>
#include <cmath>
#include <cstdlib>

namespace alpona {

int stampBrush(
    CanvasBuffer& buffer,
    int cx,
    int cy,
    Color color,
    int thickness
) {
    if (thickness <= 1) {
        return buffer.setPixel(cx, cy, color) ? 1 : 0;
    }
    const int radius = thickness / 2;
    const int r2 = radius * radius + radius;
    int count = 0;
    for (int dy = -radius; dy <= radius; ++dy) {
        for (int dx = -radius; dx <= radius; ++dx) {
            if (dx * dx + dy * dy <= r2) {
                if (buffer.setPixel(cx + dx, cy + dy, color)) {
                    ++count;
                }
            }
        }
    }
    return count;
}

int drawBresenhamLine(
    CanvasBuffer& buffer,
    int x0,
    int y0,
    int x1,
    int y1,
    Color color,
    int thickness
) {
    const int dx = std::abs(x1 - x0);
    const int dy = std::abs(y1 - y0);
    const int sx = (x0 < x1) ? 1 : -1;
    const int sy = (y0 < y1) ? 1 : -1;
    int err = dx - dy;
    int pixelsWritten = 0;

    while (true) {
        pixelsWritten += stampBrush(buffer, x0, y0, color, thickness);
        if (x0 == x1 && y0 == y1) {
            break;
        }
        const int e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y0 += sy;
        }
    }
    return pixelsWritten;
}

int drawDdaLine(
    CanvasBuffer& buffer,
    double x0,
    double y0,
    double x1,
    double y1,
    Color color,
    int thickness
) {
    const double dx = x1 - x0;
    const double dy = y1 - y0;
    const int steps = std::max(
        static_cast<int>(std::abs(std::lround(dx))),
        static_cast<int>(std::abs(std::lround(dy)))
    );

    if (steps == 0) {
        return stampBrush(
            buffer,
            static_cast<int>(std::lround(x0)),
            static_cast<int>(std::lround(y0)),
            color,
            thickness
        );
    }

    const double xInc = dx / static_cast<double>(steps);
    const double yInc = dy / static_cast<double>(steps);
    double x = x0;
    double y = y0;
    int pixelsWritten = 0;

    for (int i = 0; i <= steps; ++i) {
        pixelsWritten += stampBrush(
            buffer,
            static_cast<int>(std::lround(x)),
            static_cast<int>(std::lround(y)),
            color,
            thickness
        );
        x += xInc;
        y += yInc;
    }
    return pixelsWritten;
}

int drawPolygonOutline(
    CanvasBuffer& buffer,
    const std::vector<Point2D>& vertices,
    Color color,
    int thickness,
    bool useDda
) {
    if (vertices.size() < 2) return 0;
    int pixels = 0;
    for (size_t i = 0; i < vertices.size(); ++i) {
        const Point2D& a = vertices[i];
        const Point2D& b = vertices[(i + 1) % vertices.size()];
        if (useDda) {
            pixels += drawDdaLine(buffer, a.x, a.y, b.x, b.y, color, thickness);
        } else {
            pixels += drawBresenhamLine(
                buffer,
                static_cast<int>(std::lround(a.x)),
                static_cast<int>(std::lround(a.y)),
                static_cast<int>(std::lround(b.x)),
                static_cast<int>(std::lround(b.y)),
                color,
                thickness
            );
        }
    }
    return pixels;
}

int drawBresenhamCircle(
    CanvasBuffer& buffer,
    int cx,
    int cy,
    int radius,
    Color color,
    int thickness
) {
    if (radius <= 0) {
        return stampBrush(buffer, cx, cy, color, thickness);
    }

    int x = 0;
    int y = radius;
    int d = 3 - 2 * radius;
    int pixelsWritten = 0;

    auto plotOctants = [&](int px, int py) {
        pixelsWritten += stampBrush(buffer, cx + px, cy + py, color, thickness);
        pixelsWritten += stampBrush(buffer, cx - px, cy + py, color, thickness);
        pixelsWritten += stampBrush(buffer, cx + px, cy - py, color, thickness);
        pixelsWritten += stampBrush(buffer, cx - px, cy - py, color, thickness);
        if (px != py) {
            pixelsWritten += stampBrush(buffer, cx + py, cy + px, color, thickness);
            pixelsWritten += stampBrush(buffer, cx - py, cy + px, color, thickness);
            pixelsWritten += stampBrush(buffer, cx + py, cy - px, color, thickness);
            pixelsWritten += stampBrush(buffer, cx - py, cy - px, color, thickness);
        }
    };

    while (x <= y) {
        plotOctants(x, y);
        if (d < 0) {
            d = d + 4 * x + 6;
        } else {
            d = d + 4 * (x - y) + 10;
            --y;
        }
        ++x;
    }

    return pixelsWritten;
}

} // namespace alpona
