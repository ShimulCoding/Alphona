#ifndef ALPONA_LAYER_STACK_H
#define ALPONA_LAYER_STACK_H

#include "canvas_buffer.h"
#include <string>
#include <vector>

namespace alpona {

enum class LayerOpKind {
    Line,
    Circle,
    Polygon,
    Freehand,
    Bezier,
    Fill
};

enum class BezierHandle {
    P0,
    P1,
    P2,
    P3
};

struct LayerStrokeOp {
    int id;
    LayerOpKind kind;
    Point2D p0;
    Point2D p1;
    Point2D p2;
    Point2D p3;
    double radius;
    std::vector<Point2D> points;
    Color color;
    int thickness;
    SymmetryConfig symmetry;
    bool hidden;
    bool locked;
    double opacity;
    std::string group;

    LayerStrokeOp()
        : id(0),
          kind(LayerOpKind::Line),
          p0{0.0, 0.0},
          p1{0.0, 0.0},
          p2{0.0, 0.0},
          p3{0.0, 0.0},
          radius(0.0),
          color{250, 248, 242, 255},
          thickness(2),
          symmetry{8, true},
          hidden(false),
          locked(false),
          opacity(1.0),
          group("Motifs") {}
};

bool toggleLayerVisibility(std::vector<LayerStrokeOp>& stack, int id);
bool toggleLayerLock(std::vector<LayerStrokeOp>& stack, int id);
bool setLayerOpacity(std::vector<LayerStrokeOp>& stack, int id, double opacity);
bool moveLayerOrder(std::vector<LayerStrokeOp>& stack, int id, bool moveUp);
bool recolorLayer(std::vector<LayerStrokeOp>& stack, int id, Color nextColor);
bool deleteLayerById(std::vector<LayerStrokeOp>& stack, int id);
bool assignLayerGroup(std::vector<LayerStrokeOp>& stack, int id, const std::string& groupName);
int toggleGroupVisibility(std::vector<LayerStrokeOp>& stack, const std::string& groupName);
bool updateBezierControlPoint(
    std::vector<LayerStrokeOp>& stack,
    int id,
    BezierHandle handle,
    Point2D nextPoint
);

/**
 * Computes minimum Euclidean distance from query point `pt` to any symmetric copy
 * of `op` in logical canvas space.
 */
double distanceToLayerOp(const LayerStrokeOp& op, Point2D pt, int canvasSize);

struct LayerGroupSummary {
    std::string name;
    std::vector<int> layerIds; // ordered top-most z-order first
    int total;
    int visible;
    int locked;
    bool collapsed;
};

/**
 * Groups stack operations into collapsible visual categories ordered by highest
 * z-order member descending, with member layerIds ordered top-most first.
 */
std::vector<LayerGroupSummary> buildLayerGroupSections(
    const std::vector<LayerStrokeOp>& stack,
    const std::vector<std::string>& collapsedGroups = {}
);

/**
 * Hit-tests the layer stack from topmost z-order downward and returns the ID
 * of the first visible operation within `thresholdPx`, or -1 if none match.
 */
int hitTestLayerAtPoint(
    const std::vector<LayerStrokeOp>& stack,
    Point2D pt,
    int canvasSize,
    double thresholdPx = 14.0,
    bool skipLocked = false
);

struct GroupSelectionResult {
    std::string groupName;
    int hitLayerId;
    std::vector<int> layerIds;

    GroupSelectionResult() : groupName(), hitLayerId(-1), layerIds() {}
};

/**
 * Hit-tests the layer stack at `pt` (across all symmetric copies from topmost
 * z-order downward) and returns all layer IDs sharing the hit operation's group.
 */
GroupSelectionResult selectGroupAtPoint(
    const std::vector<LayerStrokeOp>& stack,
    Point2D pt,
    int canvasSize,
    double thresholdPx = 18.0
);

} // namespace alpona

#endif // ALPONA_LAYER_STACK_H
