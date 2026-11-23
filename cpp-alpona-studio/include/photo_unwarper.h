#ifndef ALPONA_PHOTO_UNWARPER_H
#define ALPONA_PHOTO_UNWARPER_H

#include "canvas_buffer.h"
#include "homography.h"
#include <vector>

namespace alpona {

struct SymmetryScore {
    int sectors;
    double correlation;
};

struct SymmetryReport {
    int detectedSectors;
    int confidencePercent;
    std::vector<SymmetryScore> scores;
};

/**
 * Inverse-perspective rectification: maps [0,1]^2 through 3x3 Homography H
 * into an angled street/floor Alpona photo using bilinear interpolation.
 */
CanvasBuffer rectifyPhotoQuad(
    const CanvasBuffer& photo,
    const HomographyQuad& quad,
    int outSize = 360
);

/**
 * Polar Angular Autocorrelation Symmetry Detector:
 * Correlates concentric polar luminance profiles across n in {4, 6, 8, 12}.
 */
SymmetryReport detectRotationalSymmetryOrder(const CanvasBuffer& flatSurface);

/**
 * Repairs damaged/scuffed street Alpona photos by blending top-percentile
 * rotational/dihedral symmetry copies around the center.
 */
CanvasBuffer restoreRotationalSymmetry(
    const CanvasBuffer& flatSurface,
    int sectors,
    bool reflect = true
);

} // namespace alpona

#endif // ALPONA_PHOTO_UNWARPER_H
