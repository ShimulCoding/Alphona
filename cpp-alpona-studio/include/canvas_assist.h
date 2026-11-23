#ifndef ALPONA_CANVAS_ASSIST_H
#define ALPONA_CANVAS_ASSIST_H

#include "canvas_buffer.h"
#include <vector>

namespace alpona {

struct SymmetryReflectionAxis {
    double x1;
    double y1;
    double x2;
    double y2;
    double angleDeg;
    bool isPrimary;
    bool isReflectionMirror;
};

struct SnapConfig {
    bool snapToAxis;
    bool snapToRing;
    bool compassArcLock;
    double snapThresholdPx;

    SnapConfig()
        : snapToAxis(true),
          snapToRing(true),
          compassArcLock(false),
          snapThresholdPx(10.0) {}
};

struct SnapResult {
    Point2D point;
    bool hasSnappedAxis;
    double snappedAxisAngleDeg;
    bool hasSnappedRing;
    double snappedRingRadius;
    bool hasLockedRadius;
    double lockedRadius;
    bool wasSnapped;

    SnapResult()
        : point{0.0, 0.0},
          hasSnappedAxis(false),
          snappedAxisAngleDeg(0.0),
          hasSnappedRing(false),
          snappedRingRadius(0.0),
          hasLockedRadius(false),
          lockedRadius(0.0),
          wasSnapped(false) {}
};

/**
 * Computes edge-to-edge reflection mirror axes for Dihedral D_n symmetry
 * (angles k*pi/n) or rotational sector boundary rays for Cyclic C_n (2*pi*k/n).
 */
std::vector<SymmetryReflectionAxis> computeSymmetryReflectionAxes(
    int canvasSize,
    const SymmetryConfig& symmetry
);

/**
 * Projects a pointer coordinate onto the closest active symmetry reflection axis,
 * concentric guide ring (r = 120, 240, 330), or a locked compass arc radius.
 * Pass compassLockRadius < 0.0 when compass arc lock is inactive.
 */
SnapResult snapPointToSymmetryGuides(
    Point2D rawPoint,
    int canvasSize,
    const SymmetryConfig& symmetry,
    const SnapConfig& config,
    double compassLockRadius = -1.0
);

} // namespace alpona

#endif // ALPONA_CANVAS_ASSIST_H
