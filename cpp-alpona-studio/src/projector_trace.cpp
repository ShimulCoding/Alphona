#include "projector_trace.h"

namespace alpona {

int classifyTracingStage(PrimitiveKind kind) {
    switch (kind) {
        case PrimitiveKind::Circle:
            return 1;
        case PrimitiveKind::Line:
        case PrimitiveKind::Polygon:
            return 2;
        case PrimitiveKind::Bezier:
        case PrimitiveKind::Freehand:
            return 3;
        case PrimitiveKind::Fill:
        default:
            return 4;
    }
}

std::array<int, 4> countOperationsPerStage(const std::vector<PrimitiveKind>& ops) {
    std::array<int, 4> counts = {{0, 0, 0, 0}};
    for (size_t i = 0; i < ops.size(); ++i) {
        const int stage = classifyTracingStage(ops[i]);
        if (stage >= 1 && stage <= 4) {
            counts[static_cast<size_t>(stage - 1)] += 1;
        }
    }
    return counts;
}

std::string getTracingStageTitle(int stageNumber) {
    switch (stageNumber) {
        case 1: return "Compass Rings & Core";
        case 2: return "Petals & Radial Spokes";
        case 3: return "Kalka, Bezier & Vine Curves";
        case 4: return "Pigment Fills & Finishing";
        default: return "Full Pattern";
    }
}

} // namespace alpona
