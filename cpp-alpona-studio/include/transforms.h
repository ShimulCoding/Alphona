#ifndef ALPONA_TRANSFORMS_H
#define ALPONA_TRANSFORMS_H

#include "canvas_buffer.h"
#include <array>
#include <utility>
#include <vector>

namespace alpona {

// Cohen-Sutherland 4-bit region outcodes
constexpr int OUTCODE_INSIDE = 0;
constexpr int OUTCODE_LEFT   = 1;
constexpr int OUTCODE_RIGHT  = 2;
constexpr int OUTCODE_BOTTOM = 4;
constexpr int OUTCODE_TOP    = 8;

using Mat3 = std::array<double, 9>;

Mat3 mat3Identity();
Mat3 mat3Multiply(const Mat3& a, const Mat3& b);
Mat3 mat3Translate(double tx, double ty);
Mat3 mat3Scale(double sx, double sy);
Mat3 mat3Rotate(double angleRad);
Mat3 mat3Shear(double shx, double shy);
Mat3 mat3Reflect(bool flipX, bool flipY);
bool mat3Inverse(const Mat3& m, Mat3& invOut);
Point2D applyMat3(const Mat3& m, Point2D p);

int computeOutcode(double x, double y, const ClipBounds& bounds);

bool cohenSutherlandClip(
    Point2D& p0,
    Point2D& p1,
    const ClipBounds& bounds,
    bool* wasClipped = nullptr
);

bool liangBarskyClip(
    Point2D& p0,
    Point2D& p1,
    const ClipBounds& bounds,
    bool* wasClipped = nullptr
);

std::vector<Point2D> sutherlandHodgmanClip(
    const std::vector<Point2D>& polygon,
    const ClipBounds& bounds
);

std::vector<std::vector<Point2D>> weilerAthertonClip(
    const std::vector<Point2D>& polygon,
    const ClipBounds& bounds
);

Point2D rotatePoint(Point2D p, Point2D center, double angleRad);
Point2D reflectHorizontal(Point2D p, Point2D center);

std::vector<Point2D> generateSymmetricPoints(
    Point2D p,
    Point2D center,
    const SymmetryConfig& symmetry
);

std::vector<std::pair<Point2D, Point2D>> generateSymmetricSegments(
    Point2D p0,
    Point2D p1,
    Point2D center,
    const SymmetryConfig& symmetry
);

} // namespace alpona

#endif // ALPONA_TRANSFORMS_H
