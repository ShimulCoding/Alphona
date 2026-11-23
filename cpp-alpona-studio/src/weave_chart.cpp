#include "weave_chart.h"
#include "colorway_remap.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <sstream>

namespace alpona {

namespace {

struct ThreadPresetEntry {
    Color color;
    const char* name;
};

const char* kSymbols[8] = {".", "*", "^", "#", "@", "x", "+", "o"};

const ThreadPresetEntry kJamdaniZari[8] = {
    {{27, 40, 69, 255}, "Nilambari Indigo"},
    {{250, 246, 238, 255}, "Kora Muslin Ivory"},
    {{234, 179, 8, 255}, "Sonali Zari Gold"},
    {{185, 28, 28, 255}, "Lal Paar Crimson"},
    {{21, 128, 61, 255}, "Pata Green"},
    {{244, 114, 182, 255}, "Golapi Rose"},
    {{56, 189, 248, 255}, "Meghna Sky"},
    {{24, 24, 27, 255}, "Kajal Black"}
};

const ThreadPresetEntry kNakshiKantha[8] = {
    {{247, 243, 233, 255}, "Unbleached Cotton"},
    {{185, 28, 28, 255}, "Kantha Sindoor"},
    {{29, 78, 216, 255}, "Neel Thread"},
    {{217, 119, 6, 255}, "Halud Mustard"},
    {{22, 101, 52, 255}, "Shobuj Leaf"},
    {{31, 41, 55, 255}, "Charcoal Outline"},
    {{190, 24, 93, 255}, "Alta Magenta"},
    {{234, 88, 12, 255}, "Marigold Rust"}
};

const ThreadPresetEntry kDmcHeritage[8] = {
    {{38, 38, 40, 255}, "DMC 310 Slate"},
    {{250, 248, 242, 255}, "DMC B5200 White"},
    {{200, 30, 30, 255}, "DMC 666 Red"},
    {{245, 158, 11, 255}, "DMC 742 Gold"},
    {{22, 163, 74, 255}, "DMC 701 Green"},
    {{37, 99, 235, 255}, "DMC 797 Royal"},
    {{234, 88, 12, 255}, "DMC 720 Flame"},
    {{168, 85, 247, 255}, "DMC 552 Violet"}
};

const int kBayerRaw[16] = {
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
};

std::string colorToHex(Color c) {
    char buf[10];
    std::snprintf(buf, sizeof(buf), "#%02X%02X%02X", c.r, c.g, c.b);
    return std::string(buf);
}

int findNearestColorIdx(double r, double g, double b, const std::vector<Color>& palette) {
    int best = 0;
    double bestD = 1e18;
    for (size_t i = 0; i < palette.size(); ++i) {
        const double dr = r - static_cast<double>(palette[i].r);
        const double dg = g - static_cast<double>(palette[i].g);
        const double db = b - static_cast<double>(palette[i].b);
        const double d = 0.30 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
        if (d < bestD) {
            bestD = d;
            best = static_cast<int>(i);
        }
    }
    return best;
}

double clampChannel(double v) {
    if (v < 0.0) return 0.0;
    if (v > 255.0) return 255.0;
    return v;
}

} // namespace

WeaveChartResult buildWeaveChart(
    const CanvasBuffer& alpona,
    const WeaveChartOptions& options) {
    const int n = std::max(24, std::min(112, options.gridSize));
    const int maxColors = std::max(3, std::min(8, options.maxColors));

    // Step 1: Area-averaged downsampling onto n x n warp/weft RGB grid
    std::vector<double> rBuf(static_cast<size_t>(n * n), 0.0);
    std::vector<double> gBuf(static_cast<size_t>(n * n), 0.0);
    std::vector<double> bBuf(static_cast<size_t>(n * n), 0.0);

    for (int y = 0; y < n; ++y) {
        const int sy0 = static_cast<int>(std::floor((static_cast<double>(y) / n) * alpona.height()));
        const int sy1 = std::max(
            sy0 + 1,
            static_cast<int>(std::floor((static_cast<double>(y + 1) / n) * alpona.height())));
        for (int x = 0; x < n; ++x) {
            const int sx0 = static_cast<int>(std::floor((static_cast<double>(x) / n) * alpona.width()));
            const int sx1 = std::max(
                sx0 + 1,
                static_cast<int>(std::floor((static_cast<double>(x + 1) / n) * alpona.width())));
            double sr = 0.0, sg = 0.0, sb = 0.0;
            int cnt = 0;
            for (int sy = sy0; sy < sy1 && sy < alpona.height(); ++sy) {
                for (int sx = sx0; sx < sx1 && sx < alpona.width(); ++sx) {
                    const Color px = alpona.getPixel(sx, sy);
                    sr += px.r;
                    sg += px.g;
                    sb += px.b;
                    cnt++;
                }
            }
            const size_t idx = static_cast<size_t>(y * n + x);
            const double inv = (cnt > 0) ? (1.0 / cnt) : 1.0;
            rBuf[idx] = sr * inv;
            gBuf[idx] = sg * inv;
            bBuf[idx] = sb * inv;
        }
    }

    // Step 2: Build thread palette
    std::vector<Color> paletteColors;
    std::vector<std::string> paletteNames;
    if (options.palettePreset == WeavePalettePreset::AlponaSource) {
        const std::vector<Color> km = extractKMeansPalette(alpona, maxColors);
        for (size_t i = 0; i < km.size(); ++i) {
            paletteColors.push_back(km[i]);
            std::ostringstream oss;
            oss << "Thread #" << (i + 1);
            paletteNames.push_back(oss.str());
        }
    } else {
        const ThreadPresetEntry* table = kJamdaniZari;
        if (options.palettePreset == WeavePalettePreset::NakshiKantha) {
            table = kNakshiKantha;
        } else if (options.palettePreset == WeavePalettePreset::DmcHeritage) {
            table = kDmcHeritage;
        }
        for (int i = 0; i < maxColors; ++i) {
            paletteColors.push_back(table[i].color);
            paletteNames.push_back(table[i].name);
        }
    }

    // Step 3: Quantize & dither
    std::vector<uint8_t> cells(static_cast<size_t>(n * n), 0);
    std::vector<int> counts(paletteColors.size(), 0);

    for (int y = 0; y < n; ++y) {
        for (int x = 0; x < n; ++x) {
            const size_t idx = static_cast<size_t>(y * n + x);
            double r = rBuf[idx];
            double g = gBuf[idx];
            double b = bBuf[idx];

            if (options.ditherMode == WeaveDitherMode::Bayer4x4) {
                const int bVal = kBayerRaw[(y & 3) * 4 + (x & 3)];
                const double bias = ((bVal + 0.5) / 16.0 - 0.5) * 52.0;
                r = clampChannel(r + bias);
                g = clampChannel(g + bias);
                b = clampChannel(b + bias);
            }

            const int bestIdx = findNearestColorIdx(r, g, b, paletteColors);
            cells[idx] = static_cast<uint8_t>(bestIdx);
            counts[static_cast<size_t>(bestIdx)]++;

            if (options.ditherMode == WeaveDitherMode::FloydSteinberg) {
                const double er = r - static_cast<double>(paletteColors[static_cast<size_t>(bestIdx)].r);
                const double eg = g - static_cast<double>(paletteColors[static_cast<size_t>(bestIdx)].g);
                const double eb = b - static_cast<double>(paletteColors[static_cast<size_t>(bestIdx)].b);
                auto distribute = [&](int nx, int ny, double w) {
                    if (nx < 0 || nx >= n || ny < 0 || ny >= n) return;
                    const size_t nIdx = static_cast<size_t>(ny * n + nx);
                    rBuf[nIdx] = clampChannel(rBuf[nIdx] + er * w);
                    gBuf[nIdx] = clampChannel(gBuf[nIdx] + eg * w);
                    bBuf[nIdx] = clampChannel(bBuf[nIdx] + eb * w);
                };
                distribute(x + 1, y, 7.0 / 16.0);
                distribute(x - 1, y + 1, 3.0 / 16.0);
                distribute(x, y + 1, 5.0 / 16.0);
                distribute(x + 1, y + 1, 1.0 / 16.0);
            }
        }
    }

    const int totalStitches = n * n;
    const int countPerInch = std::max(8, std::min(24, options.clothCountPerInch));
    const double finishedSizeCm =
        std::floor(((static_cast<double>(n) / countPerInch) * 2.54) * 10.0 + 0.5) / 10.0;
    const double cmPerStitch = (2.6 * 14.0) / countPerInch;

    WeaveChartResult result;
    result.gridSize = n;
    result.cells = std::move(cells);
    result.totalStitches = totalStitches;
    result.finishedSizeCm = finishedSizeCm;
    result.ditherMode = options.ditherMode;

    for (size_t i = 0; i < paletteColors.size(); ++i) {
        WeaveThreadStat stat;
        stat.index = static_cast<int>(i);
        stat.color = paletteColors[i];
        stat.hex = colorToHex(paletteColors[i]);
        stat.name = paletteNames[i];
        stat.symbol = kSymbols[i % 8];
        stat.stitchCount = counts[i];
        stat.percent = std::floor(((static_cast<double>(counts[i]) / std::max(1, totalStitches)) * 100.0) * 10.0 + 0.5) / 10.0;
        stat.estimatedThreadMeters = std::floor(((counts[i] * cmPerStitch) / 100.0) * 100.0 + 0.5) / 100.0;
        result.threads.push_back(stat);
    }

    return result;
}

std::string exportWeaveChartCsv(const WeaveChartResult& chart) {
    std::ostringstream oss;
    oss << "# Alpona Studio Jamdani / Nakshi Kantha Weave Chart ("
        << chart.gridSize << "x" << chart.gridSize << ")\n";
    oss << "# Finished size: " << chart.finishedSizeCm << " cm x "
        << chart.finishedSizeCm << " cm\n";
    oss << "# Symbol,Thread Name,Hex,Stitches,Percent,Thread Meters\n";
    for (size_t i = 0; i < chart.threads.size(); ++i) {
        const WeaveThreadStat& t = chart.threads[i];
        oss << "# \"" << t.symbol << "\",\"" << t.name << "\","
            << t.hex << "," << t.stitchCount << "," << t.percent
            << "%," << t.estimatedThreadMeters << "m\n";
    }
    for (int y = 0; y < chart.gridSize; ++y) {
        for (int x = 0; x < chart.gridSize; ++x) {
            if (x > 0) oss << ",";
            const size_t tIdx = chart.cells[static_cast<size_t>(y * chart.gridSize + x)];
            if (tIdx < chart.threads.size()) {
                oss << chart.threads[tIdx].symbol;
            } else {
                oss << ".";
            }
        }
        oss << "\n";
    }
    return oss.str();
}

} // namespace alpona
