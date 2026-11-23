#ifndef ALPONA_STENCIL_BRIDGER_H
#define ALPONA_STENCIL_BRIDGER_H

#include "canvas_buffer.h"
#include <vector>

namespace alpona {

struct StencilBridgeSegment {
    int islandId;
    int fromX;
    int fromY;
    int toX;
    int toY;
    double distancePx;
    int widthPx;
};

struct StencilBridgeAnalysis {
    CanvasBuffer bridgedStencil;
    CanvasBuffer diagnosticView;
    int initialIslandCount;
    int remainingIslandCount;
    std::vector<StencilBridgeSegment> bridges;

    StencilBridgeAnalysis(int w, int h)
        : bridgedStencil(w, h),
          diagnosticView(w, h),
          initialIslandCount(0),
          remainingIslandCount(0) {}
};

// CSE 402 Week 13: 8-connected BFS floating island detector & shortest-D_e auto-bridger
StencilBridgeAnalysis analyzeAndBridgeStencil(
    const CanvasBuffer& sourceAlpona,
    int bridgeWidthPx = 6,
    bool symmetricDualBridge = true,
    int threshold = 44
);

}  // namespace alpona

#endif  // ALPONA_STENCIL_BRIDGER_H
