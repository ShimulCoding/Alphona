#include "canvas_assist.h"
#include <algorithm>
#include <cmath>
#include <limits>

namespace alpona {

namespace {

const double kPi = 3.14159265358979323846;
const double kGuideRings[3] = {120.0, 240.0, 330.0};

double clampCoord(double v, int size) {
    double rounded = std::floor(v + 0.5);
    if (rounded < 0.0) return 0.0;
    if (rounded > static_cast<double>(size - 1)) {
        return static_cast<double>(size - 1);
    }
    return rounded;
}

double rayDistanceToSquareBorder(double cx, double cy, double dx, double dy, double size) {
    double tMax = std::numeric_limits<double>::infinity();
    if (std::fabs(dx) > 1e-10) {
        double tx = (dx > 0.0) ? (size - cx) / dx : (0.0 - cx) / dx;
        if (tx > 0.0 && tx < tMax) tMax = tx;
    }
    if (std::fabs(dy) > 1e-10) {
        double ty = (dy > 0.0) ? (size - cy) / dy : (0.0 - cy) / dy;
        if (ty > 0.0 && ty < tMax) tMax = ty;
    }
    return std::isfinite(tMax) ? tMax : size * 0.5;
}

} // namespace

std::vector<SymmetryReflectionAxis> computeSymmetryReflectionAxes(
    int canvasSize,
    const SymmetryConfig& symmetry
) {
    int sectors = std::max(1, std::min(24, symmetry.sectors));
    double size = static_cast<double>(canvasSize);
    double cx = size * 0.5;
    double cy = size * 0.5;
    std::vector<SymmetryReflectionAxis> axes;
    axes.reserve(static_cast<size_t>(sectors));

    if (symmetry.reflect) {
        for (int k = 0; k < sectors; ++k) {
            double alpha = (kPi * static_cast<double>(k)) / static_cast<double>(sectors);
            double dx = std::cos(alpha);
            double dy = std::sin(alpha);
            double tPos = rayDistanceToSquareBorder(cx, cy, dx, dy, size);
            double tNeg = rayDistanceToSquareBorder(cx, cy, -dx, -dy, size);
            SymmetryReflectionAxis axis;
            axis.x1 = cx - dx * tNeg;
            axis.y1 = cy - dy * tNeg;
            axis.x2 = cx + dx * tPos;
            axis.y2 = cy + dy * tPos;
            axis.angleDeg = (180.0 * static_cast<double>(k)) / static_cast<double>(sectors);
            axis.isPrimary = (k % 2 == 0);
            axis.isReflectionMirror = true;
            axes.push_back(axis);
        }
    } else {
        for (int k = 0; k < sectors; ++k) {
            double theta = (2.0 * kPi * static_cast<double>(k)) / static_cast<double>(sectors);
            double dx = std::cos(theta);
            double dy = std::sin(theta);
            double tPos = rayDistanceToSquareBorder(cx, cy, dx, dy, size);
            SymmetryReflectionAxis axis;
            axis.x1 = cx;
            axis.y1 = cy;
            axis.x2 = cx + dx * tPos;
            axis.y2 = cy + dy * tPos;
            axis.angleDeg = (360.0 * static_cast<double>(k)) / static_cast<double>(sectors);
            axis.isPrimary = (k == 0);
            axis.isReflectionMirror = false;
            axes.push_back(axis);
        }
    }

    return axes;
}

SnapResult snapPointToSymmetryGuides(
    Point2D rawPoint,
    int canvasSize,
    const SymmetryConfig& symmetry,
    const SnapConfig& config,
    double compassLockRadius
) {
    SnapResult res;
    double cx = static_cast<double>(canvasSize) * 0.5;
    double cy = static_cast<double>(canvasSize) * 0.5;
    double dx = rawPoint.x - cx;
    double dy = rawPoint.y - cy;
    double distFromCenter = std::hypot(dx, dy);
    double threshold = std::max(2.0, std::min(36.0, config.snapThresholdPx));
    int sectors = std::max(1, std::min(24, symmetry.sectors));

    bool hasLock = (compassLockRadius >= 4.0);
    double axisAngleRad = 0.0;
    double axisSignedProj = distFromCenter;

    if (config.snapToAxis && distFromCenter > 2.0) {
        double bestPerp = threshold + 1e-6;
        if (symmetry.reflect) {
            for (int k = 0; k < sectors; ++k) {
                double alpha = (kPi * static_cast<double>(k)) / static_cast<double>(sectors);
                double ux = std::cos(alpha);
                double uy = std::sin(alpha);
                double proj = dx * ux + dy * uy;
                double perp = std::fabs(-dx * uy + dy * ux);
                if (perp <= bestPerp) {
                    bestPerp = perp;
                    res.hasSnappedAxis = true;
                    res.snappedAxisAngleDeg =
                        (180.0 * static_cast<double>(k)) / static_cast<double>(sectors);
                    axisAngleRad = alpha;
                    axisSignedProj = proj;
                }
            }
        } else {
            for (int k = 0; k < sectors; ++k) {
                double theta = (2.0 * kPi * static_cast<double>(k)) / static_cast<double>(sectors);
                double ux = std::cos(theta);
                double uy = std::sin(theta);
                double proj = dx * ux + dy * uy;
                if (proj < 0.0) continue;
                double perp = std::fabs(-dx * uy + dy * ux);
                if (perp <= bestPerp) {
                    bestPerp = perp;
                    res.hasSnappedAxis = true;
                    res.snappedAxisAngleDeg =
                        (360.0 * static_cast<double>(k)) / static_cast<double>(sectors);
                    axisAngleRad = theta;
                    axisSignedProj = proj;
                }
            }
        }
    }

    if (hasLock) {
        res.hasLockedRadius = true;
        res.lockedRadius = std::floor(compassLockRadius + 0.5);
        res.hasSnappedRing = true;
        res.snappedRingRadius = res.lockedRadius;
    } else if (config.snapToRing) {
        double bestDiff = threshold + 1e-6;
        for (int i = 0; i < 3; ++i) {
            double diff = std::fabs(distFromCenter - kGuideRings[i]);
            if (diff <= bestDiff) {
                bestDiff = diff;
                res.hasSnappedRing = true;
                res.snappedRingRadius = kGuideRings[i];
            }
        }
    }

    // Case 1: Compass arc lock
    if (hasLock) {
        double angle = std::atan2(dy, dx);
        if (res.hasSnappedAxis) {
            angle = (axisSignedProj >= 0.0) ? axisAngleRad : (axisAngleRad + kPi);
        }
        res.point.x = clampCoord(cx + std::cos(angle) * compassLockRadius, canvasSize);
        res.point.y = clampCoord(cy + std::sin(angle) * compassLockRadius, canvasSize);
        res.wasSnapped = true;
        return res;
    }

    // Case 2: Exact intersection of snapped axis & snapped guide ring
    if (res.hasSnappedAxis && res.hasSnappedRing) {
        double sign = (axisSignedProj >= 0.0) ? 1.0 : -1.0;
        res.point.x = clampCoord(
            cx + std::cos(axisAngleRad) * res.snappedRingRadius * sign,
            canvasSize
        );
        res.point.y = clampCoord(
            cy + std::sin(axisAngleRad) * res.snappedRingRadius * sign,
            canvasSize
        );
        res.wasSnapped = true;
        return res;
    }

    // Case 3: Snapped to axis only
    if (res.hasSnappedAxis) {
        res.point.x = clampCoord(cx + std::cos(axisAngleRad) * axisSignedProj, canvasSize);
        res.point.y = clampCoord(cy + std::sin(axisAngleRad) * axisSignedProj, canvasSize);
        res.wasSnapped = true;
        return res;
    }

    // Case 4: Snapped to concentric ring only
    if (res.hasSnappedRing && distFromCenter > 1e-6) {
        double scale = res.snappedRingRadius / distFromCenter;
        res.point.x = clampCoord(cx + dx * scale, canvasSize);
        res.point.y = clampCoord(cy + dy * scale, canvasSize);
        res.wasSnapped = true;
        return res;
    }

    // Case 5: No snap
    res.point.x = clampCoord(rawPoint.x, canvasSize);
    res.point.y = clampCoord(rawPoint.y, canvasSize);
    res.wasSnapped = false;
    return res;
}

} // namespace alpona
