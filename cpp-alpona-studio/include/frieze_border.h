#ifndef ALPONA_FRIEZE_BORDER_H
#define ALPONA_FRIEZE_BORDER_H

#include "canvas_buffer.h"

namespace alpona {

enum class FriezeGroup {
    P1,    // Pure horizontal translation
    P11G,  // Glide reflection
    P11M,  // Horizontal mirror
    P1M1,  // Vertical mirror
    P2,    // 180-degree half-turn
    P2MG,  // Vertical mirror + alternating glide
    P2MM   // Full dihedral border symmetry
};

struct FriezeBorderResult {
    CanvasBuffer tile;
    CanvasBuffer strip;
    CanvasBuffer corner90;
    FriezeGroup group;
    int repeatCount;

    FriezeBorderResult(int tw, int th, int sw, int sh, int cw, FriezeGroup g, int reps)
        : tile(tw, th), strip(sw, sh), corner90(cw, cw), group(g), repeatCount(reps) {}
};

// Polar-to-Cartesian Alpona ring unwrapper into a seamless rectangular tile
CanvasBuffer unwrapAlponaRingToTile(
    const CanvasBuffer& alpona,
    int tileW,
    int tileH,
    double innerRadiusFrac,
    double outerRadiusFrac,
    int sectors
);

// Maps normalized tile coordinates (u, v) in [0,1]^2 through one of the 7 1D Frieze groups
void mapFriezeCoordinates(
    FriezeGroup group,
    int repeatIndex,
    double u,
    double v,
    double& outU,
    double& outV
);

// Renders a seamless repeating Saree Paar / Street Alpona Runner strip
CanvasBuffer renderFriezeStrip(
    const CanvasBuffer& tile,
    FriezeGroup group,
    int repeatCount,
    bool trimLines,
    Color trimColor
);

// Renders a mitered 90-degree L-Corner (Saree Anchal / Doorframe) folded across x == y
CanvasBuffer renderMiteredCorner90(
    const CanvasBuffer& strip,
    int outSize,
    Color fabricColor
);

}  // namespace alpona

#endif  // ALPONA_FRIEZE_BORDER_H
