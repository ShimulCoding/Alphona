#include "../include/floodfill.h"
#include <stack>
#include <utility>

namespace alpona {

int iterativeSeedFill(
    CanvasBuffer& buffer,
    int seedX,
    int seedY,
    Color fillColor
) {
    if (!buffer.inBounds(seedX, seedY)) {
        return 0;
    }

    const Color target = buffer.getPixel(seedX, seedY);
    if (target == fillColor) {
        return 0;
    }

    const int width = buffer.width();
    const int height = buffer.height();
    std::stack<std::pair<int, int>> spans;
    spans.push({seedX, seedY});
    int filled = 0;

    while (!spans.empty()) {
        auto current = spans.top();
        spans.pop();
        int x = current.first;
        const int y = current.second;

        if (!buffer.inBounds(x, y) || buffer.getPixel(x, y) != target) {
            continue;
        }

        while (x > 0 && buffer.getPixel(x - 1, y) == target) {
            --x;
        }

        bool spanAbove = false;
        bool spanBelow = false;

        while (x < width && buffer.getPixel(x, y) == target) {
            buffer.setPixel(x, y, fillColor);
            ++filled;

            if (y > 0) {
                const bool matchesAbove = (buffer.getPixel(x, y - 1) == target);
                if (!spanAbove && matchesAbove) {
                    spans.push({x, y - 1});
                    spanAbove = true;
                } else if (spanAbove && !matchesAbove) {
                    spanAbove = false;
                }
            }

            if (y < height - 1) {
                const bool matchesBelow = (buffer.getPixel(x, y + 1) == target);
                if (!spanBelow && matchesBelow) {
                    spans.push({x, y + 1});
                    spanBelow = true;
                } else if (spanBelow && !matchesBelow) {
                    spanBelow = false;
                }
            }

            ++x;
        }
    }

    return filled;
}

} // namespace alpona
