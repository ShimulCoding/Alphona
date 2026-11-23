#ifndef ALPONA_HOMOGRAPHY_H
#define ALPONA_HOMOGRAPHY_H

#include <vector>
#include "canvas_buffer.h"

namespace alpona {

struct HomographyQuad {
    Point2D tl;
    Point2D tr;
    Point2D br;
    Point2D bl;
};

struct HomographyResult {
    double h[9];   // 3x3 row-major unit square -> destination quad
    double inv[9]; // 3x3 row-major destination pixel -> unit square (u, v)
    bool valid;

    HomographyResult() : valid(false) {
        for (int i = 0; i < 9; ++i) {
            h[i] = (i % 4 == 0) ? 1.0 : 0.0;
            inv[i] = (i % 4 == 0) ? 1.0 : 0.0;
        }
    }
};

struct ChalkRingSpec {
    int ringIndex;
    double radiusCm;
    double sectorChordCm;
};

// Solves the exact 3x3 Projective Homography H mapping unit square -> floor quad via 8x8 elimination.
HomographyResult solveHomographyFromUnitSquare(const HomographyQuad& quad);

// Applies 3x3 projective homography to (x, y).
Point2D applyHomography(const double h[9], double x, double y);

// Inverse-perspective warps alponaTexture onto floorPhoto inside quad using bilinear sampling.
int renderVirtualFloorTryOn(
    const CanvasBuffer& floorPhoto,
    const CanvasBuffer& alponaTexture,
    const HomographyQuad& quad,
    CanvasBuffer& outComposite,
    double opacity = 0.92
);

// Computes real-world chalk-string compass radii and sector chord lengths c = 2R sin(pi/n).
std::vector<ChalkRingSpec> computeChalkBlueprintRings(double diameterCm, int sectors);

} // namespace alpona

#endif // ALPONA_HOMOGRAPHY_H
