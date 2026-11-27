#include "../include/motifs.h"
#include "../include/floodfill.h"
#include "../include/rasterizer.h"
#include "../include/transforms.h"
#include "../include/svg_writer.h"
#include <iomanip>
#include <sstream>
#include <cmath>

namespace alpona {

namespace {
constexpr double kPi = 3.14159265358979323846;

Point2D polarPoint(double cx, double cy, double r, double deg) {
    const double rad = deg * kPi / 180.0;
    return {cx + std::cos(rad) * r, cy + std::sin(rad) * r};
}

std::vector<Point2D> sampleQuadratic(Point2D p0, Point2D ctrl, Point2D p2, int steps) {
    std::vector<Point2D> pts;
    pts.reserve(static_cast<size_t>(steps + 1));
    for (int i = 0; i <= steps; ++i) {
        const double t = static_cast<double>(i) / static_cast<double>(steps);
        const double inv = 1.0 - t;
        pts.push_back({
            inv * inv * p0.x + 2.0 * inv * t * ctrl.x + t * t * p2.x,
            inv * inv * p0.y + 2.0 * inv * t * ctrl.y + t * t * p2.y
        });
    }
    return pts;
}
} // namespace

void executeOperation(CanvasBuffer& buffer, const DrawOperation& op) {
    const Point2D center = {
        static_cast<double>(buffer.width()) / 2.0,
        static_cast<double>(buffer.height()) / 2.0
    };
    const ClipBounds bounds = {
        0.0,
        0.0,
        static_cast<double>(buffer.width() - 1),
        static_cast<double>(buffer.height() - 1)
    };

    if (op.kind == ToolKind::Line) {
        auto segments = generateSymmetricSegments(op.p0, op.p1, center, op.symmetry);
        for (auto& seg : segments) {
            if (cohenSutherlandClip(seg.first, seg.second, bounds)) {
                drawBresenhamLine(
                    buffer,
                    static_cast<int>(std::lround(seg.first.x)),
                    static_cast<int>(std::lround(seg.first.y)),
                    static_cast<int>(std::lround(seg.second.x)),
                    static_cast<int>(std::lround(seg.second.y)),
                    op.color,
                    op.thickness
                );
            }
        }
    } else if (op.kind == ToolKind::Freehand) {
        for (size_t i = 1; i < op.points.size(); ++i) {
            auto segments = generateSymmetricSegments(
                op.points[i - 1], op.points[i], center, op.symmetry
            );
            for (auto& seg : segments) {
                if (cohenSutherlandClip(seg.first, seg.second, bounds)) {
                    drawBresenhamLine(
                        buffer,
                        static_cast<int>(std::lround(seg.first.x)),
                        static_cast<int>(std::lround(seg.first.y)),
                        static_cast<int>(std::lround(seg.second.x)),
                        static_cast<int>(std::lround(seg.second.y)),
                        op.color,
                        op.thickness
                    );
                }
            }
        }
    } else if (op.kind == ToolKind::Circle) {
        auto centers = generateSymmetricPoints(op.p0, center, op.symmetry);
        for (const auto& c : centers) {
            drawBresenhamCircle(
                buffer,
                static_cast<int>(std::lround(c.x)),
                static_cast<int>(std::lround(c.y)),
                static_cast<int>(std::lround(op.radius)),
                op.color,
                op.thickness
            );
        }
    } else if (op.kind == ToolKind::SeedFill) {
        if (op.symmetricFill) {
            auto seeds = generateSymmetricPoints(op.p0, center, op.symmetry);
            for (const auto& s : seeds) {
                iterativeSeedFill(
                    buffer,
                    static_cast<int>(std::lround(s.x)),
                    static_cast<int>(std::lround(s.y)),
                    op.color
                );
            }
        } else {
            iterativeSeedFill(
                buffer,
                static_cast<int>(std::lround(op.p0.x)),
                static_cast<int>(std::lround(op.p0.y)),
                op.color
            );
        }
    }
}

std::vector<DrawOperation> buildPadmaLotusMotif(int canvasSize) {
    const double c = canvasSize / 2.0;
    const double s = canvasSize / 720.0;
    const Color ivory   = {250, 248, 242, 255};
    const Color crimson = {185, 28, 28, 255};
    const Color gold    = {245, 158, 11, 255};
    const SymmetryConfig sym8 = {8, true};
    const SymmetryConfig sym1 = {1, false};

    std::vector<DrawOperation> ops;

    DrawOperation coreCircle;
    coreCircle.kind = ToolKind::Circle;
    coreCircle.p0 = {c, c};
    coreCircle.radius = 44.0 * s;
    coreCircle.color = ivory;
    coreCircle.thickness = 3;
    coreCircle.symmetry = sym1;
    ops.push_back(coreCircle);

    DrawOperation coreFill;
    coreFill.kind = ToolKind::SeedFill;
    coreFill.p0 = {c, c};
    coreFill.color = crimson;
    coreFill.symmetricFill = false;
    coreFill.symmetry = sym1;
    ops.push_back(coreFill);

    DrawOperation innerPetal;
    innerPetal.kind = ToolKind::Freehand;
    innerPetal.points = sampleQuadratic(
        polarPoint(c, c, 44 * s, 22.5),
        polarPoint(c, c, 108 * s, 18.0),
        polarPoint(c, c, 152 * s, 0.0),
        14
    );
    innerPetal.color = ivory;
    innerPetal.thickness = 3;
    innerPetal.symmetry = sym8;
    ops.push_back(innerPetal);

    DrawOperation innerFill;
    innerFill.kind = ToolKind::SeedFill;
    innerFill.p0 = polarPoint(c, c, 92 * s, 3.0);
    innerFill.color = crimson;
    innerFill.symmetricFill = true;
    innerFill.symmetry = sym8;
    ops.push_back(innerFill);

    DrawOperation outerPetal;
    outerPetal.kind = ToolKind::Freehand;
    outerPetal.points = sampleQuadratic(
        polarPoint(c, c, 148 * s, 22.5),
        polarPoint(c, c, 232 * s, 19.0),
        polarPoint(c, c, 286 * s, 0.0),
        18
    );
    outerPetal.color = ivory;
    outerPetal.thickness = 3;
    outerPetal.symmetry = sym8;
    ops.push_back(outerPetal);

    DrawOperation dotRing;
    dotRing.kind = ToolKind::Circle;
    dotRing.p0 = polarPoint(c, c, 224 * s, 22.5);
    dotRing.radius = 9.0 * s;
    dotRing.color = gold;
    dotRing.thickness = 2;
    dotRing.symmetry = sym8;
    ops.push_back(dotRing);

    return ops;
}

std::vector<DrawOperation> buildBoishakhiSunMotif(int canvasSize) {
    const double c = canvasSize / 2.0;
    const double s = canvasSize / 720.0;
    const Color ivory = {250, 248, 242, 255};
    const Color gold  = {245, 158, 11, 255};
    const SymmetryConfig sym12 = {12, true};
    const SymmetryConfig sym1  = {1, false};

    std::vector<DrawOperation> ops;

    DrawOperation innerRing;
    innerRing.kind = ToolKind::Circle;
    innerRing.p0 = {c, c};
    innerRing.radius = 64.0 * s;
    innerRing.color = ivory;
    innerRing.thickness = 3;
    innerRing.symmetry = sym1;
    ops.push_back(innerRing);

    DrawOperation midRing;
    midRing.kind = ToolKind::Circle;
    midRing.p0 = {c, c};
    midRing.radius = 126.0 * s;
    midRing.color = ivory;
    midRing.thickness = 3;
    midRing.symmetry = sym1;
    ops.push_back(midRing);

    DrawOperation ray;
    ray.kind = ToolKind::Freehand;
    ray.points = sampleQuadratic(
        polarPoint(c, c, 128 * s, 15.0),
        polarPoint(c, c, 215 * s, 10.0),
        polarPoint(c, c, 296 * s, 0.0),
        14
    );
    ray.color = ivory;
    ray.thickness = 3;
    ray.symmetry = sym12;
    ops.push_back(ray);

    DrawOperation rayFill;
    rayFill.kind = ToolKind::SeedFill;
    rayFill.p0 = polarPoint(c, c, 185 * s, 2.0);
    rayFill.color = gold;
    rayFill.symmetricFill = true;
    rayFill.symmetry = sym12;
    ops.push_back(rayFill);

    return ops;
}

std::vector<DrawOperation> buildKalkaRosetteMotif(int canvasSize) {
    const double c = canvasSize / 2.0;
    const double s = canvasSize / 720.0;
    const Color ivory = {250, 248, 242, 255};
    const Color gold  = {245, 158, 11, 255};
    const SymmetryConfig sym6 = {6, false};

    std::vector<DrawOperation> ops;
    DrawOperation outerSweep;
    outerSweep.kind = ToolKind::Freehand;
    outerSweep.points = sampleQuadratic(
        polarPoint(c, c, 54 * s, 0.0),
        polarPoint(c, c, 210 * s, 68.0),
        polarPoint(c, c, 285 * s, 18.0),
        20
    );
    outerSweep.color = ivory;
    outerSweep.thickness = 3;
    outerSweep.symmetry = sym6;
    ops.push_back(outerSweep);

    DrawOperation pearl;
    pearl.kind = ToolKind::Circle;
    pearl.p0 = polarPoint(c, c, 250 * s, 46.0);
    pearl.radius = 16.0 * s;
    pearl.color = gold;
    pearl.thickness = 2;
    pearl.symmetry = sym6;
    ops.push_back(pearl);

    return ops;
}

std::vector<DrawOperation> buildCourtyardChowkMotif(int canvasSize) {
    const double c = canvasSize / 2.0;
    const double s = canvasSize / 720.0;
    const Color crimson = {185, 28, 28, 255};
    const SymmetryConfig sym4 = {4, true};

    std::vector<DrawOperation> ops;
    DrawOperation sq;
    sq.kind = ToolKind::Line;
    sq.p0 = {c + 280 * s, c};
    sq.p1 = {c + 280 * s, c + 280 * s};
    sq.color = crimson;
    sq.thickness = 3;
    sq.symmetry = sym4;
    ops.push_back(sq);

    DrawOperation diamond;
    diamond.kind = ToolKind::Line;
    diamond.p0 = {c + 240 * s, c};
    diamond.p1 = {c, c + 240 * s};
    diamond.color = crimson;
    diamond.thickness = 3;
    diamond.symmetry = sym4;
    ops.push_back(diamond);

    return ops;
}

namespace {
std::string colorHex(Color c) {
    std::ostringstream oss;
    oss << "#" << std::hex << std::uppercase << std::setfill('0')
        << std::setw(2) << static_cast<int>(c.r)
        << std::setw(2) << static_cast<int>(c.g)
        << std::setw(2) << static_cast<int>(c.b);
    return oss.str();
}
} // namespace

std::string buildOperationsSvg(const std::vector<DrawOperation>& ops, int canvasSize, Color bgColor) {
    SvgWriter svg(canvasSize, canvasSize, colorHex(bgColor));
    const Point2D center = {canvasSize * 0.5, canvasSize * 0.5};
    // Seed fills are raster flood fills: replay the scene in order and turn the pixels
    // each fill paints into a vector path, so the SVG matches the PNG exactly.
    CanvasBuffer raster(canvasSize, canvasSize);
    raster.clear(bgColor);

    for (size_t i = 0; i < ops.size(); ++i) {
        const DrawOperation& op = ops[i];
        const std::string hex = colorHex(op.color);
        if (op.kind == ToolKind::SeedFill) {
            CanvasBuffer before = raster;
            executeOperation(raster, op);
            std::vector<uint8_t> mask(static_cast<size_t>(canvasSize) * canvasSize, 0);
            bool painted = false;
            for (int y = 0; y < canvasSize; ++y) {
                for (int x = 0; x < canvasSize; ++x) {
                    if (before.getPixel(x, y) != raster.getPixel(x, y)) {
                        mask[static_cast<size_t>(y) * canvasSize + x] = 1;
                        painted = true;
                    }
                }
            }
            if (painted) svg.addFillPath(fillMaskToSvgPath(mask, canvasSize, canvasSize), hex);
            continue;
        }
        executeOperation(raster, op);
        if (op.kind == ToolKind::Line) {
            auto segs = generateSymmetricSegments(op.p0, op.p1, center, op.symmetry);
            for (size_t s = 0; s < segs.size(); ++s) {
                svg.addLine(segs[s].first, segs[s].second, hex, static_cast<double>(op.thickness));
            }
        } else if (op.kind == ToolKind::Circle) {
            auto centers = generateSymmetricPoints(op.p0, center, op.symmetry);
            for (size_t c = 0; c < centers.size(); ++c) {
                svg.addCircle(centers[c], op.radius, hex, static_cast<double>(op.thickness));
            }
        } else if (op.kind == ToolKind::Freehand && op.points.size() >= 2) {
            for (size_t k = 1; k < op.points.size(); ++k) {
                auto segs = generateSymmetricSegments(op.points[k - 1], op.points[k], center, op.symmetry);
                for (size_t s = 0; s < segs.size(); ++s) {
                    svg.addLine(segs[s].first, segs[s].second, hex, static_cast<double>(op.thickness));
                }
            }
        }
    }
    return svg.str();
}

} // namespace alpona
