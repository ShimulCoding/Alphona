#include "phong_lighting.h"
#include <algorithm>
#include <cmath>

namespace alpona {

namespace {

uint8_t clampU8(double v) {
    if (v < 0.0) return 0;
    if (v > 255.0) return 255;
    return static_cast<uint8_t>(std::floor(v + 0.5));
}

void evalPhongPixel(
    double u,
    double v,
    const Vec3d& n,
    double albR,
    double albG,
    double albB,
    const std::vector<DiyaLight>& lights,
    const PhongMaterial& mat,
    double& outR,
    double& outG,
    double& outB
) {
    double vx = 0.5 - u;
    double vy = 0.5 - v;
    double vz = 1.45;
    const double vLen = std::sqrt(vx * vx + vy * vy + vz * vz);
    vx /= vLen;
    vy /= vLen;
    vz /= vLen;

    outR = mat.ka * albR * 0.78;
    outG = mat.ka * albG * 0.82;
    outB = mat.ka * albB * 0.96;

    for (size_t i = 0; i < lights.size(); ++i) {
        const DiyaLight& lt = lights[i];
        const double lxRaw = lt.x - u;
        const double lyRaw = lt.y - v;
        const double lzRaw = lt.z;
        const double distSq = lxRaw * lxRaw + lyRaw * lyRaw + lzRaw * lzRaw;
        const double dist = std::sqrt(distSq);
        const double lx = lxRaw / dist;
        const double ly = lyRaw / dist;
        const double lz = lzRaw / dist;

        const double atten = lt.intensity / (0.35 + 4.8 * distSq);
        const double nDotL = std::max(0.0, n.x * lx + n.y * ly + n.z * lz);

        double spec = 0.0;
        if (nDotL > 0.0 && mat.ks > 0.0) {
            const double rx = 2.0 * nDotL * n.x - lx;
            const double ry = 2.0 * nDotL * n.y - ly;
            const double rz = 2.0 * nDotL * n.z - lz;
            const double rDotV = std::max(0.0, rx * vx + ry * vy + rz * vz);
            spec = mat.ks * std::pow(rDotV, mat.shininess);
        }

        const double diff = mat.kd * nDotL;
        outR += atten * lt.r * (diff * albR + spec * 255.0);
        outG += atten * lt.g * (diff * albG + spec * 255.0);
        outB += atten * lt.b * (diff * albB + spec * 255.0);
    }
}

} // namespace

Vec3d computeReliefNormalAt(
    const std::vector<double>& heightfield,
    int width,
    int height,
    int x,
    int y,
    double reliefStrength
) {
    const int xm = std::max(0, x - 1);
    const int xp = std::min(width - 1, x + 1);
    const int ym = std::max(0, y - 1);
    const int yp = std::min(height - 1, y + 1);

    const double tl = heightfield[static_cast<size_t>(ym * width + xm)];
    const double tc = heightfield[static_cast<size_t>(ym * width + x)];
    const double tr = heightfield[static_cast<size_t>(ym * width + xp)];
    const double ml = heightfield[static_cast<size_t>(y * width + xm)];
    const double mr = heightfield[static_cast<size_t>(y * width + xp)];
    const double bl = heightfield[static_cast<size_t>(yp * width + xm)];
    const double bc = heightfield[static_cast<size_t>(yp * width + x)];
    const double br = heightfield[static_cast<size_t>(yp * width + xp)];

    const double gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    const double gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);

    const double nx = -gx * reliefStrength;
    const double ny = -gy * reliefStrength;
    const double nz = 1.0;
    const double invLen = 1.0 / std::sqrt(nx * nx + ny * ny + nz * nz);
    return {nx * invLen, ny * invLen, nz * invLen};
}

CanvasBuffer renderPhongDiyaLighting(
    const CanvasBuffer& alpona,
    Color background,
    const std::vector<DiyaLight>& lights,
    const PhongMaterial& material
) {
    const int w = alpona.width();
    const int h = alpona.height();
    CanvasBuffer out(w, h);

    std::vector<double> heightfield(static_cast<size_t>(w * h), 0.0);
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            const Color c = alpona.getPixel(x, y);
            const double dr = std::fabs(static_cast<double>(c.r) - background.r);
            const double dg = std::fabs(static_cast<double>(c.g) - background.g);
            const double db = std::fabs(static_cast<double>(c.b) - background.b);
            heightfield[static_cast<size_t>(y * w + x)] = std::min(1.0, ((dr + dg + db) / 765.0) * 1.45);
        }
    }

    const double invW = 1.0 / static_cast<double>(std::max(1, w - 1));
    const double invH = 1.0 / static_cast<double>(std::max(1, h - 1));

    if (material.model == DiyaShadingModel::NormalMap) {
        for (int y = 0; y < h; ++y) {
            for (int x = 0; x < w; ++x) {
                const Vec3d n = computeReliefNormalAt(heightfield, w, h, x, y, material.reliefStrength);
                out.setPixel(x, y, {
                    clampU8((n.x * 0.5 + 0.5) * 255.0),
                    clampU8((n.y * 0.5 + 0.5) * 255.0),
                    clampU8((n.z * 0.5 + 0.5) * 255.0),
                    255
                });
            }
        }
        return out;
    }

    if (material.model == DiyaShadingModel::Gouraud) {
        const int step = std::max(4, w / 32);
        const int gw = (w + step - 1) / step + 1;
        const int gh = (h + step - 1) / step + 1;
        std::vector<double> gR(static_cast<size_t>(gw * gh), 0.0);
        std::vector<double> gG(static_cast<size_t>(gw * gh), 0.0);
        std::vector<double> gB(static_cast<size_t>(gw * gh), 0.0);

        for (int gy = 0; gy < gh; ++gy) {
            const int py = std::min(h - 1, gy * step);
            for (int gx = 0; gx < gw; ++gx) {
                const int px = std::min(w - 1, gx * step);
                const Vec3d n = computeReliefNormalAt(heightfield, w, h, px, py, material.reliefStrength);
                double lr = 0.0, lg = 0.0, lb = 0.0;
                evalPhongPixel(px * invW, py * invH, n, 255.0, 255.0, 255.0, lights, material, lr, lg, lb);
                const size_t gi = static_cast<size_t>(gy * gw + gx);
                gR[gi] = lr / 255.0;
                gG[gi] = lg / 255.0;
                gB[gi] = lb / 255.0;
            }
        }

        for (int y = 0; y < h; ++y) {
            const int gy0 = y / step;
            const int gy1 = std::min(gh - 1, gy0 + 1);
            const double ty = static_cast<double>(y - gy0 * step) / step;
            for (int x = 0; x < w; ++x) {
                const int gx0 = x / step;
                const int gx1 = std::min(gw - 1, gx0 + 1);
                const double tx = static_cast<double>(x - gx0 * step) / step;
                const size_t i00 = static_cast<size_t>(gy0 * gw + gx0);
                const size_t i10 = static_cast<size_t>(gy0 * gw + gx1);
                const size_t i01 = static_cast<size_t>(gy1 * gw + gx0);
                const size_t i11 = static_cast<size_t>(gy1 * gw + gx1);
                const double w00 = (1.0 - tx) * (1.0 - ty);
                const double w10 = tx * (1.0 - ty);
                const double w01 = (1.0 - tx) * ty;
                const double w11 = tx * ty;
                const Color src = alpona.getPixel(x, y);
                const double ir = gR[i00] * w00 + gR[i10] * w10 + gR[i01] * w01 + gR[i11] * w11;
                const double ig = gG[i00] * w00 + gG[i10] * w10 + gG[i01] * w01 + gG[i11] * w11;
                const double ib = gB[i00] * w00 + gB[i10] * w10 + gB[i01] * w01 + gB[i11] * w11;
                out.setPixel(x, y, {
                    clampU8(src.r * ir),
                    clampU8(src.g * ig),
                    clampU8(src.b * ib),
                    255
                });
            }
        }
        return out;
    }

    // Per-Pixel Phong Illumination
    for (int y = 0; y < h; ++y) {
        const double v = y * invH;
        for (int x = 0; x < w; ++x) {
            const double u = x * invW;
            const Vec3d n = computeReliefNormalAt(heightfield, w, h, x, y, material.reliefStrength);
            const Color src = alpona.getPixel(x, y);
            double r = 0.0, g = 0.0, b = 0.0;
            evalPhongPixel(u, v, n, src.r, src.g, src.b, lights, material, r, g, b);
            out.setPixel(x, y, {clampU8(r), clampU8(g), clampU8(b), 255});
        }
    }
    return out;
}

} // namespace alpona
