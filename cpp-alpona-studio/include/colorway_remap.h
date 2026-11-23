#ifndef ALPONA_COLORWAY_REMAP_H
#define ALPONA_COLORWAY_REMAP_H

#include "canvas_buffer.h"
#include <vector>

namespace alpona {

// Deterministic K-Means RGB clustering (CLO-1/6) extracting top k pigments from a photo
std::vector<Color> extractKMeansPalette(
    const CanvasBuffer& photo,
    int k = 5,
    int maxIterations = 14
);

// Remaps each distinct color in `strokeColors` onto `targetPalette` by frequency hierarchy
std::vector<Color> remapStrokeColorway(
    const std::vector<Color>& strokeColors,
    const std::vector<Color>& targetPalette
);

}  // namespace alpona

#endif  // ALPONA_COLORWAY_REMAP_H
