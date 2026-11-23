#ifndef ALPONA_FLOODFILL_H
#define ALPONA_FLOODFILL_H

#include "canvas_buffer.h"

namespace alpona {

/**
 * Iterative scanline seed-fill using an explicit stack (no recursion).
 * Strictly bounds-checked to [0, width) x [0, height).
 * Returns total pixels filled.
 */
int iterativeSeedFill(
    CanvasBuffer& buffer,
    int seedX,
    int seedY,
    Color fillColor
);

} // namespace alpona

#endif // ALPONA_FLOODFILL_H
