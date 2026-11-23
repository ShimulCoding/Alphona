#include "../include/projection3d.h"
#include "../include/rasterizer.h"
#include <algorithm>
#include <cmath>
#include <limits>

namespace alpona {

namespace {
constexpr double kPi = 3.14159265358979323846;

Vec3 rotX(Vec3 v, double r) {
    double c = std::cos(r), s = std::sin(r);
    return {v.x, v.y * c - v.z * s, v.y * s + v.z * c};
}

Vec3 rotY(Vec3 v, double r) {
    double c = std::cos(r), s = std::sin(r);
    return {v.x * c + v.z * s, v.y, -v.x * s + v.z * c};
}

Vec3 rotZ(Vec3 v, double r) {
    double c = std::cos(r), s = std::sin(r);
    return {v.x * c - v.y * s, v.x * s + v.y * c, v.z};
}

double edgeFn(double ax, double ay, double bx, double by, double px, double py) {
    return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
}

Color shadeLambert(Color base, Vec3 v0, Vec3 v1, Vec3 v2) {
    double ux = v1.x - v0.x, uy = v1.y - v0.y, uz = v1.z - v0.z;
    double vx = v2.x - v0.x, vy = v2.y - v0.y, vz = v2.z - v0.z;
    double nx = uy * vz - uz * vy;
    double ny = uz * vx - ux * vz;
    double nz = ux * vy - uy * vx;
    double len = std::sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 1e-9) len = 1.0;
    nx /= len; ny /= len; nz /= len;
    double ndotl = std::fabs(nx * 0.35 + ny * 0.82 - nz * 0.45);
    double intensity = 0.42 + 0.58 * ndotl;
    return {
        static_cast<uint8_t>(std::min(255.0, base.r * intensity)),
        static_cast<uint8_t>(std::min(255.0, base.g * intensity)),
        static_cast<uint8_t>(std::min(255.0, base.b * intensity)),
        255
    };
}
} // namespace

Vec3 transformVertex3D(Vec3 v, const Transform3DParams& params) {
    const double rx = params.rotXDeg * kPi / 180.0;
    const double ry = params.rotYDeg * kPi / 180.0;
    const double rz = params.rotZDeg * kPi / 180.0;

    Vec3 p = {v.x * params.scale, v.y * params.scale, v.z * params.scale};
    p = rotY(p, ry);
    p = rotX(p, -rx);
    p = rotZ(p, rz);
    return {p.x + params.translateX, p.y + params.translateY, p.z};
}

Vec3 projectPoint3D(Vec3 p, int width, int height, const Transform3DParams& params) {
    const double cx = width / 2.0;
    const double cy = height / 2.0;
    const double scalePx = std::min(width, height) * 0.36;

    if (params.projection == ProjectionMode::Parallel) {
        return {cx + p.x * scalePx, cy - p.y * scalePx, p.z};
    }

    if (params.allowCopAnomaly) {
        const double d = std::max(0.35, params.focalLength);
        double denom = d + p.z;
        if (std::fabs(denom) < 0.08) {
            denom = (denom >= 0.0) ? 0.08 : -0.08;
        }
        const double factor = d / denom;
        return {cx + p.x * factor * scalePx, cy - p.y * factor * scalePx, p.z};
    }

    const double d = std::max(1.6, params.focalLength);
    const double denom = std::max(0.35, d + p.z);
    const double factor = d / denom;
    return {cx + p.x * factor * scalePx, cy - p.y * factor * scalePx, p.z};
}

std::vector<Triangle3D> buildAlponaMonumentMesh(int sectorsInput) {
    const int sectors = std::max(4, std::min(16, sectorsInput));
    std::vector<Triangle3D> tris;

    const Color slate   = {69, 39, 36, 255};
    const Color ivory   = {250, 248, 242, 255};
    const Color ivory2  = {228, 224, 213, 255};
    const Color crimson = {220, 38, 38, 255};
    const Color terra   = {153, 27, 27, 255};
    const Color gold    = {245, 158, 11, 255};
    const Color amber   = {217, 119, 6, 255};

    // Base plinth
    const double ps = 1.15, py = -0.32;
    Vec3 pA = {-ps, py, -ps}, pB = {ps, py, -ps}, pC = {ps, py, ps}, pD = {-ps, py, ps};
    tris.push_back({pA, pB, pC, slate});
    tris.push_back({pA, pC, pD, slate});

    const double step = (2.0 * kPi) / static_cast<double>(sectors);
    for (int k = 0; k < sectors; ++k) {
        double a0 = k * step;
        double aMid = (k + 0.5) * step;
        double a1 = (k + 1) * step;

        tris.push_back({
            {std::cos(a0) * 0.48, -0.22, std::sin(a0) * 0.48},
            {std::cos(aMid) * 1.02, 0.02, std::sin(aMid) * 1.02},
            {std::cos(a1) * 0.48, -0.22, std::sin(a1) * 0.48},
            (k % 2 == 0) ? ivory : ivory2
        });

        tris.push_back({
            {std::cos(a0) * 0.24, -0.06, std::sin(a0) * 0.24},
            {std::cos(aMid) * 0.64, 0.24, std::sin(aMid) * 0.64},
            {std::cos(a1) * 0.24, -0.06, std::sin(a1) * 0.24},
            (k % 2 == 0) ? crimson : terra
        });

        tris.push_back({
            {std::cos(a0) * 0.26, 0.04, std::sin(a0) * 0.26},
            {0.0, 0.56, 0.0},
            {std::cos(a1) * 0.26, 0.04, std::sin(a1) * 0.26},
            (k % 2 == 0) ? gold : amber
        });
    }
    return tris;
}

Render3DStats render3DScene(
    CanvasBuffer& buffer,
    const std::vector<Triangle3D>& mesh,
    const Transform3DParams& params,
    Color bg
) {
    const int w = buffer.width();
    const int h = buffer.height();
    buffer.clear(bg);

    std::vector<double> zBuffer(
        static_cast<size_t>(w * h),
        std::numeric_limits<double>::infinity()
    );

    struct ProjTri {
        Vec3 p0, p1, p2;
        double avgZ;
        Color shaded;
        Color wire;
    };

    std::vector<ProjTri> projected;
    projected.reserve(mesh.size());

    for (const auto& tri : mesh) {
        Vec3 t0 = transformVertex3D(tri.v0, params);
        Vec3 t1 = transformVertex3D(tri.v1, params);
        Vec3 t2 = transformVertex3D(tri.v2, params);
        projected.push_back({
            projectPoint3D(t0, w, h, params),
            projectPoint3D(t1, w, h, params),
            projectPoint3D(t2, w, h, params),
            (t0.z + t1.z + t2.z) / 3.0,
            shadeLambert(tri.color, t0, t1, t2),
            tri.color
        });
    }

    if (params.hsrMode == HiddenSurfaceMode::Painters) {
        std::sort(
            projected.begin(),
            projected.end(),
            [](const ProjTri& a, const ProjTri& b) { return a.avgZ > b.avgZ; }
        );
    }

    Render3DStats stats = {static_cast<int>(mesh.size()), 0, 0, 0};

    if (params.hsrMode == HiddenSurfaceMode::Wireframe) {
        for (const auto& tri : projected) {
            stats.pixelsShaded += drawBresenhamLine(
                buffer,
                static_cast<int>(std::lround(tri.p0.x)),
                static_cast<int>(std::lround(tri.p0.y)),
                static_cast<int>(std::lround(tri.p1.x)),
                static_cast<int>(std::lround(tri.p1.y)),
                tri.wire, 1
            );
            stats.pixelsShaded += drawBresenhamLine(
                buffer,
                static_cast<int>(std::lround(tri.p1.x)),
                static_cast<int>(std::lround(tri.p1.y)),
                static_cast<int>(std::lround(tri.p2.x)),
                static_cast<int>(std::lround(tri.p2.y)),
                tri.wire, 1
            );
            stats.pixelsShaded += drawBresenhamLine(
                buffer,
                static_cast<int>(std::lround(tri.p2.x)),
                static_cast<int>(std::lround(tri.p2.y)),
                static_cast<int>(std::lround(tri.p0.x)),
                static_cast<int>(std::lround(tri.p0.y)),
                tri.wire, 1
            );
        }
        return stats;
    }

    const bool useZTest = (params.hsrMode == HiddenSurfaceMode::ZBuffer ||
                           params.hsrMode == HiddenSurfaceMode::DepthMap);
    const bool showDepth = (params.hsrMode == HiddenSurfaceMode::DepthMap);

    for (const auto& tri : projected) {
        int minX = std::max(0, static_cast<int>(std::floor(std::min({tri.p0.x, tri.p1.x, tri.p2.x}))));
        int maxX = std::min(w - 1, static_cast<int>(std::ceil(std::max({tri.p0.x, tri.p1.x, tri.p2.x}))));
        int minY = std::max(0, static_cast<int>(std::floor(std::min({tri.p0.y, tri.p1.y, tri.p2.y}))));
        int maxY = std::min(h - 1, static_cast<int>(std::ceil(std::max({tri.p0.y, tri.p1.y, tri.p2.y}))));

        double area = edgeFn(tri.p0.x, tri.p0.y, tri.p1.x, tri.p1.y, tri.p2.x, tri.p2.y);
        if (std::fabs(area) < 1e-4) continue;
        double invArea = 1.0 / area;

        for (int y = minY; y <= maxY; ++y) {
            for (int x = minX; x <= maxX; ++x) {
                double px = x + 0.5, py = y + 0.5;
                double w0 = edgeFn(tri.p1.x, tri.p1.y, tri.p2.x, tri.p2.y, px, py) * invArea;
                double w1 = edgeFn(tri.p2.x, tri.p2.y, tri.p0.x, tri.p0.y, px, py) * invArea;
                double w2 = 1.0 - w0 - w1;
                if (w0 < 0.0 || w1 < 0.0 || w2 < 0.0) continue;

                double z = w0 * tri.p0.z + w1 * tri.p1.z + w2 * tri.p2.z;
                size_t idx = static_cast<size_t>(y * w + x);

                if (useZTest) {
                    if (z < zBuffer[idx]) {
                        zBuffer[idx] = z;
                    } else {
                        ++stats.zBufferRejects;
                        continue;
                    }
                }

                if (showDepth) {
                    double norm = std::max(0.0, std::min(1.0, 1.0 - (z + 1.5) / 3.0));
                    uint8_t g = static_cast<uint8_t>(std::lround(norm * 245.0));
                    buffer.setPixel(x, y, {g, g, static_cast<uint8_t>(std::min(255, g + 10)), 255});
                } else {
                    buffer.setPixel(x, y, tri.shaded);
                }
                ++stats.pixelsShaded;
            }
        }
    }

    return stats;
}

Render3DStats render3DCourtyardFloor(
    CanvasBuffer& buffer,
    const CanvasBuffer& alponaTexture,
    const Transform3DParams& params,
    Color bg
) {
    const int w = buffer.width();
    const int h = buffer.height();
    buffer.clear(bg);

    struct TexTri {
        Vec3 v0, v1, v2;
        double u0, uv0, u1, uv1, u2, uv2;
        Color col;
        bool textured;
    };

    std::vector<TexTri> tris;
    const double half = 0.96;
    const double topY = -0.08;
    const double botY = -0.24;
    const Color ivory = {250, 248, 242, 255};
    const Color rimCol = {91, 48, 41, 255};
    const Color sideWarm = {110, 59, 50, 255};
    const Color sideDark = {63, 32, 27, 255};

    // 4x4 subdivided textured courtyard floor
    const int gridN = 4;
    for (int gz = 0; gz < gridN; ++gz) {
        double vA = static_cast<double>(gz) / gridN;
        double vB = static_cast<double>(gz + 1) / gridN;
        double z0 = -half + vA * 2.0 * half;
        double z1 = -half + vB * 2.0 * half;
        for (int gx = 0; gx < gridN; ++gx) {
            double uA = static_cast<double>(gx) / gridN;
            double uB = static_cast<double>(gx + 1) / gridN;
            double x0 = -half + uA * 2.0 * half;
            double x1 = -half + uB * 2.0 * half;
            Vec3 a = {x0, topY, z0}, b = {x1, topY, z0}, c = {x1, topY, z1}, d = {x0, topY, z1};
            tris.push_back({a, b, c, uA, vA, uB, vA, uB, vB, ivory, true});
            tris.push_back({a, c, d, uA, vA, uB, vB, uA, vB, ivory, true});
        }
    }

    // Courtyard plinth rim and vertical sides
    const double outer = 1.12;
    Vec3 topC[4] = {
        {-outer, topY - 0.008, -outer},
        { outer, topY - 0.008, -outer},
        { outer, topY - 0.008,  outer},
        {-outer, topY - 0.008,  outer}
    };
    Vec3 botC[4] = {
        {-outer, botY, -outer},
        { outer, botY, -outer},
        { outer, botY,  outer},
        {-outer, botY,  outer}
    };
    tris.push_back({topC[0], topC[1], topC[2], 0, 0, 0, 0, 0, 0, rimCol, false});
    tris.push_back({topC[0], topC[2], topC[3], 0, 0, 0, 0, 0, 0, rimCol, false});
    for (int i = 0; i < 4; ++i) {
        int nxt = (i + 1) % 4;
        Color sc = (i % 2 == 0) ? sideWarm : sideDark;
        tris.push_back({topC[i], topC[nxt], botC[nxt], 0, 0, 0, 0, 0, 0, sc, false});
        tris.push_back({topC[i], botC[nxt], botC[i], 0, 0, 0, 0, 0, 0, sc, false});
    }

    std::vector<double> zBuffer(
        static_cast<size_t>(w * h),
        std::numeric_limits<double>::infinity()
    );

    const double minD = params.allowCopAnomaly ? 0.35 : 1.6;
    const double effD = std::max(minD, params.focalLength);

    struct ProjTexTri {
        Vec3 p0, p1, p2;
        double invW0, invW1, invW2;
        double u0, v0, u1, v1, u2, v2;
        double avgZ;
        Color shaded;
        Color wire;
        bool textured;
    };

    Render3DStats stats = {static_cast<int>(tris.size()), 0, 0, 0};
    std::vector<ProjTexTri> projected;
    projected.reserve(tris.size());

    auto calcW = [&](double zVal) -> double {
        if (params.projection == ProjectionMode::Parallel) return 1.0;
        if (params.allowCopAnomaly) {
            double denom = effD + zVal;
            if (std::fabs(denom) < 0.08) denom = (denom >= 0.0) ? 0.08 : -0.08;
            return denom;
        }
        return std::max(0.35, effD + zVal);
    };

    for (const auto& tri : tris) {
        Vec3 t0 = transformVertex3D(tri.v0, params);
        Vec3 t1 = transformVertex3D(tri.v1, params);
        Vec3 t2 = transformVertex3D(tri.v2, params);

        if (params.projection == ProjectionMode::Perspective) {
            if (t0.z <= -effD) ++stats.anomalyVerticesCount;
            if (t1.z <= -effD) ++stats.anomalyVerticesCount;
            if (t2.z <= -effD) ++stats.anomalyVerticesCount;
        }

        projected.push_back({
            projectPoint3D(t0, w, h, params),
            projectPoint3D(t1, w, h, params),
            projectPoint3D(t2, w, h, params),
            1.0 / calcW(t0.z),
            1.0 / calcW(t1.z),
            1.0 / calcW(t2.z),
            tri.u0, tri.uv0, tri.u1, tri.uv1, tri.u2, tri.uv2,
            (t0.z + t1.z + t2.z) / 3.0,
            shadeLambert(tri.col, t0, t1, t2),
            tri.textured ? Color{245, 158, 11, 255} : tri.col,
            tri.textured
        });
    }

    if (params.hsrMode == HiddenSurfaceMode::Painters) {
        std::sort(
            projected.begin(),
            projected.end(),
            [](const ProjTexTri& a, const ProjTexTri& b) { return a.avgZ > b.avgZ; }
        );
    }

    if (params.hsrMode == HiddenSurfaceMode::Wireframe) {
        for (const auto& tri : projected) {
            stats.pixelsShaded += drawBresenhamLine(
                buffer,
                static_cast<int>(std::lround(tri.p0.x)), static_cast<int>(std::lround(tri.p0.y)),
                static_cast<int>(std::lround(tri.p1.x)), static_cast<int>(std::lround(tri.p1.y)),
                tri.wire, 1
            );
            stats.pixelsShaded += drawBresenhamLine(
                buffer,
                static_cast<int>(std::lround(tri.p1.x)), static_cast<int>(std::lround(tri.p1.y)),
                static_cast<int>(std::lround(tri.p2.x)), static_cast<int>(std::lround(tri.p2.y)),
                tri.wire, 1
            );
            stats.pixelsShaded += drawBresenhamLine(
                buffer,
                static_cast<int>(std::lround(tri.p2.x)), static_cast<int>(std::lround(tri.p2.y)),
                static_cast<int>(std::lround(tri.p0.x)), static_cast<int>(std::lround(tri.p0.y)),
                tri.wire, 1
            );
        }
        return stats;
    }

    const bool useZTest = (params.hsrMode == HiddenSurfaceMode::ZBuffer ||
                           params.hsrMode == HiddenSurfaceMode::DepthMap);
    const bool showDepth = (params.hsrMode == HiddenSurfaceMode::DepthMap);
    const int texW = alponaTexture.width();
    const int texH = alponaTexture.height();

    for (const auto& tri : projected) {
        int minX = std::max(0, static_cast<int>(std::floor(std::min({tri.p0.x, tri.p1.x, tri.p2.x}))));
        int maxX = std::min(w - 1, static_cast<int>(std::ceil(std::max({tri.p0.x, tri.p1.x, tri.p2.x}))));
        int minY = std::max(0, static_cast<int>(std::floor(std::min({tri.p0.y, tri.p1.y, tri.p2.y}))));
        int maxY = std::min(h - 1, static_cast<int>(std::ceil(std::max({tri.p0.y, tri.p1.y, tri.p2.y}))));
        if (minX > maxX || minY > maxY) continue;

        double area = edgeFn(tri.p0.x, tri.p0.y, tri.p1.x, tri.p1.y, tri.p2.x, tri.p2.y);
        if (std::fabs(area) < 1e-4) continue;
        double invArea = 1.0 / area;

        for (int y = minY; y <= maxY; ++y) {
            for (int x = minX; x <= maxX; ++x) {
                double px = x + 0.5, py = y + 0.5;
                double b0 = edgeFn(tri.p1.x, tri.p1.y, tri.p2.x, tri.p2.y, px, py) * invArea;
                double b1 = edgeFn(tri.p2.x, tri.p2.y, tri.p0.x, tri.p0.y, px, py) * invArea;
                double b2 = 1.0 - b0 - b1;
                if (b0 < 0.0 || b1 < 0.0 || b2 < 0.0) continue;

                double z = b0 * tri.p0.z + b1 * tri.p1.z + b2 * tri.p2.z;
                size_t idx = static_cast<size_t>(y * w + x);

                if (useZTest) {
                    if (z < zBuffer[idx]) {
                        zBuffer[idx] = z;
                    } else {
                        ++stats.zBufferRejects;
                        continue;
                    }
                }

                if (showDepth) {
                    double norm = std::max(0.0, std::min(1.0, 1.0 - (z + 1.5) / 3.0));
                    uint8_t g = static_cast<uint8_t>(std::lround(norm * 245.0));
                    buffer.setPixel(x, y, {g, g, static_cast<uint8_t>(std::min(255, g + 10)), 255});
                } else if (tri.textured) {
                    double invW = b0 * tri.invW0 + b1 * tri.invW1 + b2 * tri.invW2;
                    double u = (std::fabs(invW) > 1e-6)
                        ? (b0 * tri.u0 * tri.invW0 + b1 * tri.u1 * tri.invW1 + b2 * tri.u2 * tri.invW2) / invW
                        : (b0 * tri.u0 + b1 * tri.u1 + b2 * tri.u2);
                    double v = (std::fabs(invW) > 1e-6)
                        ? (b0 * tri.v0 * tri.invW0 + b1 * tri.v1 * tri.invW1 + b2 * tri.v2 * tri.invW2) / invW
                        : (b0 * tri.v0 + b1 * tri.v1 + b2 * tri.v2);
                    int tx = std::max(0, std::min(texW - 1, static_cast<int>(u * (texW - 1))));
                    int ty = std::max(0, std::min(texH - 1, static_cast<int>(v * (texH - 1))));
                    Color tc = alponaTexture.getPixel(tx, ty);
                    double shade = std::max(0.72, std::min(1.04, 0.96 - z * 0.08));
                    buffer.setPixel(x, y, {
                        static_cast<uint8_t>(std::min(255.0, tc.r * shade)),
                        static_cast<uint8_t>(std::min(255.0, tc.g * shade)),
                        static_cast<uint8_t>(std::min(255.0, tc.b * shade)),
                        255
                    });
                } else {
                    buffer.setPixel(x, y, tri.shaded);
                }
                ++stats.pixelsShaded;
            }
        }
    }

    return stats;
}

} // namespace alpona
