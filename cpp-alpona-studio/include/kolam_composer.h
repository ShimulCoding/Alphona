#ifndef ALPONA_KOLAM_COMPOSER_H
#define ALPONA_KOLAM_COMPOSER_H

// Kolam / Pulli Dot-Grid Composer — Mirror-Curve Algorithm (C++11 twin of
// src/graphics/kolamComposer.ts). rows x cols dots sit at cell centres; the curve runs
// diagonally between cell-edge midpoints, reflects on mirrors (the outer border and
// optional inner edges) and passes straight through elsewhere. Every cell holds four
// diagonal segments, so a grid always has 4 * rows * cols segments split over closed loops.

#include "canvas_buffer.h"
#include "motifs.h"

#include <cstdint>
#include <vector>

namespace alpona {

enum class KolamSymmetry {
    None,        // independent random mirrors
    Mirror,      // left-right + top-bottom reflection
    Rotational   // 90 degree rotation for square grids, 180 degree otherwise
};

struct KolamMirrorGrid {
    int rows;
    int cols;
    std::vector<bool> vertical;    // index y * (cols + 1) + x, x in 0..cols, y in 0..rows-1
    std::vector<bool> horizontal;  // index y * cols + x,       x in 0..cols-1, y in 0..rows
    int innerMirrorCount;
};

struct KolamTraceResult {
    // Closed loops on the doubled integer lattice (x2); first point repeated at the end.
    std::vector<std::vector<Point2D>> loops;
    int segmentCount;
};

struct KolamConfig {
    int rows;
    int cols;
    double mirrorDensity;
    uint32_t seed;
    KolamSymmetry symmetry;
    bool requireSingleLoop;
    int smoothingIterations;

    KolamConfig()
        : rows(5), cols(5), mirrorDensity(0.35), seed(7),
          symmetry(KolamSymmetry::Mirror), requireSingleLoop(true), smoothingIterations(2) {}
};

struct KolamComposeResult {
    std::vector<std::vector<Point2D>> canvasLoops;  // smoothed, in canvas pixels
    std::vector<Point2D> dotCenters;                // pulli dot centres in canvas pixels
    int dotRadius;                                  // circle radius; drawn with brush 2r+1
    int loopCount;
    int segmentCount;
    int innerMirrorCount;
    uint32_t seedUsed;
    int attempts;
    bool isSingleLoop;
    int rows;
    int cols;
};

const int kKolamMinDots = 2;
const int kKolamMaxDots = 12;
const int kKolamMaxSearchAttempts = 240;

int clampKolamDots(int n);
int gcdInt(int a, int b);

KolamMirrorGrid buildKolamMirrorGrid(
    int rows, int cols, double mirrorDensity, uint32_t seed, KolamSymmetry symmetry);

KolamTraceResult traceKolamLoops(const KolamMirrorGrid& grid);

std::vector<Point2D> chaikinClosed(const std::vector<Point2D>& points, int iterations);

int kolamCellSize(int canvasSize, int rows, int cols);

KolamComposeResult composeKolam(int canvasSize, const KolamConfig& config);

// Converts a composed kolam into drawable operations (loops as freehand strokes, dots as
// filled circles) so the CLI can rasterize it and write PNG / SVG like any other motif.
std::vector<DrawOperation> buildKolamDrawOperations(
    const KolamComposeResult& result, Color loopColor, Color dotColor, int thickness);

} // namespace alpona

#endif // ALPONA_KOLAM_COMPOSER_H
