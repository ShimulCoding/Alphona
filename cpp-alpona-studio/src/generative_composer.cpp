#include "generative_composer.h"
#include "rasterizer.h"
#include "transforms.h"

#include <algorithm>
#include <cmath>

namespace alpona {

namespace {
const double kPi = 3.14159265358979323846;
}

double nextDeterministicRand(uint32_t& state) {
    state = state * 1664525u + 1013904223u;
    return static_cast<double>(state) / 4294967296.0;
}

std::string expandLSystem(
    const std::string& axiom,
    const std::map<char, std::string>& rules,
    int iterations) {
    std::string cur = axiom;
    const int safeIter = std::max(0, std::min(4, iterations));
    for (int i = 0; i < safeIter; ++i) {
        std::string next;
        next.reserve(cur.size() * 4);
        for (size_t c = 0; c < cur.size(); ++c) {
            const char ch = cur[c];
            std::map<char, std::string>::const_iterator it = rules.find(ch);
            if (it != rules.end()) {
                next += it->second;
            } else {
                next.push_back(ch);
            }
        }
        cur = std::move(next);
        if (cur.size() > 600) break;
    }
    return cur;
}

std::vector<ProceduralCircleOp> generatePhyllotaxisCore(
    int canvasSize,
    int dotCount,
    double maxRadiusFrac,
    Color color,
    int thickness) {
    const double cx = canvasSize * 0.5;
    const double cy = canvasSize * 0.5;
    const double maxR = canvasSize * maxRadiusFrac;
    const double goldenAngle = kPi * (3.0 - std::sqrt(5.0));
    const int count = std::max(8, std::min(42, dotCount));
    std::vector<ProceduralCircleOp> ops;
    ops.reserve(static_cast<size_t>(count));

    for (int i = 1; i <= count; ++i) {
        const double frac = static_cast<double>(i) / count;
        const double r = maxR * std::sqrt(frac);
        const double theta = i * goldenAngle;
        ProceduralCircleOp op;
        op.center = {cx + std::cos(theta) * r, cy + std::sin(theta) * r};
        op.radius = std::max(2, static_cast<int>(std::floor(2.4 + frac * 2.2 + 0.5)));
        op.color = color;
        op.thickness = std::max(1, std::min(3, thickness));
        ops.push_back(op);
    }
    return ops;
}

ProceduralPolylineOp generateRhodoneaLotusRing(
    int canvasSize,
    int sectors,
    double innerFrac,
    double outerFrac,
    int petalHarmonic,
    Color color,
    int thickness) {
    const double cx = canvasSize * 0.5;
    const double cy = canvasSize * 0.5;
    const double rIn = canvasSize * innerFrac;
    const double rOut = canvasSize * outerFrac;
    const double rMid = (rIn + rOut) * 0.5;
    const double amp = (rOut - rIn) * 0.5;
    const int safeSectors = std::max(4, std::min(16, sectors));
    const double sectorSpan = (2.0 * kPi) / safeSectors;
    const int steps = 28;

    ProceduralPolylineOp poly;
    poly.color = color;
    poly.thickness = thickness;
    poly.symmetry = SymmetryConfig(safeSectors, true);
    poly.points.reserve(static_cast<size_t>(steps + 1));

    for (int i = 0; i <= steps; ++i) {
        const double u = static_cast<double>(i) / steps;
        const double theta = -kPi * 0.5 + u * (sectorSpan * 0.5);
        const double r = rMid + amp * std::cos(petalHarmonic * safeSectors * u * kPi);
        poly.points.push_back({cx + std::cos(theta) * r, cy + std::sin(theta) * r});
    }
    return poly;
}

std::vector<ProceduralLineOp> generateLSystemVineBorder(
    int canvasSize,
    int sectors,
    double ringFrac,
    int iterations,
    double branchAngleDeg,
    Color color,
    int thickness,
    size_t* outExpandedLength) {
    const double cx = canvasSize * 0.5;
    const double cy = canvasSize * 0.5;
    const double baseR = canvasSize * ringFrac;
    const int safeSectors = std::max(4, std::min(16, sectors));

    std::map<char, std::string> rules;
    rules['F'] = "F[+F][-F]F";
    const std::string expanded = expandLSystem("F", rules, iterations);
    if (outExpandedLength != nullptr) {
        *outExpandedLength = expanded.size();
    }

    double x = cx;
    double y = cy - baseR;
    double heading = -kPi * 0.5 + 0.14;
    const double stepLen = std::max(
        6.0,
        (canvasSize * 0.048) / std::pow(1.42, std::max(0, iterations - 1)));
    const double angleRad = (branchAngleDeg * kPi) / 180.0;

    struct TurtleState {
        double x;
        double y;
        double heading;
    };
    std::vector<TurtleState> stack;
    std::vector<ProceduralLineOp> ops;
    int segIdx = 0;

    for (size_t i = 0; i < expanded.size() && segIdx < 24; ++i) {
        const char ch = expanded[i];
        if (ch == 'F') {
            const double nx = x + std::cos(heading) * stepLen;
            const double ny = y + std::sin(heading) * stepLen;
            const double dx = nx - cx;
            const double dy = ny - cy;
            if (std::sqrt(dx * dx + dy * dy) < canvasSize * 0.46) {
                ProceduralLineOp seg;
                seg.p0 = {x, y};
                seg.p1 = {nx, ny};
                seg.color = color;
                seg.thickness = std::max(1, thickness - (stack.empty() ? 0 : 1));
                seg.symmetry = SymmetryConfig(safeSectors, true);
                ops.push_back(seg);
                segIdx++;
                x = nx;
                y = ny;
            }
        } else if (ch == '+') {
            heading += angleRad;
        } else if (ch == '-') {
            heading -= angleRad;
        } else if (ch == '[') {
            stack.push_back({x, y, heading});
        } else if (ch == ']' && !stack.empty()) {
            const TurtleState top = stack.back();
            stack.pop_back();
            x = top.x;
            y = top.y;
            heading = top.heading;
        }
    }

    return ops;
}

ProceduralComposeResult composeProceduralAlpona(
    int canvasSize,
    const ProceduralAlponaConfig& config) {
    uint32_t rng = (config.seed == 0u) ? 1337u : config.seed;
    const int safeSectors = std::max(4, std::min(16, config.sectors));
    const double cx = canvasSize * 0.5;
    const double cy = canvasSize * 0.5;

    ProceduralComposeResult res;
    res.symmetry = SymmetryConfig(safeSectors, true);
    res.lSystemAxiomLength = 0;
    res.phyllotaxisDots = 0;

    const int innerRingR = static_cast<int>(std::floor(canvasSize * (0.15 + nextDeterministicRand(rng) * 0.03) + 0.5));
    const int midRingR = static_cast<int>(std::floor(canvasSize * (0.31 + nextDeterministicRand(rng) * 0.03) + 0.5));
    const int outerRingR = static_cast<int>(std::floor(canvasSize * 0.44 + 0.5));

    res.circles.push_back({{cx, cy}, innerRingR, config.primaryColor, config.thickness});
    res.circles.push_back({{cx, cy}, midRingR, config.accentColor, std::max(2, config.thickness - 1)});
    res.circles.push_back({{cx, cy}, outerRingR, config.primaryColor, config.thickness});

    if (config.includePhyllotaxis) {
        const int count = 16 + static_cast<int>(std::floor(nextDeterministicRand(rng) * 14.0));
        std::vector<ProceduralCircleOp> dots = generatePhyllotaxisCore(
            canvasSize, count, 0.13, config.accentColor, config.thickness);
        res.phyllotaxisDots = static_cast<int>(dots.size());
        res.circles.insert(res.circles.end(), dots.begin(), dots.end());
    }

    if (config.includeRhodonea) {
        const int harmonic = (nextDeterministicRand(rng) > 0.5) ? 2 : 1;
        res.polylines.push_back(generateRhodoneaLotusRing(
            canvasSize, safeSectors, 0.17, 0.31, harmonic, config.primaryColor, config.thickness));
        res.polylines.push_back(generateRhodoneaLotusRing(
            canvasSize, safeSectors, 0.31, 0.42, 1, config.accentColor, std::max(2, config.thickness - 1)));
    }

    if (config.includeLSystemVine) {
        const double angle = 24.0 + std::floor(nextDeterministicRand(rng) * 16.0 + 0.5);
        size_t expandedLen = 0;
        std::vector<ProceduralLineOp> vine = generateLSystemVineBorder(
            canvasSize, safeSectors, 0.32, 2, angle, config.primaryColor, config.thickness, &expandedLen);
        res.lSystemAxiomLength = expandedLen;
        res.lines.insert(res.lines.end(), vine.begin(), vine.end());
    }

    return res;
}

void rasterizeProceduralAlpona(
    CanvasBuffer& surface,
    const ProceduralComposeResult& result) {
    const Point2D center = {surface.width() * 0.5, surface.height() * 0.5};

    for (size_t i = 0; i < result.circles.size(); ++i) {
        const ProceduralCircleOp& c = result.circles[i];
        drawBresenhamCircle(
            surface,
            static_cast<int>(std::floor(c.center.x + 0.5)),
            static_cast<int>(std::floor(c.center.y + 0.5)),
            c.radius,
            c.color,
            c.thickness);
    }

    for (size_t i = 0; i < result.polylines.size(); ++i) {
        const ProceduralPolylineOp& p = result.polylines[i];
        for (size_t k = 1; k < p.points.size(); ++k) {
            const std::vector<std::pair<Point2D, Point2D>> segs =
                generateSymmetricSegments(p.points[k - 1], p.points[k], center, p.symmetry);
            for (size_t s = 0; s < segs.size(); ++s) {
                drawBresenhamLine(
                    surface,
                    static_cast<int>(std::floor(segs[s].first.x + 0.5)),
                    static_cast<int>(std::floor(segs[s].first.y + 0.5)),
                    static_cast<int>(std::floor(segs[s].second.x + 0.5)),
                    static_cast<int>(std::floor(segs[s].second.y + 0.5)),
                    p.color,
                    p.thickness);
            }
        }
    }

    for (size_t i = 0; i < result.lines.size(); ++i) {
        const ProceduralLineOp& l = result.lines[i];
        const std::vector<std::pair<Point2D, Point2D>> segs =
            generateSymmetricSegments(l.p0, l.p1, center, l.symmetry);
        for (size_t s = 0; s < segs.size(); ++s) {
            drawBresenhamLine(
                surface,
                static_cast<int>(std::floor(segs[s].first.x + 0.5)),
                static_cast<int>(std::floor(segs[s].first.y + 0.5)),
                static_cast<int>(std::floor(segs[s].second.x + 0.5)),
                static_cast<int>(std::floor(segs[s].second.y + 0.5)),
                l.color,
                l.thickness);
        }
    }
}

} // namespace alpona
