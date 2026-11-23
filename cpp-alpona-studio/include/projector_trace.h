#ifndef ALPONA_PROJECTOR_TRACE_H
#define ALPONA_PROJECTOR_TRACE_H

#include <array>
#include <string>
#include <vector>

namespace alpona {

enum class PrimitiveKind {
    Circle,
    Line,
    Polygon,
    Bezier,
    Freehand,
    Fill
};

/**
 * Classifies an Alpona drawing operation into physical floor-chalking stage 1..4:
 *   1 = Compass Rings & Core
 *   2 = Geometric Petals & Spokes
 *   3 = Kalka, Cubic Bezier & Vine Curves
 *   4 = Pigment Fills & Finishing
 */
int classifyTracingStage(PrimitiveKind kind);

std::array<int, 4> countOperationsPerStage(const std::vector<PrimitiveKind>& ops);

std::string getTracingStageTitle(int stageNumber);

} // namespace alpona

#endif // ALPONA_PROJECTOR_TRACE_H
