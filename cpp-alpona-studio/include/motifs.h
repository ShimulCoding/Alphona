#ifndef ALPONA_MOTIFS_H
#define ALPONA_MOTIFS_H

#include "canvas_buffer.h"
#include <vector>

namespace alpona {

enum class ToolKind {
    Freehand,
    Line,
    Circle,
    SeedFill
};

struct DrawOperation {
    ToolKind kind = ToolKind::Line;
    Point2D p0 = {0, 0};
    Point2D p1 = {0, 0};
    double radius = 0.0;
    std::vector<Point2D> points;
    Color color = {250, 248, 242, 255};
    int thickness = 2;
    bool symmetricFill = true;
    SymmetryConfig symmetry;
};

void executeOperation(CanvasBuffer& buffer, const DrawOperation& op);

std::vector<DrawOperation> buildPadmaLotusMotif(int canvasSize);
std::vector<DrawOperation> buildBoishakhiSunMotif(int canvasSize);
std::vector<DrawOperation> buildKalkaRosetteMotif(int canvasSize);
std::vector<DrawOperation> buildCourtyardChowkMotif(int canvasSize);

} // namespace alpona

#endif // ALPONA_MOTIFS_H
