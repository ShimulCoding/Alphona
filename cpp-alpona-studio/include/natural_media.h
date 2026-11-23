#ifndef ALPONA_NATURAL_MEDIA_H
#define ALPONA_NATURAL_MEDIA_H

#include "canvas_buffer.h"

namespace alpona {

enum class NaturalSubstrateId {
    MatiMud,
    EkusheyAsphalt,
    TantCotton,
    PatachitraPaper
};

struct NaturalMediaOptions {
    NaturalSubstrateId substrate;
    double brushGrain;
    double pasteImpasto;
    double speckleIntensity;
    double warmth;

    NaturalMediaOptions()
        : substrate(NaturalSubstrateId::MatiMud),
          brushGrain(0.58),
          pasteImpasto(0.65),
          speckleIntensity(0.45),
          warmth(0.50) {}
};

double hash2D(int ix, int iy);
double fbm2D(double x, double y);

CanvasBuffer renderNaturalMediaAlpona(
    const CanvasBuffer& studioSurface,
    Color bgColor,
    const NaturalMediaOptions& options);

} // namespace alpona

#endif // ALPONA_NATURAL_MEDIA_H
