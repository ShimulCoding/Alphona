#include "homography.h"
#include <algorithm>
#include <cmath>

namespace alpona {

static const double HOMOGRAPHY_PI = 3.14159265358979323846;

static bool solveLinear8(double A[8][9], double sol[8]) {
    for (int col = 0; col < 8; ++col) {
        int pivotRow = col;
        double maxAbs = std::fabs(A[col][col]);
        for (int r = col + 1; r < 8; ++r) {
            double v = std::fabs(A[r][col]);
            if (v > maxAbs) {
                maxAbs = v;
                pivotRow = r;
            }
        }
        if (maxAbs < 1e-10) return false;
        if (pivotRow != col) {
            for (int j = 0; j < 9; ++j) {
                std::swap(A[col][j], A[pivotRow][j]);
            }
        }
        double pivot = A[col][col];
        for (int j = col; j < 9; ++j) {
            A[col][j] /= pivot;
        }
        for (int r = 0; r < 8; ++r) {
            if (r == col) continue;
            double factor = A[r][col];
            if (std::fabs(factor) < 1e-12) continue;
            for (int j = col; j < 9; ++j) {
                A[r][j] -= factor * A[col][j];
            }
        }
    }
    for (int i = 0; i < 8; ++i) {
        sol[i] = A[i][8];
    }
    return true;
}

static bool invert3x3(const double m[9], double inv[9]) {
    const double a = m[0], b = m[1], c = m[2];
    const double d = m[3], e = m[4], f = m[5];
    const double g = m[6], h = m[7], i = m[8];

    const double A = e * i - f * h;
    const double B = -(d * i - f * g);
    const double C = d * h - e * g;
    const double D = -(b * i - c * h);
    const double E = a * i - c * g;
    const double F = -(a * h - b * g);
    const double G = b * f - c * e;
    const double H = -(a * f - c * d);
    const double I = a * e - b * d;

    const double det = a * A + b * B + c * C;
    if (std::fabs(det) < 1e-10) return false;
    const double invDet = 1.0 / det;
    inv[0] = A * invDet; inv[1] = D * invDet; inv[2] = G * invDet;
    inv[3] = B * invDet; inv[4] = E * invDet; inv[5] = H * invDet;
    inv[6] = C * invDet; inv[7] = F * invDet; inv[8] = I * invDet;
    return true;
}

HomographyResult solveHomographyFromUnitSquare(const HomographyQuad& quad) {
    HomographyResult res;
    const double srcU[4] = { 0.0, 1.0, 1.0, 0.0 };
    const double srcV[4] = { 0.0, 0.0, 1.0, 1.0 };
    const Point2D dst[4] = { quad.tl, quad.tr, quad.br, quad.bl };

    double A[8][9];
    for (int k = 0; k < 4; ++k) {
        const double u = srcU[k], v = srcV[k];
        const double x = dst[k].x, y = dst[k].y;

        A[2 * k][0] = u; A[2 * k][1] = v; A[2 * k][2] = 1.0;
        A[2 * k][3] = 0.0; A[2 * k][4] = 0.0; A[2 * k][5] = 0.0;
        A[2 * k][6] = -u * x; A[2 * k][7] = -v * x; A[2 * k][8] = x;

        A[2 * k + 1][0] = 0.0; A[2 * k + 1][1] = 0.0; A[2 * k + 1][2] = 0.0;
        A[2 * k + 1][3] = u; A[2 * k + 1][4] = v; A[2 * k + 1][5] = 1.0;
        A[2 * k + 1][6] = -u * y; A[2 * k + 1][7] = -v * y; A[2 * k + 1][8] = y;
    }

    double sol[8];
    if (!solveLinear8(A, sol)) {
        res.valid = false;
        return res;
    }
    for (int i = 0; i < 8; ++i) res.h[i] = sol[i];
    res.h[8] = 1.0;

    res.valid = invert3x3(res.h, res.inv);
    return res;
}

Point2D applyHomography(const double h[9], double x, double y) {
    const double w = h[6] * x + h[7] * y + h[8];
    const double safeW = (std::fabs(w) < 1e-8) ? 1e-8 : w;
    return {
        (h[0] * x + h[1] * y + h[2]) / safeW,
        (h[3] * x + h[4] * y + h[5]) / safeW
    };
}

static uint8_t clampByteH(double v) {
    if (v < 0.0) return 0;
    if (v > 255.0) return 255;
    return static_cast<uint8_t>(std::floor(v + 0.5));
}

int renderVirtualFloorTryOn(
    const CanvasBuffer& floorPhoto,
    const CanvasBuffer& alponaTexture,
    const HomographyQuad& quad,
    CanvasBuffer& outComposite,
    double opacity
) {
    outComposite = floorPhoto;
    const HomographyResult hom = solveHomographyFromUnitSquare(quad);
    if (!hom.valid) return 0;

    const double minX = std::max(0.0, std::floor(std::min(std::min(quad.tl.x, quad.tr.x), std::min(quad.br.x, quad.bl.x))));
    const double maxX = std::min(static_cast<double>(floorPhoto.width() - 1), std::ceil(std::max(std::max(quad.tl.x, quad.tr.x), std::max(quad.br.x, quad.bl.x))));
    const double minY = std::max(0.0, std::floor(std::min(std::min(quad.tl.y, quad.tr.y), std::min(quad.br.y, quad.bl.y))));
    const double maxY = std::min(static_cast<double>(floorPhoto.height() - 1), std::ceil(std::max(std::max(quad.tl.y, quad.tr.y), std::max(quad.br.y, quad.bl.y))));

    const double op = std::max(0.05, std::min(1.0, opacity));
    const int tw = alponaTexture.width();
    const int th = alponaTexture.height();
    int warped = 0;

    for (int y = static_cast<int>(minY); y <= static_cast<int>(maxY); ++y) {
        for (int x = static_cast<int>(minX); x <= static_cast<int>(maxX); ++x) {
            const double w = hom.inv[6] * x + hom.inv[7] * y + hom.inv[8];
            if (std::fabs(w) < 1e-8) continue;
            const double u = (hom.inv[0] * x + hom.inv[1] * y + hom.inv[2]) / w;
            const double v = (hom.inv[3] * x + hom.inv[4] * y + hom.inv[5]) / w;
            if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) continue;

            const double fx = u * (tw - 1);
            const double fy = v * (th - 1);
            const int x0 = static_cast<int>(std::floor(fx));
            const int y0 = static_cast<int>(std::floor(fy));
            const int x1 = std::min(tw - 1, x0 + 1);
            const int y1 = std::min(th - 1, y0 + 1);
            const double sx = fx - x0;
            const double sy = fy - y0;

            const Color c00 = alponaTexture.getPixel(x0, y0);
            const Color c10 = alponaTexture.getPixel(x1, y0);
            const Color c01 = alponaTexture.getPixel(x0, y1);
            const Color c11 = alponaTexture.getPixel(x1, y1);

            const double w00 = (1.0 - sx) * (1.0 - sy);
            const double w10 = sx * (1.0 - sy);
            const double w01 = (1.0 - sx) * sy;
            const double w11 = sx * sy;

            const double sr = c00.r * w00 + c10.r * w10 + c01.r * w01 + c11.r * w11;
            const double sg = c00.g * w00 + c10.g * w10 + c01.g * w01 + c11.g * w11;
            const double sb = c00.b * w00 + c10.b * w10 + c01.b * w01 + c11.b * w11;

            const Color fl = outComposite.getPixel(x, y);
            const Color blended = {
                clampByteH(fl.r * (1.0 - op) + sr * op),
                clampByteH(fl.g * (1.0 - op) + sg * op),
                clampByteH(fl.b * (1.0 - op) + sb * op),
                255
            };
            outComposite.setPixel(x, y, blended);
            warped++;
        }
    }

    return warped;
}

std::vector<ChalkRingSpec> computeChalkBlueprintRings(double diameterCm, int sectors) {
    const double safeDiam = std::max(40.0, std::min(600.0, diameterCm));
    const int safeSectors = std::max(3, std::min(16, sectors));
    const double maxR = safeDiam * 0.5;
    const double ratios[4] = { 0.25, 0.50, 0.75, 1.00 };

    std::vector<ChalkRingSpec> rings;
    rings.reserve(4);
    for (int i = 0; i < 4; ++i) {
        ChalkRingSpec r;
        r.ringIndex = i + 1;
        r.radiusCm = maxR * ratios[i];
        r.sectorChordCm = 2.0 * r.radiusCm * std::sin(HOMOGRAPHY_PI / static_cast<double>(safeSectors));
        rings.push_back(r);
    }
    return rings;
}

} // namespace alpona
