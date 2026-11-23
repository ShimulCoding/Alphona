#include "photo_unwarper.h"
#include <algorithm>
#include <cmath>
#include <vector>

namespace alpona {

namespace {

const double kPi = 3.14159265358979323846;

void sampleBilinear(
    const CanvasBuffer& src,
    double fx,
    double fy,
    double& outR,
    double& outG,
    double& outB
) {
    const int w = src.width();
    const int h = src.height();
    const double x = std::max(0.0, std::min(static_cast<double>(w) - 1.001, fx));
    const double y = std::max(0.0, std::min(static_cast<double>(h) - 1.001, fy));
    const int x0 = static_cast<int>(std::floor(x));
    const int y0 = static_cast<int>(std::floor(y));
    const int x1 = std::min(w - 1, x0 + 1);
    const int y1 = std::min(h - 1, y0 + 1);
    const double dx = x - x0;
    const double dy = y - y0;

    const Color c00 = src.getPixel(x0, y0);
    const Color c10 = src.getPixel(x1, y0);
    const Color c01 = src.getPixel(x0, y1);
    const Color c11 = src.getPixel(x1, y1);

    const double w00 = (1.0 - dx) * (1.0 - dy);
    const double w10 = dx * (1.0 - dy);
    const double w01 = (1.0 - dx) * dy;
    const double w11 = dx * dy;

    outR = c00.r * w00 + c10.r * w10 + c01.r * w01 + c11.r * w11;
    outG = c00.g * w00 + c10.g * w10 + c01.g * w01 + c11.g * w11;
    outB = c00.b * w00 + c10.b * w10 + c01.b * w01 + c11.b * w11;
}

uint8_t clampByte(double v) {
    if (v < 0.0) return 0;
    if (v > 255.0) return 255;
    return static_cast<uint8_t>(std::floor(v + 0.5));
}

} // namespace

CanvasBuffer rectifyPhotoQuad(
    const CanvasBuffer& photo,
    const HomographyQuad& quad,
    int outSize
) {
    const int dim = std::max(32, std::min(720, outSize));
    CanvasBuffer out(dim, dim);
    const HomographyResult hom = solveHomographyFromUnitSquare(quad);
    if (!hom.valid) return out;

    const double invDenom = 1.0 / static_cast<double>(std::max(1, dim - 1));
    for (int y = 0; y < dim; ++y) {
        const double v = y * invDenom;
        for (int x = 0; x < dim; ++x) {
            const double u = x * invDenom;
            const Point2D srcPt = applyHomography(hom.h, u, v);
            double r = 0.0, g = 0.0, b = 0.0;
            sampleBilinear(photo, srcPt.x, srcPt.y, r, g, b);
            out.setPixel(x, y, {clampByte(r), clampByte(g), clampByte(b), 255});
        }
    }
    return out;
}

SymmetryReport detectRotationalSymmetryOrder(const CanvasBuffer& flatSurface) {
    const int w = flatSurface.width();
    const int h = flatSurface.height();
    const double cx = (w - 1) * 0.5;
    const double cy = (h - 1) * 0.5;
    const double maxR = std::min(cx, cy) * 0.92;

    const int angleBins = 96;
    const double radii[6] = {0.24, 0.36, 0.48, 0.60, 0.72, 0.84};

    std::vector<std::vector<double> > profiles(6, std::vector<double>(angleBins, 0.0));
    for (int ri = 0; ri < 6; ++ri) {
        const double r = radii[ri] * maxR;
        double mean = 0.0;
        for (int a = 0; a < angleBins; ++a) {
            const double th = (2.0 * kPi * a) / angleBins;
            double R = 0.0, G = 0.0, B = 0.0;
            sampleBilinear(flatSurface, cx + r * std::cos(th), cy + r * std::sin(th), R, G, B);
            const double lum = 0.299 * R + 0.587 * G + 0.114 * B;
            profiles[ri][a] = lum;
            mean += lum;
        }
        mean /= angleBins;
        for (int a = 0; a < angleBins; ++a) {
            profiles[ri][a] -= mean;
        }
    }

    const int candidates[4] = {4, 6, 8, 12};
    SymmetryReport report;
    report.detectedSectors = 8;
    report.confidencePercent = 0;
    double maxCorr = 0.001;

    for (int ci = 0; ci < 4; ++ci) {
        const int n = candidates[ci];
        const int shift = angleBins / n;
        double num = 0.0;
        double den = 0.0;
        for (int ri = 0; ri < 6; ++ri) {
            for (int a = 0; a < angleBins; ++a) {
                const int b = (a + shift) % angleBins;
                num += profiles[ri][a] * profiles[ri][b];
                den += profiles[ri][a] * profiles[ri][a];
            }
        }
        double corr = (den > 1e-6) ? std::max(0.0, std::min(1.0, num / den)) : 0.0;
        report.scores.push_back({n, corr});
        if (corr > maxCorr) maxCorr = corr;
    }

    SymmetryScore best = report.scores[0];
    for (size_t i = 0; i < report.scores.size(); ++i) {
        if (report.scores[i].correlation >= maxCorr - 0.035) {
            best = report.scores[i];
        }
    }
    report.detectedSectors = best.sectors;
    report.confidencePercent = static_cast<int>(std::floor(best.correlation * 100.0 + 0.5));
    return report;
}

CanvasBuffer restoreRotationalSymmetry(
    const CanvasBuffer& flatSurface,
    int sectors,
    bool reflect
) {
    const int dim = std::min(flatSurface.width(), flatSurface.height());
    const int n = std::max(3, std::min(16, sectors));
    CanvasBuffer out(dim, dim);

    const double cx = (dim - 1) * 0.5;
    const double cy = (dim - 1) * 0.5;

    std::vector<double> cosArr(static_cast<size_t>(n));
    std::vector<double> sinArr(static_cast<size_t>(n));
    for (int k = 0; k < n; ++k) {
        const double th = (2.0 * kPi * k) / n;
        cosArr[static_cast<size_t>(k)] = std::cos(th);
        sinArr[static_cast<size_t>(k)] = std::sin(th);
    }

    struct SampleRGB {
        double r, g, b, lum;
    };
    const int copyCount = reflect ? n * 2 : n;
    std::vector<SampleRGB> samples(static_cast<size_t>(copyCount));

    for (int y = 0; y < dim; ++y) {
        const double dy = y - cy;
        for (int x = 0; x < dim; ++x) {
            const double dx = x - cx;
            int idx = 0;
            for (int k = 0; k < n; ++k) {
                const double c = cosArr[static_cast<size_t>(k)];
                const double s = sinArr[static_cast<size_t>(k)];
                double r = 0.0, g = 0.0, b = 0.0;
                sampleBilinear(flatSurface, cx + dx * c - dy * s, cy + dx * s + dy * c, r, g, b);
                samples[static_cast<size_t>(idx++)] = {r, g, b, 0.299 * r + 0.587 * g + 0.114 * b};

                if (reflect) {
                    double mr = 0.0, mg = 0.0, mb = 0.0;
                    sampleBilinear(flatSurface, cx - dx * c - dy * s, cy - dx * s + dy * c, mr, mg, mb);
                    samples[static_cast<size_t>(idx++)] = {mr, mg, mb, 0.299 * mr + 0.587 * mg + 0.114 * mb};
                }
            }

            std::sort(
                samples.begin(),
                samples.end(),
                [](const SampleRGB& a, const SampleRGB& b) { return a.lum > b.lum; }
            );

            const int keep = std::max(1, static_cast<int>(std::floor(copyCount * 0.65 + 0.5)));
            double sumR = 0.0, sumG = 0.0, sumB = 0.0;
            for (int i = 0; i < keep; ++i) {
                sumR += samples[static_cast<size_t>(i)].r;
                sumG += samples[static_cast<size_t>(i)].g;
                sumB += samples[static_cast<size_t>(i)].b;
            }
            out.setPixel(x, y, {
                clampByte(sumR / keep),
                clampByte(sumG / keep),
                clampByte(sumB / keep),
                255
            });
        }
    }

    return out;
}

} // namespace alpona
