#ifndef ALPONA_TIMELAPSE_FRAMES_H
#define ALPONA_TIMELAPSE_FRAMES_H

#include "canvas_buffer.h"
#include <vector>

namespace alpona {

struct ReelProgress {
    int completedCount;
    int activeIndex;
    double activeT;
};

/**
 * Deterministic animation progress mapper: converts normalized timeline u in [0,1]
 * into completed stroke count and active stroke parametric fraction t in [0,1].
 */
ReelProgress computeReelProgress(int totalOps, double u);

/**
 * Linearly interpolates a line endpoint to fractional reveal t in [0,1].
 */
Point2D samplePartialLineEnd(Point2D p0, Point2D p1, double t);

/**
 * Generates an arc polyline for a circle swept from 0 to 2*pi*t for smooth
 * frame-by-frame timelapse video rendering.
 */
std::vector<Point2D> samplePartialCircleArc(
    Point2D center,
    double radius,
    double t,
    int maxSteps = 48
);

} // namespace alpona

#endif // ALPONA_TIMELAPSE_FRAMES_H
