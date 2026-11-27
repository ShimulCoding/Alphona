#include "kolam_composer.h"
#include "generative_composer.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>

namespace alpona {

namespace {

struct EdgeRef {
    bool vertical;
    int x;
    int y;
};

int edgeId(int rows, int cols, bool vertical, int x, int y) {
    return vertical ? y * (cols + 1) + x : rows * (cols + 1) + y * cols + x;
}

std::vector<EdgeRef> symmetryImages(
    int rows, int cols, KolamSymmetry symmetry, const EdgeRef& e) {
    std::vector<EdgeRef> out;
    if (symmetry == KolamSymmetry::Mirror) {
        if (e.vertical) {
            out.push_back({true, cols - e.x, e.y});
            out.push_back({true, e.x, rows - 1 - e.y});
        } else {
            out.push_back({false, cols - 1 - e.x, e.y});
            out.push_back({false, e.x, rows - e.y});
        }
    } else if (symmetry == KolamSymmetry::Rotational) {
        if (rows == cols) {
            const int n = rows;  // 90 degrees: (x, y) -> (n - y, x)
            if (e.vertical) out.push_back({false, n - 1 - e.y, e.x});
            else out.push_back({true, n - e.y, e.x});
        } else {             // 180 degrees: (x, y) -> (cols - x, rows - y)
            if (e.vertical) out.push_back({true, cols - e.x, rows - 1 - e.y});
            else out.push_back({false, cols - 1 - e.x, rows - e.y});
        }
    }
    return out;
}

int segmentIndex(int cols, int px, int py, int dx, int dy) {
    // Segment midpoint on the quadrupled lattice: K = 2P + d (always 1 or 3 mod 4, >= 1)
    const int kx = 2 * px + dx;
    const int ky = 2 * py + dy;
    const int cx = kx / 4;
    const int cy = ky / 4;
    const int qx = (kx - 4 * cx == 3) ? 1 : 0;
    const int qy = (ky - 4 * cy == 3) ? 1 : 0;
    return ((cy * cols + cx) * 2 + qy) * 2 + qx;
}

} // namespace

int clampKolamDots(int n) {
    return std::max(kKolamMinDots, std::min(kKolamMaxDots, n));
}

int gcdInt(int a, int b) {
    a = std::abs(a);
    b = std::abs(b);
    while (b != 0) {
        const int t = a % b;
        a = b;
        b = t;
    }
    return a;
}

KolamMirrorGrid buildKolamMirrorGrid(
    int rows, int cols, double mirrorDensity, uint32_t seed, KolamSymmetry symmetry) {
    KolamMirrorGrid grid;
    const int r = clampKolamDots(rows);
    const int c = clampKolamDots(cols);
    const double density = std::max(0.0, std::min(1.0, mirrorDensity));
    grid.rows = r;
    grid.cols = c;
    grid.vertical.assign(static_cast<size_t>((c + 1) * r), false);
    grid.horizontal.assign(static_cast<size_t>(c * (r + 1)), false);
    std::vector<bool> decided(static_cast<size_t>((c + 1) * r + c * (r + 1)), false);
    uint32_t rng = seed ? seed : 1u;

    auto decideOrbit = [&](bool isVertical, int x0, int y0) {
        if (decided[edgeId(r, c, isVertical, x0, y0)]) return;
        const bool value = nextDeterministicRand(rng) < density;
        std::vector<EdgeRef> stack(1, EdgeRef{isVertical, x0, y0});
        while (!stack.empty()) {
            const EdgeRef e = stack.back();
            stack.pop_back();
            const int id = edgeId(r, c, e.vertical, e.x, e.y);
            if (decided[id]) continue;
            if (e.vertical) grid.vertical[e.y * (c + 1) + e.x] = value;
            else grid.horizontal[e.y * c + e.x] = value;
            decided[id] = true;
            const std::vector<EdgeRef> imgs = symmetryImages(r, c, symmetry, e);
            for (size_t i = 0; i < imgs.size(); ++i) {
                if (!decided[edgeId(r, c, imgs[i].vertical, imgs[i].x, imgs[i].y)]) {
                    stack.push_back(imgs[i]);
                }
            }
        }
    };

    for (int y = 0; y < r; ++y) for (int x = 1; x < c; ++x) decideOrbit(true, x, y);
    for (int y = 1; y < r; ++y) for (int x = 0; x < c; ++x) decideOrbit(false, x, y);

    grid.innerMirrorCount = 0;
    for (int y = 0; y < r; ++y) for (int x = 1; x < c; ++x)
        if (grid.vertical[y * (c + 1) + x]) ++grid.innerMirrorCount;
    for (int y = 1; y < r; ++y) for (int x = 0; x < c; ++x)
        if (grid.horizontal[y * c + x]) ++grid.innerMirrorCount;

    // The outer border always reflects.
    for (int y = 0; y < r; ++y) {
        grid.vertical[y * (c + 1)] = true;
        grid.vertical[y * (c + 1) + c] = true;
    }
    for (int x = 0; x < c; ++x) {
        grid.horizontal[x] = true;
        grid.horizontal[r * c + x] = true;
    }
    return grid;
}

KolamTraceResult traceKolamLoops(const KolamMirrorGrid& grid) {
    const int rows = grid.rows;
    const int cols = grid.cols;
    const int total = 4 * rows * cols;
    std::vector<bool> used(static_cast<size_t>(total), false);
    KolamTraceResult result;
    result.segmentCount = total;

    for (int s = 0; s < total; ++s) {
        if (used[s]) continue;
        const int qx = s & 1;
        const int qy = (s >> 1) & 1;
        const int cell = s >> 2;
        const int cx = cell % cols;
        const int cy = cell / cols;
        const int startX = 2 * (cx + qx);
        const int startY = 2 * cy + 1;
        const int startDx = 1 - 2 * qx;
        const int startDy = 2 * qy - 1;

        int px = startX, py = startY, dx = startDx, dy = startDy;
        std::vector<Point2D> loop;
        loop.push_back({static_cast<double>(px), static_cast<double>(py)});
        for (int guard = 0; guard <= total; ++guard) {
            used[segmentIndex(cols, px, py, dx, dy)] = true;
            px += dx;
            py += dy;
            loop.push_back({static_cast<double>(px), static_cast<double>(py)});
            if (px % 2 == 0) {
                if (grid.vertical[((py - 1) / 2) * (cols + 1) + px / 2]) dx = -dx;
            } else if (grid.horizontal[(py / 2) * cols + (px - 1) / 2]) {
                dy = -dy;
            }
            if (px == startX && py == startY && dx == startDx && dy == startDy) break;
        }
        result.loops.push_back(loop);
    }
    return result;
}

std::vector<Point2D> chaikinClosed(const std::vector<Point2D>& points, int iterations) {
    std::vector<Point2D> pts = points;
    if (pts.size() > 1 && pts.front().x == pts.back().x && pts.front().y == pts.back().y) {
        pts.pop_back();
    }
    const int passes = std::max(0, std::min(3, iterations));
    for (int it = 0; it < passes && pts.size() >= 3; ++it) {
        std::vector<Point2D> next;
        next.reserve(pts.size() * 2);
        for (size_t i = 0; i < pts.size(); ++i) {
            const Point2D& p = pts[i];
            const Point2D& q = pts[(i + 1) % pts.size()];
            next.push_back({0.75 * p.x + 0.25 * q.x, 0.75 * p.y + 0.25 * q.y});
            next.push_back({0.25 * p.x + 0.75 * q.x, 0.25 * p.y + 0.75 * q.y});
        }
        pts.swap(next);
    }
    if (!pts.empty()) pts.push_back(pts.front());
    return pts;
}

int kolamCellSize(int canvasSize, int rows, int cols) {
    return static_cast<int>(std::floor(canvasSize * 0.82 / std::max(rows, cols)));
}

KolamComposeResult composeKolam(int canvasSize, const KolamConfig& config) {
    const int rows = clampKolamDots(config.rows);
    const int cols = clampKolamDots(config.cols);
    const int maxAttempts = config.requireSingleLoop ? kKolamMaxSearchAttempts : 1;

    KolamMirrorGrid bestGrid;
    KolamTraceResult bestTrace;
    bool haveBest = false;
    uint32_t bestSeed = config.seed;
    int attempts = 0;

    for (int a = 0; a < maxAttempts; ++a) {
        const uint32_t seed = config.seed + static_cast<uint32_t>(a);
        KolamMirrorGrid grid =
            buildKolamMirrorGrid(rows, cols, config.mirrorDensity, seed, config.symmetry);
        KolamTraceResult trace = traceKolamLoops(grid);
        attempts = a + 1;
        if (!haveBest || trace.loops.size() < bestTrace.loops.size()) {
            bestGrid = grid;
            bestTrace = trace;
            bestSeed = seed;
            haveBest = true;
        }
        if (bestTrace.loops.size() == 1) break;
    }

    KolamComposeResult result;
    const int cell = kolamCellSize(canvasSize, rows, cols);
    const double ox = (canvasSize - cols * cell) / 2.0;
    const double oy = (canvasSize - rows * cell) / 2.0;

    for (size_t i = 0; i < bestTrace.loops.size(); ++i) {
        std::vector<Point2D> canvasPts;
        canvasPts.reserve(bestTrace.loops[i].size());
        for (size_t k = 0; k < bestTrace.loops[i].size(); ++k) {
            const Point2D& p = bestTrace.loops[i][k];
            canvasPts.push_back({ox + (p.x / 2.0) * cell, oy + (p.y / 2.0) * cell});
        }
        result.canvasLoops.push_back(chaikinClosed(canvasPts, config.smoothingIterations));
    }
    for (int y = 0; y < rows; ++y) {
        for (int x = 0; x < cols; ++x) {
            result.dotCenters.push_back({std::floor(ox + (x + 0.5) * cell + 0.5),
                                         std::floor(oy + (y + 0.5) * cell + 0.5)});
        }
    }
    // A circle of radius r stamped with a disc brush of radius r renders a solid dot of radius ~2r.
    const int dotSize = std::max(2, static_cast<int>(std::floor(cell * 0.06 + 0.5)));
    result.dotRadius = std::max(1, static_cast<int>(std::floor(dotSize / 2.0 + 0.5)));
    result.loopCount = static_cast<int>(bestTrace.loops.size());
    result.segmentCount = bestTrace.segmentCount;
    result.innerMirrorCount = bestGrid.innerMirrorCount;
    result.seedUsed = bestSeed;
    result.attempts = attempts;
    result.isSingleLoop = result.loopCount == 1;
    result.rows = rows;
    result.cols = cols;
    return result;
}

std::vector<DrawOperation> buildKolamDrawOperations(
    const KolamComposeResult& result, Color loopColor, Color dotColor, int thickness) {
    std::vector<DrawOperation> ops;
    const SymmetryConfig noSymmetry(1, false);
    for (size_t i = 0; i < result.canvasLoops.size(); ++i) {
        DrawOperation op;
        op.kind = ToolKind::Freehand;
        op.points = result.canvasLoops[i];
        op.color = loopColor;
        op.thickness = std::max(1, thickness);
        op.symmetry = noSymmetry;
        ops.push_back(op);
    }
    for (size_t i = 0; i < result.dotCenters.size(); ++i) {
        DrawOperation op;
        op.kind = ToolKind::Circle;
        op.p0 = result.dotCenters[i];
        op.radius = result.dotRadius;
        op.color = dotColor;
        op.thickness = 2 * result.dotRadius + 1;
        op.symmetry = noSymmetry;
        ops.push_back(op);
    }
    return ops;
}

} // namespace alpona
