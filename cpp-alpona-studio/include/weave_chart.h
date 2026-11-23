#ifndef ALPONA_WEAVE_CHART_H
#define ALPONA_WEAVE_CHART_H

#include "canvas_buffer.h"
#include <cstdint>
#include <string>
#include <vector>

namespace alpona {

enum class WeavePalettePreset {
    AlponaSource,
    JamdaniZari,
    NakshiKantha,
    DmcHeritage
};

enum class WeaveDitherMode {
    Nearest,
    Bayer4x4,
    FloydSteinberg
};

struct WeaveChartOptions {
    int gridSize;
    int maxColors;
    WeaveDitherMode ditherMode;
    WeavePalettePreset palettePreset;
    int clothCountPerInch;

    WeaveChartOptions()
        : gridSize(48),
          maxColors(6),
          ditherMode(WeaveDitherMode::Bayer4x4),
          palettePreset(WeavePalettePreset::JamdaniZari),
          clothCountPerInch(14) {}
};

struct WeaveThreadStat {
    int index;
    Color color;
    std::string hex;
    std::string name;
    std::string symbol;
    int stitchCount;
    double percent;
    double estimatedThreadMeters;
};

struct WeaveChartResult {
    int gridSize;
    std::vector<uint8_t> cells;
    std::vector<WeaveThreadStat> threads;
    int totalStitches;
    double finishedSizeCm;
    WeaveDitherMode ditherMode;
};

WeaveChartResult buildWeaveChart(
    const CanvasBuffer& alpona,
    const WeaveChartOptions& options);

std::string exportWeaveChartCsv(const WeaveChartResult& chart);

} // namespace alpona

#endif // ALPONA_WEAVE_CHART_H
