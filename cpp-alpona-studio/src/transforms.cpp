#include "../include/transforms.h"
#include <algorithm>
#include <cmath>

namespace alpona {

namespace {
constexpr double kPi = 3.14159265358979323846;
}

Mat3 mat3Identity() {
    return {{1, 0, 0, 0, 1, 0, 0, 0, 1}};
}

Mat3 mat3Multiply(const Mat3& a, const Mat3& b) {
    Mat3 out = {{0, 0, 0, 0, 0, 0, 0, 0, 0}};
    for (int r = 0; r < 3; ++r) {
        for (int c = 0; c < 3; ++c) {
            out[r * 3 + c] =
                a[r * 3 + 0] * b[0 * 3 + c] +
                a[r * 3 + 1] * b[1 * 3 + c] +
                a[r * 3 + 2] * b[2 * 3 + c];
        }
    }
    return out;
}

Mat3 mat3Translate(double tx, double ty) {
    return {{1, 0, tx, 0, 1, ty, 0, 0, 1}};
}

Mat3 mat3Scale(double sx, double sy) {
    return {{sx, 0, 0, 0, sy, 0, 0, 0, 1}};
}

Mat3 mat3Rotate(double angleRad) {
    const double c = std::cos(angleRad);
    const double s = std::sin(angleRad);
    return {{c, -s, 0, s, c, 0, 0, 0, 1}};
}

Mat3 mat3Shear(double shx, double shy) {
    return {{1, shx, 0, shy, 1, 0, 0, 0, 1}};
}

Mat3 mat3Reflect(bool flipX, bool flipY) {
    return {{flipX ? -1.0 : 1.0, 0, 0, 0, flipY ? -1.0 : 1.0, 0, 0, 0, 1}};
}

bool mat3Inverse(const Mat3& m, Mat3& invOut) {
    const double a = m[0], b = m[1], tx = m[2];
    const double c = m[3], d = m[4], ty = m[5];
    const double det = a * d - b * c;
    if (std::fabs(det) < 1e-10) {
        return false;
    }
    const double invDet = 1.0 / det;
    const double ia = d * invDet;
    const double ib = -b * invDet;
    const double ic = -c * invDet;
    const double id = a * invDet;
    const double itx = -(ia * tx + ib * ty);
    const double ity = -(ic * tx + id * ty);
    invOut = {{ia, ib, itx, ic, id, ity, 0, 0, 1}};
    return true;
}

Point2D applyMat3(const Mat3& m, Point2D p) {
    return {
        m[0] * p.x + m[1] * p.y + m[2],
        m[3] * p.x + m[4] * p.y + m[5]
    };
}

int computeOutcode(double x, double y, const ClipBounds& bounds) {
    int code = OUTCODE_INSIDE;
    if (x < bounds.xmin) {
        code |= OUTCODE_LEFT;
    } else if (x > bounds.xmax) {
        code |= OUTCODE_RIGHT;
    }
    if (y < bounds.ymin) {
        code |= OUTCODE_TOP;
    } else if (y > bounds.ymax) {
        code |= OUTCODE_BOTTOM;
    }
    return code;
}

bool cohenSutherlandClip(
    Point2D& p0,
    Point2D& p1,
    const ClipBounds& bounds,
    bool* wasClipped
) {
    double x0 = p0.x, y0 = p0.y;
    double x1 = p1.x, y1 = p1.y;

    int code0 = computeOutcode(x0, y0, bounds);
    int code1 = computeOutcode(x1, y1, bounds);
    bool clipped = false;

    for (int iter = 0; iter < 8; ++iter) {
        if ((code0 | code1) == 0) {
            p0 = {x0, y0};
            p1 = {x1, y1};
            if (wasClipped) *wasClipped = clipped;
            return true;
        }
        if ((code0 & code1) != 0) {
            return false;
        }

        clipped = true;
        int outcodeOut = (code0 != 0) ? code0 : code1;
        double x = 0.0, y = 0.0;

        if (outcodeOut & OUTCODE_BOTTOM) {
            x = x0 + (x1 - x0) * (bounds.ymax - y0) / (y1 - y0);
            y = bounds.ymax;
        } else if (outcodeOut & OUTCODE_TOP) {
            x = x0 + (x1 - x0) * (bounds.ymin - y0) / (y1 - y0);
            y = bounds.ymin;
        } else if (outcodeOut & OUTCODE_RIGHT) {
            y = y0 + (y1 - y0) * (bounds.xmax - x0) / (x1 - x0);
            x = bounds.xmax;
        } else if (outcodeOut & OUTCODE_LEFT) {
            y = y0 + (y1 - y0) * (bounds.xmin - x0) / (x1 - x0);
            x = bounds.xmin;
        }

        if (outcodeOut == code0) {
            x0 = x;
            y0 = y;
            code0 = computeOutcode(x0, y0, bounds);
        } else {
            x1 = x;
            y1 = y;
            code1 = computeOutcode(x1, y1, bounds);
        }
    }
    return false;
}

bool liangBarskyClip(
    Point2D& p0,
    Point2D& p1,
    const ClipBounds& bounds,
    bool* wasClipped
) {
    const double dx = p1.x - p0.x;
    const double dy = p1.y - p0.y;
    const double p[4] = {-dx, dx, -dy, dy};
    const double q[4] = {
        p0.x - bounds.xmin,
        bounds.xmax - p0.x,
        p0.y - bounds.ymin,
        bounds.ymax - p0.y
    };

    double t0 = 0.0;
    double t1 = 1.0;

    for (int i = 0; i < 4; ++i) {
        if (std::fabs(p[i]) < 1e-12) {
            if (q[i] < 0.0) return false;
        } else {
            const double r = q[i] / p[i];
            if (p[i] < 0.0) {
                if (r > t1) return false;
                if (r > t0) t0 = r;
            } else {
                if (r < t0) return false;
                if (r < t1) t1 = r;
            }
        }
    }

    if (wasClipped) {
        *wasClipped = (t0 > 1e-9 || t1 < 1.0 - 1e-9);
    }
    const Point2D orig0 = p0;
    p0 = {orig0.x + t0 * dx, orig0.y + t0 * dy};
    p1 = {orig0.x + t1 * dx, orig0.y + t1 * dy};
    return true;
}

std::vector<Point2D> sutherlandHodgmanClip(
    const std::vector<Point2D>& polygon,
    const ClipBounds& bounds
) {
    if (polygon.size() < 3) return {};

    auto clipAgainstEdge = [](
        const std::vector<Point2D>& input,
        int edgeId,
        const ClipBounds& b
    ) -> std::vector<Point2D> {
        auto inside = [&](const Point2D& pt) -> bool {
            if (edgeId == 0) return pt.x >= b.xmin;
            if (edgeId == 1) return pt.x <= b.xmax;
            if (edgeId == 2) return pt.y >= b.ymin;
            return pt.y <= b.ymax;
        };
        auto intersect = [&](const Point2D& a, const Point2D& c) -> Point2D {
            if (edgeId == 0) {
                double t = (b.xmin - a.x) / (c.x - a.x);
                return {b.xmin, a.y + t * (c.y - a.y)};
            }
            if (edgeId == 1) {
                double t = (b.xmax - a.x) / (c.x - a.x);
                return {b.xmax, a.y + t * (c.y - a.y)};
            }
            if (edgeId == 2) {
                double t = (b.ymin - a.y) / (c.y - a.y);
                return {a.x + t * (c.x - a.x), b.ymin};
            }
            double t = (b.ymax - a.y) / (c.y - a.y);
            return {a.x + t * (c.x - a.x), b.ymax};
        };

        std::vector<Point2D> output;
        if (input.empty()) return output;

        Point2D prev = input.back();
        bool prevIn = inside(prev);
        for (const auto& curr : input) {
            bool currIn = inside(curr);
            if (currIn) {
                if (!prevIn) output.push_back(intersect(prev, curr));
                output.push_back(curr);
            } else if (prevIn) {
                output.push_back(intersect(prev, curr));
            }
            prev = curr;
            prevIn = currIn;
        }
        return output;
    };

    std::vector<Point2D> out = polygon;
    for (int e = 0; e < 4; ++e) {
        out = clipAgainstEdge(out, e, bounds);
        if (out.empty()) break;
    }
    return out;
}

namespace {

double signedPolyArea(const std::vector<Point2D>& poly) {
    double a = 0.0;
    const size_t n = poly.size();
    for (size_t i = 0; i < n; ++i) {
        const Point2D& p = poly[i];
        const Point2D& q = poly[(i + 1) % n];
        a += p.x * q.y - q.x * p.y;
    }
    return 0.5 * a;
}

bool pointInClipRect(const Point2D& p, const ClipBounds& b) {
    return p.x >= b.xmin - 1e-7 && p.x <= b.xmax + 1e-7 &&
           p.y >= b.ymin - 1e-7 && p.y <= b.ymax + 1e-7;
}

bool pointInPoly(const Point2D& pt, const std::vector<Point2D>& poly) {
    bool inside = false;
    const size_t n = poly.size();
    for (size_t i = 0, j = n - 1; i < n; j = i++) {
        const double xi = poly[i].x, yi = poly[i].y;
        const double xj = poly[j].x, yj = poly[j].y;
        if (((yi > pt.y) != (yj > pt.y)) &&
            (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

bool intersectSegsWA(
    const Point2D& a, const Point2D& b,
    const Point2D& c, const Point2D& d,
    double& tOut, double& uOut, Point2D& ptOut
) {
    const double rX = b.x - a.x, rY = b.y - a.y;
    const double sX = d.x - c.x, sY = d.y - c.y;
    const double denom = rX * sY - rY * sX;
    if (std::fabs(denom) < 1e-10) return false;
    const double qpX = c.x - a.x, qpY = c.y - a.y;
    const double t = (qpX * sY - qpY * sX) / denom;
    const double u = (qpX * rY - qpY * rX) / denom;
    if (t > 1e-7 && t < 1.0 - 1e-7 && u >= -1e-7 && u <= 1.0 + 1e-7) {
        tOut = t;
        uOut = u;
        ptOut = {a.x + t * rX, a.y + t * rY};
        return true;
    }
    return false;
}

} // namespace

std::vector<std::vector<Point2D>> weilerAthertonClip(
    const std::vector<Point2D>& polygon,
    const ClipBounds& bounds
) {
    if (polygon.size() < 3) return {};

    // Ensure clockwise orientation in screen coordinates (positive signed area)
    std::vector<Point2D> subj = polygon;
    if (signedPolyArea(subj) < 0.0) {
        std::reverse(subj.begin(), subj.end());
    }

    const std::vector<Point2D> clip = {
        {bounds.xmin, bounds.ymin},
        {bounds.xmax, bounds.ymin},
        {bounds.xmax, bounds.ymax},
        {bounds.xmin, bounds.ymax}
    };

    struct WANode {
        Point2D pt;
        bool isIntersection;
        bool entering;
        int partnerIdx;
        bool visited;
    };

    struct EdgeHit {
        double param;
        Point2D pt;
        bool entering;
        int id;
    };

    std::vector<std::vector<EdgeHit>> subjHits(subj.size());
    std::vector<std::vector<EdgeHit>> clipHits(clip.size());
    int hitId = 0;

    for (size_t i = 0; i < subj.size(); ++i) {
        const Point2D& s0 = subj[i];
        const Point2D& s1 = subj[(i + 1) % subj.size()];
        for (size_t j = 0; j < clip.size(); ++j) {
            const Point2D& c0 = clip[j];
            const Point2D& c1 = clip[(j + 1) % clip.size()];
            double t = 0.0, u = 0.0;
            Point2D hit = {0.0, 0.0};
            if (intersectSegsWA(s0, s1, c0, c1, t, u, hit)) {
                // Edge cross product determines entering vs exiting clockwise clip window
                const double edgeX = c1.x - c0.x;
                const double edgeY = c1.y - c0.y;
                const double subjX = s1.x - s0.x;
                const double subjY = s1.y - s0.y;
                const bool entering = (edgeX * subjY - edgeY * subjX) > 0.0;
                const int id = hitId++;
                subjHits[i].push_back({t, hit, entering, id});
                clipHits[j].push_back({u, hit, entering, id});
            }
        }
    }

    if (hitId == 0) {
        if (pointInClipRect(subj[0], bounds)) {
            return {subj};
        }
        Point2D mid = {(bounds.xmin + bounds.xmax) * 0.5, (bounds.ymin + bounds.ymax) * 0.5};
        if (pointInPoly(mid, subj)) {
            return {clip};
        }
        return {};
    }

    std::vector<WANode> subjList;
    std::vector<int> idToSubjIdx(static_cast<size_t>(hitId), -1);
    for (size_t i = 0; i < subj.size(); ++i) {
        subjList.push_back({subj[i], false, false, -1, false});
        auto& hits = subjHits[i];
        std::sort(hits.begin(), hits.end(), [](const EdgeHit& a, const EdgeHit& b) {
            return a.param < b.param;
        });
        for (const auto& h : hits) {
            idToSubjIdx[static_cast<size_t>(h.id)] = static_cast<int>(subjList.size());
            subjList.push_back({h.pt, true, h.entering, -1, false});
        }
    }

    std::vector<WANode> clipList;
    for (size_t j = 0; j < clip.size(); ++j) {
        clipList.push_back({clip[j], false, false, -1, false});
        auto& hits = clipHits[j];
        std::sort(hits.begin(), hits.end(), [](const EdgeHit& a, const EdgeHit& b) {
            return a.param < b.param;
        });
        for (const auto& h : hits) {
            const int sIdx = idToSubjIdx[static_cast<size_t>(h.id)];
            const int cIdx = static_cast<int>(clipList.size());
            clipList.push_back({h.pt, true, h.entering, sIdx, false});
            if (sIdx >= 0) {
                subjList[static_cast<size_t>(sIdx)].partnerIdx = cIdx;
            }
        }
    }

    std::vector<std::vector<Point2D>> result;
    const size_t maxSteps = subjList.size() + clipList.size() + 8;

    for (size_t startIdx = 0; startIdx < subjList.size(); ++startIdx) {
        if (!subjList[startIdx].isIntersection ||
            !subjList[startIdx].entering ||
            subjList[startIdx].visited) {
            continue;
        }

        std::vector<Point2D> outPoly;
        bool onSubject = true;
        int currIdx = static_cast<int>(startIdx);

        for (size_t step = 0; step < maxSteps; ++step) {
            if (onSubject) {
                WANode& node = subjList[static_cast<size_t>(currIdx)];
                if (step > 0 && currIdx == static_cast<int>(startIdx)) break;
                node.visited = true;
                outPoly.push_back(node.pt);
                if (node.isIntersection && !node.entering && node.partnerIdx >= 0) {
                    onSubject = false;
                    currIdx = (node.partnerIdx + 1) % static_cast<int>(clipList.size());
                } else {
                    currIdx = (currIdx + 1) % static_cast<int>(subjList.size());
                }
            } else {
                WANode& node = clipList[static_cast<size_t>(currIdx)];
                outPoly.push_back(node.pt);
                if (node.isIntersection && node.entering && node.partnerIdx >= 0) {
                    if (node.partnerIdx == static_cast<int>(startIdx)) break;
                    onSubject = true;
                    subjList[static_cast<size_t>(node.partnerIdx)].visited = true;
                    currIdx = (node.partnerIdx + 1) % static_cast<int>(subjList.size());
                } else {
                    currIdx = (currIdx + 1) % static_cast<int>(clipList.size());
                }
            }
        }

        if (outPoly.size() >= 3) {
            result.push_back(outPoly);
        }
    }

    if (result.empty()) {
        auto fallback = sutherlandHodgmanClip(polygon, bounds);
        if (fallback.size() >= 3) return {fallback};
    }
    return result;
}

Point2D rotatePoint(Point2D p, Point2D center, double angleRad) {
    const double dx = p.x - center.x;
    const double dy = p.y - center.y;
    const double c = std::cos(angleRad);
    const double s = std::sin(angleRad);
    return {
        center.x + dx * c - dy * s,
        center.y + dx * s + dy * c
    };
}

Point2D reflectHorizontal(Point2D p, Point2D center) {
    return {p.x, 2.0 * center.y - p.y};
}

std::vector<Point2D> generateSymmetricPoints(
    Point2D p,
    Point2D center,
    const SymmetryConfig& symmetry
) {
    const int sectors = symmetry.sectors < 1 ? 1 : symmetry.sectors;
    const double step = (2.0 * kPi) / static_cast<double>(sectors);
    std::vector<Point2D> result;
    result.reserve(symmetry.reflect ? sectors * 2 : sectors);

    const Point2D mirrored = reflectHorizontal(p, center);
    for (int k = 0; k < sectors; ++k) {
        const double theta = k * step;
        result.push_back(rotatePoint(p, center, theta));
        if (symmetry.reflect) {
            result.push_back(rotatePoint(mirrored, center, theta));
        }
    }
    return result;
}

std::vector<std::pair<Point2D, Point2D>> generateSymmetricSegments(
    Point2D p0,
    Point2D p1,
    Point2D center,
    const SymmetryConfig& symmetry
) {
    const int sectors = symmetry.sectors < 1 ? 1 : symmetry.sectors;
    const double step = (2.0 * kPi) / static_cast<double>(sectors);
    std::vector<std::pair<Point2D, Point2D>> result;
    result.reserve(symmetry.reflect ? sectors * 2 : sectors);

    const Point2D m0 = reflectHorizontal(p0, center);
    const Point2D m1 = reflectHorizontal(p1, center);
    for (int k = 0; k < sectors; ++k) {
        const double theta = k * step;
        result.emplace_back(
            rotatePoint(p0, center, theta),
            rotatePoint(p1, center, theta)
        );
        if (symmetry.reflect) {
            result.emplace_back(
                rotatePoint(m0, center, theta),
                rotatePoint(m1, center, theta)
            );
        }
    }
    return result;
}

} // namespace alpona
