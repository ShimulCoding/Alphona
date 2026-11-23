#ifndef ALPONA_GENERATIVE_COMPOSER_H
#define ALPONA_GENERATIVE_COMPOSER_H

#include "canvas_buffer.h"
#include <cstdint>
#include <map>
#include <string>
#include <vector>

namespace alpona {

struct ProceduralAlponaConfig {
    uint32_t seed;
    int sectors;
    bool includePhyllotaxis;
    bool includeRhodonea;
    bool includeLSystemVine;
    Color primaryColor;
    Color accentColor;
    int thickness;

    ProceduralAlponaConfig()
        : seed(2026),
          sectors(8),
          includePhyllotaxis(true),
          includeRhodonea(true),
          includeLSystemVine(true),
          primaryColor({248, 244, 236, 255}),
          accentColor({220, 38, 38, 255}),
          thickness(3) {}
};

struct ProceduralCircleOp {
    Point2D center;
    int radius;
    Color color;
    int thickness;
};

struct ProceduralLineOp {
    Point2D p0;
    Point2D p1;
    Color color;
    int thickness;
    SymmetryConfig symmetry;
};

struct ProceduralPolylineOp {
    std::vector<Point2D> points;
    Color color;
    int thickness;
    SymmetryConfig symmetry;
};

struct ProceduralComposeResult {
    std::vector<ProceduralCircleOp> circles;
    std::vector<ProceduralLineOp> lines;
    std::vector<ProceduralPolylineOp> polylines;
    SymmetryConfig symmetry;
    size_t lSystemAxiomLength;
    int phyllotaxisDots;
};

double nextDeterministicRand(uint32_t& state);

std::string expandLSystem(
    const std::string& axiom,
    const std::map<char, std::string>& rules,
    int iterations);

std::vector<ProceduralCircleOp> generatePhyllotaxisCore(
    int canvasSize,
    int dotCount,
    double maxRadiusFrac,
    Color color,
    int thickness);

ProceduralPolylineOp generateRhodoneaLotusRing(
    int canvasSize,
    int sectors,
    double innerFrac,
    double outerFrac,
    int petalHarmonic,
    Color color,
    int thickness);

std::vector<ProceduralLineOp> generateLSystemVineBorder(
    int canvasSize,
    int sectors,
    double ringFrac,
    int iterations,
    double branchAngleDeg,
    Color color,
    int thickness,
    size_t* outExpandedLength = nullptr);

ProceduralComposeResult composeProceduralAlpona(
    int canvasSize,
    const ProceduralAlponaConfig& config);

void rasterizeProceduralAlpona(
    CanvasBuffer& surface,
    const ProceduralComposeResult& result);

} // namespace alpona

#endif // ALPONA_GENERATIVE_COMPOSER_H
