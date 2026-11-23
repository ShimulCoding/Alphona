#include "natural_media.h"

#include <algorithm>
#include <cmath>
#include <vector>

namespace alpona {

namespace {

uint8_t clamp255(double v) {
    const int iv = static_cast<int>(std::floor(v + 0.5));
    if (iv < 0) return 0;
    if (iv > 255) return 255;
    return static_cast<uint8_t>(iv);
}

double valueNoise2D(double x, double y) {
    const int ix = static_cast<int>(std::floor(x));
    const int iy = static_cast<int>(std::floor(y));
    const double fx = x - ix;
    const double fy = y - iy;
    const double ux = fx * fx * (3.0 - 2.0 * fx);
    const double uy = fy * fy * (3.0 - 2.0 * fy);
    const double a = hash2D(ix, iy);
    const double b = hash2D(ix + 1, iy);
    const double c = hash2D(ix, iy + 1);
    const double d = hash2D(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

void sampleSubstratePixel(
    int x,
    int y,
    int width,
    int height,
    NaturalSubstrateId substrate,
    double warmth,
    uint8_t& outR,
    uint8_t& outG,
    uint8_t& outB) {
    const double nx = static_cast<double>(x) / std::max(1, width);
    const double ny = static_cast<double>(y) / std::max(1, height);
    const double warmShift = (warmth - 0.5) * 18.0;

    if (substrate == NaturalSubstrateId::MatiMud) {
        const double sweep = std::sin(nx * 24.0 + fbm2D(nx * 8.0, ny * 8.0) * 3.8) * 8.0;
        const double clay = (fbm2D(nx * 22.0, ny * 22.0) - 0.5) * 26.0;
        const double fine = (hash2D(x, y) - 0.5) * 10.0;
        const double d = sweep + clay + fine;
        outR = clamp255(126.0 + d + warmShift);
        outG = clamp255(68.0 + d * 0.72 + warmShift * 0.4);
        outB = clamp255(52.0 + d * 0.58 - warmShift * 0.3);
        return;
    }

    if (substrate == NaturalSubstrateId::EkusheyAsphalt) {
        const double pebble = (fbm2D(nx * 46.0, ny * 46.0) - 0.5) * 36.0;
        const double grit = (hash2D(x, y) - 0.5) * 28.0;
        const double crack = (std::fabs(fbm2D(nx * 10.0, ny * 10.0) - 0.5) < 0.012) ? -18.0 : 0.0;
        const double v = 42.0 + pebble + grit + crack;
        outR = clamp255(v + warmShift * 0.4);
        outG = clamp255(v + 2.0);
        outB = clamp255(v + 6.0 - warmShift * 0.3);
        return;
    }

    if (substrate == NaturalSubstrateId::TantCotton) {
        const double warp = std::sin(x * 1.45) * 6.5;
        const double weft = std::sin(y * 1.45) * 6.5;
        const double slub = (fbm2D(nx * 18.0, ny * 4.0) - 0.5) * 14.0;
        const double weave = warp + weft + slub;
        outR = clamp255(234.0 + weave + warmShift * 0.5);
        outG = clamp255(226.0 + weave + warmShift * 0.25);
        outB = clamp255(209.0 + weave - warmShift * 0.3);
        return;
    }

    // Handmade Patachitra scroll paper
    const double fiber = (fbm2D(nx * 16.0, ny * 16.0) - 0.5) * 20.0;
    const double fleck = (hash2D(x >> 1, y >> 1) > 0.96) ? -16.0 : 0.0;
    const double dx = nx - 0.5;
    const double dy = ny - 0.5;
    const double edgeVig = (std::sqrt(dx * dx + dy * dy) > 0.46) ? -12.0 : 0.0;
    const double d = fiber + fleck + edgeVig;
    outR = clamp255(242.0 + d + warmShift * 0.6);
    outG = clamp255(231.0 + d + warmShift * 0.2);
    outB = clamp255(206.0 + d - warmShift * 0.4);
}

} // namespace

double hash2D(int ix, int iy) {
    uint32_t n = static_cast<uint32_t>(ix) * 374761393u +
                 static_cast<uint32_t>(iy) * 668265263u;
    n = n ^ (n >> 13);
    n = n * 1274126177u;
    n = n ^ (n >> 16);
    return static_cast<double>(n) / 4294967295.0;
}

double fbm2D(double x, double y) {
    return 0.58 * valueNoise2D(x, y) +
           0.29 * valueNoise2D(x * 2.03 + 11.7, y * 2.03 - 5.3) +
           0.13 * valueNoise2D(x * 4.11 - 7.1, y * 4.11 + 19.4);
}

CanvasBuffer renderNaturalMediaAlpona(
    const CanvasBuffer& studioSurface,
    Color bgColor,
    const NaturalMediaOptions& options) {
    const int width = studioSurface.width();
    const int height = studioSurface.height();
    const size_t total = static_cast<size_t>(width * height);
    CanvasBuffer out(width, height);

    std::vector<float> mask(total, 0.0f);
    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            const Color px = studioSurface.getPixel(x, y);
            const double dr = static_cast<double>(px.r) - static_cast<double>(bgColor.r);
            const double dg = static_cast<double>(px.g) - static_cast<double>(bgColor.g);
            const double db = static_cast<double>(px.b) - static_cast<double>(bgColor.b);
            const double dist = std::sqrt(dr * dr + dg * dg + db * db);
            mask[static_cast<size_t>(y * width + x)] =
                static_cast<float>(std::max(0.0, std::min(1.0, (dist - 16.0) / 68.0)));
        }
    }

    const bool isLightPaper =
        options.substrate == NaturalSubstrateId::TantCotton ||
        options.substrate == NaturalSubstrateId::PatachitraPaper;

    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            const size_t idx = static_cast<size_t>(y * width + x);
            uint8_t subR = 0, subG = 0, subB = 0;
            sampleSubstratePixel(x, y, width, height, options.substrate, options.warmth, subR, subG, subB);

            double alpha = mask[idx];
            const Color srcPx = studioSurface.getPixel(x, y);
            double pigR = srcPx.r;
            double pigG = srcPx.g;
            double pigB = srcPx.b;

            if (isLightPaper && alpha > 0.1 && pigR > 225.0 && pigG > 220.0 && pigB > 210.0) {
                pigR = 178.0;
                pigG = 34.0;
                pigB = 34.0;
            }

            if (alpha < 0.15 && options.speckleIntensity > 0.01) {
                const float up = (y > 1) ? mask[static_cast<size_t>((y - 2) * width + x)] : 0.0f;
                const float dn = (y < height - 2) ? mask[static_cast<size_t>((y + 2) * width + x)] : 0.0f;
                const float lf = (x > 1) ? mask[static_cast<size_t>(y * width + (x - 2))] : 0.0f;
                const float rt = (x < width - 2) ? mask[static_cast<size_t>(y * width + (x + 2))] : 0.0f;
                const float halo = std::max(std::max(up, dn), std::max(lf, rt));
                if (halo > 0.4f) {
                    const double sp = hash2D(x * 3 + 7, y * 3 + 13);
                    if (sp > 1.0 - options.speckleIntensity * 0.28) {
                        alpha = 0.35 + 0.30 * options.speckleIntensity;
                        pigR = isLightPaper ? 165.0 : 246.0;
                        pigG = isLightPaper ? 42.0 : 242.0;
                        pigB = isLightPaper ? 36.0 : 232.0;
                    }
                }
            }

            if (alpha <= 0.01) {
                out.setPixel(x, y, {subR, subG, subB, 255});
                continue;
            }

            const double grain = fbm2D(x * 0.14, y * 0.14);
            const double bristle = 1.0 - options.brushGrain * (0.48 * (1.0 - grain));
            const double effAlpha = std::max(0.12, std::min(1.0, alpha * bristle));

            double impastoLift = 0.0;
            if (options.pasteImpasto > 0.01 && x > 0 && y > 0 && x < width - 1 && y < height - 1) {
                const double gx = mask[idx + 1] - mask[idx - 1];
                const double gy = mask[idx + static_cast<size_t>(width)] - mask[idx - static_cast<size_t>(width)];
                impastoLift = (-gx * 0.7 - gy * 0.7) * 44.0 * options.pasteImpasto;
            }

            const double pr = clamp255(pigR + impastoLift);
            const double pg = clamp255(pigG + impastoLift);
            const double pb = clamp255(pigB + impastoLift * 0.9);

            out.setPixel(x, y, {
                clamp255(subR * (1.0 - effAlpha) + pr * effAlpha),
                clamp255(subG * (1.0 - effAlpha) + pg * effAlpha),
                clamp255(subB * (1.0 - effAlpha) + pb * effAlpha),
                255
            });
        }
    }

    return out;
}

} // namespace alpona
