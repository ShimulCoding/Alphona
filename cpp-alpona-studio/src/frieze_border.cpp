#include "frieze_border.h"
#include <algorithm>
#include <cmath>

namespace alpona {

namespace {

constexpr double kPi = 3.14159265358979323846;

uint8_t clampByte(double v) {
    if (v < 0.0) return 0;
    if (v > 255.0) return 255;
    return static_cast<uint8_t>(std::round(v));
}

Color sampleBilinear(const CanvasBuffer& src, double fx, double fy) {
    const double maxX = static_cast<double>(src.width() - 1);
    const double maxY = static_cast<double>(src.height() - 1);
    const double x = std::max(0.0, std::min(maxX, fx));
    const double y = std::max(0.0, std::min(maxY, fy));
    const int x0 = static_cast<int>(std::floor(x));
    const int y0 = static_cast<int>(std::floor(y));
    const int x1 = std::min(src.width() - 1, x0 + 1);
    const int y1 = std::min(src.height() - 1, y0 + 1);
    const double dx = x - static_cast<double>(x0);
    const double dy = y - static_cast<double>(y0);

    const Color c00 = src.getPixel(x0, y0);
    const Color c10 = src.getPixel(x1, y0);
    const Color c01 = src.getPixel(x0, y1);
    const Color c11 = src.getPixel(x1, y1);

    const double w00 = (1.0 - dx) * (1.0 - dy);
    const double w10 = dx * (1.0 - dy);
    const double w01 = (1.0 - dx) * dy;
    const double w11 = dx * dy;

    return {
        clampByte(c00.r * w00 + c10.r * w10 + c01.r * w01 + c11.r * w11),
        clampByte(c00.g * w00 + c10.g * w10 + c01.g * w01 + c11.g * w11),
        clampByte(c00.b * w00 + c10.b * w10 + c01.b * w01 + c11.b * w11),
        255
    };
}

}  // namespace

CanvasBuffer unwrapAlponaRingToTile(
    const CanvasBuffer& alpona,
    int tileW,
    int tileH,
    double innerRadiusFrac,
    double outerRadiusFrac,
    int sectors
) {
    const int w = std::max(32, tileW);
    const int h = std::max(32, tileH);
    CanvasBuffer out(w, h);

    const double cx = static_cast<double>(alpona.width()) * 0.5;
    const double cy = static_cast<double>(alpona.height()) * 0.5;
    const double maxR = std::min(cx, cy) * 0.96;
    const double rIn = std::max(0.05, std::min(0.82, innerRadiusFrac)) * maxR;
    const double rOut = std::max(rIn + 12.0, std::min(0.99, outerRadiusFrac) * maxR);

    const int safeSectors = std::max(4, std::min(16, sectors));
    const double sectorAngle = (2.0 * kPi) / static_cast<double>(safeSectors);

    for (int y = 0; y < h; ++y) {
        const double v = h <= 1 ? 0.5 : static_cast<double>(y) / static_cast<double>(h - 1);
        const double r = rOut - v * (rOut - rIn);
        for (int x = 0; x < w; ++x) {
            const double u = w <= 1 ? 0.0 : static_cast<double>(x) / static_cast<double>(w);
            const double theta = -kPi * 0.5 - sectorAngle * 0.5 + u * sectorAngle;
            const double sx = cx + std::cos(theta) * r;
            const double sy = cy + std::sin(theta) * r;
            out.setPixel(x, y, sampleBilinear(alpona, sx, sy));
        }
    }
    return out;
}

void mapFriezeCoordinates(
    FriezeGroup group,
    int repeatIndex,
    double u,
    double v,
    double& outU,
    double& outV
) {
    const bool odd = (repeatIndex & 1) == 1;
    switch (group) {
        case FriezeGroup::P1:
            outU = u;
            outV = v;
            break;
        case FriezeGroup::P11G:
            outU = u;
            outV = odd ? (1.0 - v) : v;
            break;
        case FriezeGroup::P11M:
            outU = u;
            outV = (v < 0.5) ? (v * 2.0) : ((1.0 - v) * 2.0);
            break;
        case FriezeGroup::P1M1:
            outU = (u < 0.5) ? (u * 2.0) : ((1.0 - u) * 2.0);
            outV = v;
            break;
        case FriezeGroup::P2:
            outU = odd ? (1.0 - u) : u;
            outV = odd ? (1.0 - v) : v;
            break;
        case FriezeGroup::P2MG:
            outU = (u < 0.5) ? (u * 2.0) : ((1.0 - u) * 2.0);
            outV = odd ? (1.0 - v) : v;
            break;
        case FriezeGroup::P2MM:
            outU = (u < 0.5) ? (u * 2.0) : ((1.0 - u) * 2.0);
            outV = (v < 0.5) ? (v * 2.0) : ((1.0 - v) * 2.0);
            break;
    }
}

CanvasBuffer renderFriezeStrip(
    const CanvasBuffer& tile,
    FriezeGroup group,
    int repeatCount,
    bool trimLines,
    Color trimColor
) {
    const int reps = std::max(2, std::min(10, repeatCount));
    const int stripW = tile.width() * reps;
    const int railPad = trimLines ? std::max(10, static_cast<int>(std::round(tile.height() * 0.14))) : 0;
    const int stripH = tile.height() + railPad * 2;
    CanvasBuffer out(stripW, stripH);

    const Color bg = tile.getPixel(0, 0);
    out.clear(bg);

    for (int k = 0; k < reps; ++k) {
        const int xBase = k * tile.width();
        for (int y = 0; y < tile.height(); ++y) {
            const double v = tile.height() <= 1
                                 ? 0.5
                                 : static_cast<double>(y) / static_cast<double>(tile.height() - 1);
            for (int x = 0; x < tile.width(); ++x) {
                const double u = tile.width() <= 1
                                     ? 0.0
                                     : static_cast<double>(x) / static_cast<double>(tile.width() - 1);
                double tu = 0.0;
                double tv = 0.0;
                mapFriezeCoordinates(group, k, u, v, tu, tv);
                const Color px = sampleBilinear(
                    tile,
                    tu * static_cast<double>(tile.width() - 1),
                    tv * static_cast<double>(tile.height() - 1)
                );
                out.setPixel(xBase + x, y + railPad, px);
            }
        }
    }

    if (trimLines && railPad >= 6) {
        const int thick = std::max(2, static_cast<int>(std::round(railPad * 0.2)));
        const int thin = std::max(1, static_cast<int>(std::round(thick * 0.65)));
        auto drawRail = [&](int yStart, int hLines) {
            for (int t = 0; t < hLines; ++t) {
                const int yy = std::max(0, std::min(stripH - 1, yStart + t));
                for (int x = 0; x < stripW; ++x) {
                    out.setPixel(x, yy, trimColor);
                }
            }
        };
        drawRail(static_cast<int>(std::round(railPad * 0.22)), thick);
        drawRail(static_cast<int>(std::round(railPad * 0.65)), thin);
        drawRail(stripH - railPad + static_cast<int>(std::round(railPad * 0.22)), thin);
        drawRail(stripH - static_cast<int>(std::round(railPad * 0.22)) - thick, thick);
    }

    return out;
}

CanvasBuffer renderMiteredCorner90(
    const CanvasBuffer& strip,
    int outSize,
    Color fabricColor
) {
    const int size = std::max(160, outSize);
    CanvasBuffer out(size, size);

    for (int y = 0; y < size; ++y) {
        for (int x = 0; x < size; ++x) {
            const int weave = ((x + y) & 3) == 0 ? 5 : (((x ^ y) & 7) == 0 ? -4 : 0);
            out.setPixel(x, y, {
                clampByte(static_cast<double>(fabricColor.r) + weave),
                clampByte(static_cast<double>(fabricColor.g) + weave),
                clampByte(static_cast<double>(fabricColor.b) + weave),
                255
            });
        }
    }

    const int bandThickness = std::max(48, static_cast<int>(std::round(size * 0.30)));
    const int margin = static_cast<int>(std::round(size * 0.06));
    const int innerLimit = size - margin;
    const double span = static_cast<double>(std::max(1, innerLimit - margin));

    for (int y = margin; y < innerLimit; ++y) {
        for (int x = margin; x < innerLimit; ++x) {
            const int dx = x - margin;
            const int dy = y - margin;
            const bool inTop = (dy < bandThickness && dx >= dy);
            const bool inLeft = (dx < bandThickness && dy > dx);
            if (!inTop && !inLeft) continue;

            double su = 0.0;
            double sv = 0.0;
            if (inTop) {
                su = (static_cast<double>(dx) / span) * static_cast<double>(strip.width() - 1);
                sv = (static_cast<double>(dy) / static_cast<double>(std::max(1, bandThickness - 1))) *
                     static_cast<double>(strip.height() - 1);
            } else {
                su = (static_cast<double>(dy) / span) * static_cast<double>(strip.width() - 1);
                sv = (static_cast<double>(dx) / static_cast<double>(std::max(1, bandThickness - 1))) *
                     static_cast<double>(strip.height() - 1);
            }
            out.setPixel(x, y, sampleBilinear(strip, su, sv));
        }
    }

    return out;
}

}  // namespace alpona
