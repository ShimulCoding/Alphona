#include "../include/image_processing.h"
#include <algorithm>
#include <cmath>

namespace alpona {

namespace {
constexpr double kPi = 3.14159265358979323846;

uint8_t clampByte(double v) {
    if (v < 0.0) return 0;
    if (v > 255.0) return 255;
    return static_cast<uint8_t>(std::lround(v));
}

uint8_t luminanceOf(Color c) {
    return clampByte(0.299 * c.r + 0.587 * c.g + 0.114 * c.b);
}
} // namespace

CanvasBuffer applyGrayscale(const CanvasBuffer& src) {
    CanvasBuffer out(src.width(), src.height());
    for (int y = 0; y < src.height(); ++y) {
        for (int x = 0; x < src.width(); ++x) {
            uint8_t lum = luminanceOf(src.getPixel(x, y));
            out.setPixel(x, y, {lum, lum, lum, 255});
        }
    }
    return out;
}

CanvasBuffer applyNegative(const CanvasBuffer& src) {
    CanvasBuffer out(src.width(), src.height());
    for (int y = 0; y < src.height(); ++y) {
        for (int x = 0; x < src.width(); ++x) {
            Color c = src.getPixel(x, y);
            out.setPixel(x, y, {
                static_cast<uint8_t>(255 - c.r),
                static_cast<uint8_t>(255 - c.g),
                static_cast<uint8_t>(255 - c.b),
                255
            });
        }
    }
    return out;
}

CanvasBuffer applyGammaTransform(const CanvasBuffer& src, double gamma) {
    CanvasBuffer out(src.width(), src.height());
    uint8_t lut[256];
    for (int i = 0; i < 256; ++i) {
        lut[i] = clampByte(255.0 * std::pow(static_cast<double>(i) / 255.0, gamma));
    }
    for (int y = 0; y < src.height(); ++y) {
        for (int x = 0; x < src.width(); ++x) {
            Color c = src.getPixel(x, y);
            out.setPixel(x, y, {lut[c.r], lut[c.g], lut[c.b], 255});
        }
    }
    return out;
}

CanvasBuffer applyLogTransform(const CanvasBuffer& src) {
    CanvasBuffer out(src.width(), src.height());
    const double scale = 255.0 / std::log(256.0);
    for (int y = 0; y < src.height(); ++y) {
        for (int x = 0; x < src.width(); ++x) {
            Color c = src.getPixel(x, y);
            out.setPixel(x, y, {
                clampByte(scale * std::log(1.0 + c.r)),
                clampByte(scale * std::log(1.0 + c.g)),
                clampByte(scale * std::log(1.0 + c.b)),
                255
            });
        }
    }
    return out;
}

std::array<int, 256> computeLuminanceHistogram(const CanvasBuffer& src) {
    std::array<int, 256> hist;
    hist.fill(0);
    for (int y = 0; y < src.height(); ++y) {
        for (int x = 0; x < src.width(); ++x) {
            hist[luminanceOf(src.getPixel(x, y))]++;
        }
    }
    return hist;
}

CanvasBuffer applyHistogramEqualization(const CanvasBuffer& src) {
    auto hist = computeLuminanceHistogram(src);
    const int total = src.width() * src.height();
    int cdf[256] = {};
    int running = 0;
    int cdfMin = 0;
    for (int i = 0; i < 256; ++i) {
        running += hist[i];
        cdf[i] = running;
        if (cdfMin == 0 && running > 0) cdfMin = running;
    }
    const double denom = static_cast<double>(std::max(1, total - cdfMin));
    uint8_t eqLut[256];
    for (int i = 0; i < 256; ++i) {
        eqLut[i] = clampByte(((cdf[i] - cdfMin) / denom) * 255.0);
    }

    CanvasBuffer out(src.width(), src.height());
    for (int y = 0; y < src.height(); ++y) {
        for (int x = 0; x < src.width(); ++x) {
            Color c = src.getPixel(x, y);
            uint8_t lum = luminanceOf(c);
            uint8_t eq = eqLut[lum];
            if (lum == 0) {
                out.setPixel(x, y, {eq, eq, eq, 255});
            } else {
                double ratio = static_cast<double>(eq) / static_cast<double>(lum);
                out.setPixel(x, y, {
                    clampByte(c.r * ratio),
                    clampByte(c.g * ratio),
                    clampByte(c.b * ratio),
                    255
                });
            }
        }
    }
    return out;
}

CanvasBuffer applySpatialFilter(const CanvasBuffer& src, SpatialFilterType filter) {
    const int w = src.width();
    const int h = src.height();
    CanvasBuffer out(w, h);

    if (filter == SpatialFilterType::SobelEdge) {
        std::vector<double> lum(static_cast<size_t>(w * h));
        for (int y = 0; y < h; ++y) {
            for (int x = 0; x < w; ++x) {
                lum[static_cast<size_t>(y * w + x)] = luminanceOf(src.getPixel(x, y));
            }
        }
        for (int y = 0; y < h; ++y) {
            for (int x = 0; x < w; ++x) {
                int y0 = std::max(0, y - 1), y2 = std::min(h - 1, y + 1);
                int x0 = std::max(0, x - 1), x2 = std::min(w - 1, x + 1);
                double gx =
                    -lum[y0 * w + x0] + lum[y0 * w + x2] -
                    2.0 * lum[y * w + x0] + 2.0 * lum[y * w + x2] -
                    lum[y2 * w + x0] + lum[y2 * w + x2];
                double gy =
                    -lum[y0 * w + x0] - 2.0 * lum[y0 * w + x] - lum[y0 * w + x2] +
                    lum[y2 * w + x0] + 2.0 * lum[y2 * w + x] + lum[y2 * w + x2];
                uint8_t mag = clampByte(std::hypot(gx, gy));
                out.setPixel(x, y, {mag, mag, mag, 255});
            }
        }
        return out;
    }

    int kernel[9];
    double divisor = 1.0;
    if (filter == SpatialFilterType::BoxMean) {
        int k[9] = {1, 1, 1, 1, 1, 1, 1, 1, 1};
        std::copy(k, k + 9, kernel);
        divisor = 9.0;
    } else if (filter == SpatialFilterType::Gaussian) {
        int k[9] = {1, 2, 1, 2, 4, 2, 1, 2, 1};
        std::copy(k, k + 9, kernel);
        divisor = 16.0;
    } else {
        int k[9] = {0, -1, 0, -1, 5, -1, 0, -1, 0};
        std::copy(k, k + 9, kernel);
        divisor = 1.0;
    }

    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            double rSum = 0.0, gSum = 0.0, bSum = 0.0;
            for (int ky = -1; ky <= 1; ++ky) {
                int sy = std::max(0, std::min(h - 1, y + ky));
                for (int kx = -1; kx <= 1; ++kx) {
                    int sx = std::max(0, std::min(w - 1, x + kx));
                    int weight = kernel[(ky + 1) * 3 + (kx + 1)];
                    Color c = src.getPixel(sx, sy);
                    rSum += c.r * weight;
                    gSum += c.g * weight;
                    bSum += c.b * weight;
                }
            }
            out.setPixel(x, y, {
                clampByte(rSum / divisor),
                clampByte(gSum / divisor),
                clampByte(bSum / divisor),
                255
            });
        }
    }
    return out;
}

void fft1d(std::vector<std::complex<double>>& a, bool inverse) {
    const size_t n = a.size();
    for (size_t i = 1, j = 0; i < n; ++i) {
        size_t bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) std::swap(a[i], a[j]);
    }

    const double sign = inverse ? 1.0 : -1.0;
    for (size_t len = 2; len <= n; len <<= 1) {
        const double ang = sign * 2.0 * kPi / static_cast<double>(len);
        const std::complex<double> wlen(std::cos(ang), std::sin(ang));
        for (size_t i = 0; i < n; i += len) {
            std::complex<double> w(1.0, 0.0);
            for (size_t j = 0; j < len / 2; ++j) {
                auto u = a[i + j];
                auto v = a[i + j + len / 2] * w;
                a[i + j] = u + v;
                a[i + j + len / 2] = u - v;
                w *= wlen;
            }
        }
    }

    if (inverse) {
        for (auto& x : a) x /= static_cast<double>(n);
    }
}

CanvasBuffer applyFrequencyFilter(
    const CanvasBuffer& src,
    FrequencyFilterType filter,
    double cutoffD0,
    int fftSize
) {
    const int N = fftSize;
    std::vector<std::complex<double>> grid(static_cast<size_t>(N * N));
    for (int y = 0; y < N; ++y) {
        int sy = std::min(src.height() - 1, (y * src.height()) / N);
        for (int x = 0; x < N; ++x) {
            int sx = std::min(src.width() - 1, (x * src.width()) / N);
            double lum = luminanceOf(src.getPixel(sx, sy));
            double sign = ((x + y) % 2 == 0) ? 1.0 : -1.0;
            grid[static_cast<size_t>(y * N + x)] = {lum * sign, 0.0};
        }
    }

    auto transform2D = [&](bool inv) {
        std::vector<std::complex<double>> line(static_cast<size_t>(N));
        for (int y = 0; y < N; ++y) {
            for (int x = 0; x < N; ++x) line[x] = grid[y * N + x];
            fft1d(line, inv);
            for (int x = 0; x < N; ++x) grid[y * N + x] = line[x];
        }
        for (int x = 0; x < N; ++x) {
            for (int y = 0; y < N; ++y) line[y] = grid[y * N + x];
            fft1d(line, inv);
            for (int y = 0; y < N; ++y) grid[y * N + x] = line[y];
        }
    };

    transform2D(false);

    const double half = N / 2.0;
    const double twoD0Sq = 2.0 * cutoffD0 * cutoffD0;
    for (int v = 0; v < N; ++v) {
        for (int u = 0; u < N; ++u) {
            double dist = std::hypot(u - half, v - half);
            double h = 1.0;
            if (filter == FrequencyFilterType::IdealLowPass) {
                h = (dist <= cutoffD0) ? 1.0 : 0.0;
            } else if (filter == FrequencyFilterType::GaussianLowPass) {
                h = std::exp(-(dist * dist) / twoD0Sq);
            } else if (filter == FrequencyFilterType::IdealHighPass) {
                h = (dist > cutoffD0) ? 1.0 : 0.0;
            } else {
                h = 1.0 - std::exp(-(dist * dist) / twoD0Sq);
            }
            grid[static_cast<size_t>(v * N + u)] *= h;
        }
    }

    transform2D(true);

    CanvasBuffer out(N, N);
    for (int y = 0; y < N; ++y) {
        for (int x = 0; x < N; ++x) {
            double sign = ((x + y) % 2 == 0) ? 1.0 : -1.0;
            double val = grid[static_cast<size_t>(y * N + x)].real() * sign;
            if (filter == FrequencyFilterType::IdealHighPass ||
                filter == FrequencyFilterType::GaussianHighPass) {
                val = std::fabs(val) * 1.8;
            }
            uint8_t b = clampByte(val);
            out.setPixel(x, y, {b, b, b, 255});
        }
    }
    return out;
}

CanvasBuffer extractPrintableStencil(const CanvasBuffer& src, int threshold) {
    CanvasBuffer blurred = applySpatialFilter(src, SpatialFilterType::Gaussian);
    CanvasBuffer edges = applySpatialFilter(blurred, SpatialFilterType::SobelEdge);
    const int w = edges.width();
    const int h = edges.height();
    const int safeThresh = std::max(12, std::min(220, threshold));
    CanvasBuffer out(w, h);
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            int mag = static_cast<int>(edges.getPixel(x, y).r);
            uint8_t v = (mag >= safeThresh) ? 20 : 255;
            out.setPixel(x, y, {v, v, v, 255});
        }
    }
    return out;
}

PixelMetrics computePixelRelationships(
    const CanvasBuffer& src,
    int x1, int y1,
    int x2, int y2,
    int intensityTolerance
) {
    const int w = src.width();
    const int h = src.height();
    x1 = std::max(0, std::min(w - 1, x1));
    y1 = std::max(0, std::min(h - 1, y1));
    x2 = std::max(0, std::min(w - 1, x2));
    y2 = std::max(0, std::min(h - 1, y2));

    const int lum1 = static_cast<int>(luminanceOf(src.getPixel(x1, y1)));
    const int lum2 = static_cast<int>(luminanceOf(src.getPixel(x2, y2)));
    const int dx = std::abs(x1 - x2);
    const int dy = std::abs(y1 - y2);

    PixelMetrics m = {};
    m.d4CityBlock = dx + dy;
    m.d8Chessboard = std::max(dx, dy);
    m.deEuclidean = std::hypot(static_cast<double>(dx), static_cast<double>(dy));

    const int dirs4[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
    const int dirs8[8][2] = {
        {1, 0}, {-1, 0}, {0, 1}, {0, -1},
        {1, 1}, {1, -1}, {-1, 1}, {-1, -1}
    };

    for (int i = 0; i < 4; ++i) {
        int nx = x1 + dirs4[i][0], ny = y1 + dirs4[i][1];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) ++m.n4Count;
    }
    for (int i = 0; i < 8; ++i) {
        int nx = x1 + dirs8[i][0], ny = y1 + dirs8[i][1];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) ++m.n8Count;
    }

    const bool sameBand = std::abs(lum1 - lum2) <= intensityTolerance;
    m.is4Adjacent = (m.d4CityBlock == 1) && sameBand;
    m.is8Adjacent = (m.d8Chessboard == 1) && sameBand;

    auto runBfs = [&](bool useEight, bool& reachesTarget) -> int {
        const size_t total = static_cast<size_t>(w * h);
        std::vector<uint8_t> visited(total, 0);
        std::vector<int> q;
        q.reserve(total);
        const int startIdx = y1 * w + x1;
        const int targetIdx = y2 * w + x2;
        visited[static_cast<size_t>(startIdx)] = 1;
        q.push_back(startIdx);
        reachesTarget = (startIdx == targetIdx);

        size_t head = 0;
        const int dirCount = useEight ? 8 : 4;
        while (head < q.size()) {
            const int curr = q[head++];
            const int cy = curr / w;
            const int cx = curr - cy * w;
            for (int d = 0; d < dirCount; ++d) {
                const int nx = cx + (useEight ? dirs8[d][0] : dirs4[d][0]);
                const int ny = cy + (useEight ? dirs8[d][1] : dirs4[d][1]);
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                const int nIdx = ny * w + nx;
                if (visited[static_cast<size_t>(nIdx)]) continue;
                const int nLum = static_cast<int>(luminanceOf(src.getPixel(nx, ny)));
                if (std::abs(nLum - lum1) <= intensityTolerance) {
                    visited[static_cast<size_t>(nIdx)] = 1;
                    if (nIdx == targetIdx) reachesTarget = true;
                    q.push_back(nIdx);
                }
            }
        }
        return static_cast<int>(q.size());
    };

    m.component4Size = runBfs(false, m.connected4Path);
    m.component8Size = runBfs(true, m.connected8Path);
    return m;
}

static std::vector<uint8_t> binaryDilateMask(
    const std::vector<uint8_t>& mask,
    int w, int h, int radius
) {
    std::vector<uint8_t> out(mask.size(), 0);
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            uint8_t hit = 0;
            for (int ky = -radius; ky <= radius && !hit; ++ky) {
                int ny = y + ky;
                if (ny < 0 || ny >= h) continue;
                for (int kx = -radius; kx <= radius; ++kx) {
                    int nx = x + kx;
                    if (nx < 0 || nx >= w) continue;
                    if (mask[static_cast<size_t>(ny * w + nx)]) {
                        hit = 1;
                        break;
                    }
                }
            }
            out[static_cast<size_t>(y * w + x)] = hit;
        }
    }
    return out;
}

static std::vector<uint8_t> binaryErodeMask(
    const std::vector<uint8_t>& mask,
    int w, int h, int radius
) {
    std::vector<uint8_t> out(mask.size(), 0);
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            uint8_t all = 1;
            for (int ky = -radius; ky <= radius && all; ++ky) {
                int ny = y + ky;
                if (ny < 0 || ny >= h) { all = 0; break; }
                for (int kx = -radius; kx <= radius; ++kx) {
                    int nx = x + kx;
                    if (nx < 0 || nx >= w || !mask[static_cast<size_t>(ny * w + nx)]) {
                        all = 0;
                        break;
                    }
                }
            }
            out[static_cast<size_t>(y * w + x)] = all;
        }
    }
    return out;
}

CanvasBuffer applyMorphology(
    const CanvasBuffer& src,
    MorphologyOpType op,
    int radius,
    int threshold,
    MorphologyMetrics* outMetrics
) {
    const int w = src.width();
    const int h = src.height();
    const int r = std::max(1, std::min(3, radius));
    const size_t total = static_cast<size_t>(w * h);

    int cornerLum = (
        static_cast<int>(luminanceOf(src.getPixel(0, 0))) +
        static_cast<int>(luminanceOf(src.getPixel(w - 1, 0))) +
        static_cast<int>(luminanceOf(src.getPixel(0, h - 1))) +
        static_cast<int>(luminanceOf(src.getPixel(w - 1, h - 1)))
    ) / 4;
    const bool darkInkOnLightBg = cornerLum > 160;

    std::vector<uint8_t> mask(total, 0);
    int fgBefore = 0;
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            int lum = static_cast<int>(luminanceOf(src.getPixel(x, y)));
            bool isFg = darkInkOnLightBg ? (lum < 255 - threshold) : (lum > threshold);
            if (isFg) {
                mask[static_cast<size_t>(y * w + x)] = 1;
                ++fgBefore;
            }
        }
    }

    std::vector<uint8_t> resMask;
    if (op == MorphologyOpType::Dilate) {
        resMask = binaryDilateMask(mask, w, h, r);
    } else if (op == MorphologyOpType::Erode) {
        resMask = binaryErodeMask(mask, w, h, r);
    } else if (op == MorphologyOpType::Open) {
        resMask = binaryDilateMask(binaryErodeMask(mask, w, h, r), w, h, r);
    } else {
        resMask = binaryErodeMask(binaryDilateMask(mask, w, h, r), w, h, r);
    }

    CanvasBuffer out(w, h);
    int fgAfter = 0;
    int gapsBridged = 0;
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            size_t idx = static_cast<size_t>(y * w + x);
            bool fg = resMask[idx] == 1;
            if (fg) ++fgAfter;
            bool bridged = fg && mask[idx] == 0;
            if (bridged) ++gapsBridged;
            if (bridged && op == MorphologyOpType::Close) {
                out.setPixel(x, y, {220, 38, 38, 255});
            } else if (fg) {
                uint8_t v = darkInkOnLightBg ? 22 : 248;
                out.setPixel(x, y, {v, v, v, 255});
            } else {
                uint8_t v = darkInkOnLightBg ? 252 : 22;
                out.setPixel(x, y, {v, v, v, 255});
            }
        }
    }

    if (outMetrics) {
        outMetrics->foregroundBefore = fgBefore;
        outMetrics->foregroundAfter = fgAfter;
        outMetrics->gapsBridged = gapsBridged;
    }
    return out;
}

CanvasBuffer downsample2xSSAA(const CanvasBuffer& src) {
    const int outW = std::max(1, src.width() / 2);
    const int outH = std::max(1, src.height() / 2);
    CanvasBuffer out(outW, outH);

    for (int y = 0; y < outH; ++y) {
        const int sy = y * 2;
        for (int x = 0; x < outW; ++x) {
            const int sx = x * 2;
            const Color c00 = src.getPixel(sx, sy);
            const Color c10 = src.getPixel(sx + 1, sy);
            const Color c01 = src.getPixel(sx, sy + 1);
            const Color c11 = src.getPixel(sx + 1, sy + 1);
            Color avg;
            avg.r = static_cast<uint8_t>((static_cast<int>(c00.r) + c10.r + c01.r + c11.r + 2) / 4);
            avg.g = static_cast<uint8_t>((static_cast<int>(c00.g) + c10.g + c01.g + c11.g + 2) / 4);
            avg.b = static_cast<uint8_t>((static_cast<int>(c00.b) + c10.b + c01.b + c11.b + 2) / 4);
            avg.a = static_cast<uint8_t>((static_cast<int>(c00.a) + c10.a + c01.a + c11.a + 2) / 4);
            out.setPixel(x, y, avg);
        }
    }
    return out;
}

} // namespace alpona
