#include "layer_stack.h"
#include "bezier.h"
#include "transforms.h"
#include <algorithm>
#include <cmath>
#include <limits>

namespace alpona {

namespace {

double distPointToSegment(Point2D p, Point2D a, Point2D b) {
    double vx = b.x - a.x;
    double vy = b.y - a.y;
    double wx = p.x - a.x;
    double wy = p.y - a.y;
    double lenSq = vx * vx + vy * vy;
    if (lenSq < 1e-9) {
        return std::hypot(p.x - a.x, p.y - a.y);
    }
    double t = (wx * vx + wy * vy) / lenSq;
    if (t < 0.0) t = 0.0;
    if (t > 1.0) t = 1.0;
    double px = a.x + t * vx;
    double py = a.y + t * vy;
    return std::hypot(p.x - px, p.y - py);
}

} // namespace

bool toggleLayerVisibility(std::vector<LayerStrokeOp>& stack, int id) {
    for (size_t i = 0; i < stack.size(); ++i) {
        if (stack[i].id == id) {
            stack[i].hidden = !stack[i].hidden;
            return true;
        }
    }
    return false;
}

bool moveLayerOrder(std::vector<LayerStrokeOp>& stack, int id, bool moveUp) {
    for (size_t i = 0; i < stack.size(); ++i) {
        if (stack[i].id == id) {
            if (moveUp) {
                if (i + 1 >= stack.size()) return false;
                std::swap(stack[i], stack[i + 1]);
                return true;
            }
            if (i == 0) return false;
            std::swap(stack[i], stack[i - 1]);
            return true;
        }
    }
    return false;
}

bool toggleLayerLock(std::vector<LayerStrokeOp>& stack, int id) {
    for (size_t i = 0; i < stack.size(); ++i) {
        if (stack[i].id == id) {
            stack[i].locked = !stack[i].locked;
            return true;
        }
    }
    return false;
}

bool setLayerOpacity(std::vector<LayerStrokeOp>& stack, int id, double opacity) {
    double clamped = std::max(0.1, std::min(1.0, opacity));
    for (size_t i = 0; i < stack.size(); ++i) {
        if (stack[i].id == id) {
            if (stack[i].locked) return false;
            stack[i].opacity = clamped;
            return true;
        }
    }
    return false;
}

bool recolorLayer(std::vector<LayerStrokeOp>& stack, int id, Color nextColor) {
    for (size_t i = 0; i < stack.size(); ++i) {
        if (stack[i].id == id) {
            if (stack[i].locked) return false;
            stack[i].color = nextColor;
            return true;
        }
    }
    return false;
}

bool deleteLayerById(std::vector<LayerStrokeOp>& stack, int id) {
    for (size_t i = 0; i < stack.size(); ++i) {
        if (stack[i].id == id) {
            if (stack[i].locked) return false;
            stack.erase(stack.begin() + static_cast<std::ptrdiff_t>(i));
            return true;
        }
    }
    return false;
}

bool assignLayerGroup(std::vector<LayerStrokeOp>& stack, int id, const std::string& groupName) {
    for (size_t i = 0; i < stack.size(); ++i) {
        if (stack[i].id == id) {
            stack[i].group = groupName.empty() ? "Motifs" : groupName;
            return true;
        }
    }
    return false;
}

int toggleGroupVisibility(std::vector<LayerStrokeOp>& stack, const std::string& groupName) {
    int matched = 0;
    bool anyVisible = false;
    for (size_t i = 0; i < stack.size(); ++i) {
        const std::string g = stack[i].group.empty() ? "Motifs" : stack[i].group;
        if (g == groupName) {
            ++matched;
            if (!stack[i].hidden) anyVisible = true;
        }
    }
    if (matched == 0) return 0;
    for (size_t i = 0; i < stack.size(); ++i) {
        const std::string g = stack[i].group.empty() ? "Motifs" : stack[i].group;
        if (g == groupName) {
            stack[i].hidden = anyVisible;
        }
    }
    return matched;
}

bool updateBezierControlPoint(
    std::vector<LayerStrokeOp>& stack,
    int id,
    BezierHandle handle,
    Point2D nextPoint
) {
    for (size_t i = 0; i < stack.size(); ++i) {
        if (stack[i].id == id && stack[i].kind == LayerOpKind::Bezier) {
            if (stack[i].locked) return false;
            if (handle == BezierHandle::P0) stack[i].p0 = nextPoint;
            else if (handle == BezierHandle::P1) stack[i].p1 = nextPoint;
            else if (handle == BezierHandle::P2) stack[i].p2 = nextPoint;
            else if (handle == BezierHandle::P3) stack[i].p3 = nextPoint;
            return true;
        }
    }
    return false;
}

double distanceToLayerOp(const LayerStrokeOp& op, Point2D pt, int canvasSize) {
    Point2D center{
        static_cast<double>(canvasSize) * 0.5,
        static_cast<double>(canvasSize) * 0.5
    };
    double minD = std::numeric_limits<double>::infinity();

    if (op.kind == LayerOpKind::Line) {
        auto segs = generateSymmetricSegments(op.p0, op.p1, center, op.symmetry);
        for (size_t i = 0; i < segs.size(); ++i) {
            double d = distPointToSegment(pt, segs[i].first, segs[i].second);
            if (d < minD) minD = d;
        }
        return std::max(0.0, minD - static_cast<double>(op.thickness) * 0.5);
    }

    if (op.kind == LayerOpKind::Circle) {
        auto centers = generateSymmetricPoints(op.p0, center, op.symmetry);
        for (size_t i = 0; i < centers.size(); ++i) {
            double d = std::fabs(std::hypot(pt.x - centers[i].x, pt.y - centers[i].y) - op.radius);
            if (d < minD) minD = d;
        }
        return std::max(0.0, minD - static_cast<double>(op.thickness) * 0.5);
    }

    if (op.kind == LayerOpKind::Polygon || op.kind == LayerOpKind::Freehand) {
        const size_t n = op.points.size();
        if (n == 1) {
            auto pts = generateSymmetricPoints(op.points[0], center, op.symmetry);
            for (size_t i = 0; i < pts.size(); ++i) {
                double d = std::hypot(pt.x - pts[i].x, pt.y - pts[i].y);
                if (d < minD) minD = d;
            }
        } else if (n >= 2) {
            size_t edgeCount = (op.kind == LayerOpKind::Polygon) ? n : (n - 1);
            for (size_t e = 0; e < edgeCount; ++e) {
                Point2D a = op.points[e];
                Point2D b = op.points[(e + 1) % n];
                auto segs = generateSymmetricSegments(a, b, center, op.symmetry);
                for (size_t i = 0; i < segs.size(); ++i) {
                    double d = distPointToSegment(pt, segs[i].first, segs[i].second);
                    if (d < minD) minD = d;
                }
            }
        }
        return std::max(0.0, minD - static_cast<double>(op.thickness) * 0.5);
    }

    if (op.kind == LayerOpKind::Bezier) {
        auto sampled = sampleCubicBezier(op.p0, op.p1, op.p2, op.p3, 24);
        for (size_t k = 1; k < sampled.size(); ++k) {
            auto segs = generateSymmetricSegments(sampled[k - 1], sampled[k], center, op.symmetry);
            for (size_t i = 0; i < segs.size(); ++i) {
                double d = distPointToSegment(pt, segs[i].first, segs[i].second);
                if (d < minD) minD = d;
            }
        }
        return std::max(0.0, minD - static_cast<double>(op.thickness) * 0.5);
    }

    if (op.kind == LayerOpKind::Fill) {
        auto seeds = generateSymmetricPoints(op.p0, center, op.symmetry);
        for (size_t i = 0; i < seeds.size(); ++i) {
            double d = std::hypot(pt.x - seeds[i].x, pt.y - seeds[i].y);
            if (d < minD) minD = d;
        }
        return minD;
    }

    return minD;
}

std::vector<LayerGroupSummary> buildLayerGroupSections(
    const std::vector<LayerStrokeOp>& stack,
    const std::vector<std::string>& collapsedGroups
) {
    struct Bucket {
        LayerGroupSummary summary;
        int maxIndex;
    };
    std::vector<Bucket> buckets;

    for (int i = static_cast<int>(stack.size()) - 1; i >= 0; --i) {
        const LayerStrokeOp& op = stack[static_cast<size_t>(i)];
        const std::string name = op.group.empty() ? "Motifs" : op.group;

        size_t found = buckets.size();
        for (size_t b = 0; b < buckets.size(); ++b) {
            if (buckets[b].summary.name == name) {
                found = b;
                break;
            }
        }
        if (found == buckets.size()) {
            Bucket fresh;
            fresh.summary.name = name;
            fresh.summary.total = 0;
            fresh.summary.visible = 0;
            fresh.summary.locked = 0;
            fresh.summary.collapsed =
                std::find(collapsedGroups.begin(), collapsedGroups.end(), name) !=
                collapsedGroups.end();
            fresh.maxIndex = i;
            buckets.push_back(fresh);
        }

        Bucket& target = buckets[found];
        target.summary.layerIds.push_back(op.id);
        target.summary.total += 1;
        if (!op.hidden) target.summary.visible += 1;
        if (op.locked) target.summary.locked += 1;
        if (i > target.maxIndex) target.maxIndex = i;
    }

    std::sort(
        buckets.begin(),
        buckets.end(),
        [](const Bucket& a, const Bucket& b) { return a.maxIndex > b.maxIndex; }
    );

    std::vector<LayerGroupSummary> out;
    out.reserve(buckets.size());
    for (size_t i = 0; i < buckets.size(); ++i) {
        out.push_back(buckets[i].summary);
    }
    return out;
}

int hitTestLayerAtPoint(
    const std::vector<LayerStrokeOp>& stack,
    Point2D pt,
    int canvasSize,
    double thresholdPx,
    bool skipLocked
) {
    for (int i = static_cast<int>(stack.size()) - 1; i >= 0; --i) {
        const LayerStrokeOp& op = stack[static_cast<size_t>(i)];
        if (op.hidden) continue;
        if (skipLocked && op.locked) continue;
        if (distanceToLayerOp(op, pt, canvasSize) <= thresholdPx) {
            return op.id;
        }
    }
    return -1;
}

GroupSelectionResult selectGroupAtPoint(
    const std::vector<LayerStrokeOp>& stack,
    Point2D pt,
    int canvasSize,
    double thresholdPx
) {
    GroupSelectionResult result;
    int hitIdx = -1;
    double bestDist = thresholdPx;

    for (int i = static_cast<int>(stack.size()) - 1; i >= 0; --i) {
        const LayerStrokeOp& op = stack[static_cast<size_t>(i)];
        if (op.hidden) continue;
        double dist = distanceToLayerOp(op, pt, canvasSize);
        if (dist <= thresholdPx) {
            if (hitIdx < 0 || dist + 3.0 < bestDist) {
                hitIdx = i;
                bestDist = dist;
            }
        }
    }

    if (hitIdx < 0) {
        return result;
    }

    const LayerStrokeOp& hitOp = stack[static_cast<size_t>(hitIdx)];
    const std::string targetGroup = hitOp.group.empty() ? "Motifs" : hitOp.group;

    result.groupName = targetGroup;
    result.hitLayerId = hitOp.id;
    for (size_t i = 0; i < stack.size(); ++i) {
        const std::string g = stack[i].group.empty() ? "Motifs" : stack[i].group;
        if (g == targetGroup) {
            result.layerIds.push_back(stack[i].id);
        }
    }
    return result;
}

} // namespace alpona
