#ifndef ALPONA_STROKE_CRAFT_H
#define ALPONA_STROKE_CRAFT_H

#include "canvas_buffer.h"
#include <vector>

namespace alpona {

// Moving-average jitter filter + Chaikin corner-cutting subdivision stabilizer (level 0..3)
std::vector<Point2D> stabilizeStrokePoints(
    const std::vector<Point2D>& points,
    int level
);

// Traditional Bengali Rice-Paste (Chaler Guro) calligraphy brush width profile at u in [0, 1]
int computeRicePasteTaperThickness(int baseThickness, double u);

// Combines stylus pressure (0.05..1.0, neutral 0.5) with optional Chaler Guro taper
int computePressureTaperThickness(
    int baseThickness,
    double u,
    double pressure = 0.5,
    bool applyTaper = true
);

// Precomputes normalized arc-length parameters u in [0, 1] for a freehand polyline
std::vector<double> computePolylineArcParameters(
    const std::vector<Point2D>& points
);

}  // namespace alpona

#endif  // ALPONA_STROKE_CRAFT_H
