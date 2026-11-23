#include "colorway_remap.h"
#include <algorithm>
#include <cmath>
#include <limits>
#include <map>

namespace alpona {

namespace {

struct RgbVec {
    double r;
    double g;
    double b;
};

uint8_t clampByte(double v) {
    if (v < 0.0) return 0;
    if (v > 255.0) return 255;
    return static_cast<uint8_t>(std::round(v));
}

uint32_t packRgb(Color c) {
    return (static_cast<uint32_t>(c.r) << 16) |
           (static_cast<uint32_t>(c.g) << 8) |
           static_cast<uint32_t>(c.b);
}

}  // namespace

std::vector<Color> extractKMeansPalette(
    const CanvasBuffer& photo,
    int k,
    int maxIterations
) {
    const int numClusters = std::max(2, std::min(8, k));
    const int totalPixels = photo.width() * photo.height();
    std::vector<RgbVec> samples;
    if (totalPixels > 0) {
        const int stride = std::max(1, totalPixels / 2400);
        for (int i = 0; i < totalPixels; i += stride) {
            const int x = i % photo.width();
            const int y = i / photo.width();
            const Color c = photo.getPixel(x, y);
            if (c.a < 32) continue;
            samples.push_back({static_cast<double>(c.r), static_cast<double>(c.g), static_cast<double>(c.b)});
        }
    }

    if (samples.empty()) {
        std::vector<Color> fallback = {
            {250, 248, 242, 255}, {220, 38, 38, 255}, {245, 158, 11, 255},
            {22, 163, 74, 255}, {37, 99, 235, 255}
        };
        fallback.resize(static_cast<size_t>(std::min<int>(numClusters, static_cast<int>(fallback.size()))));
        return fallback;
    }

    // Deterministic farthest-point seeding
    std::vector<RgbVec> centroids;
    centroids.push_back(samples[0]);
    while (static_cast<int>(centroids.size()) < numClusters) {
        size_t bestIdx = 0;
        double bestDistSq = -1.0;
        for (size_t i = 0; i < samples.size(); ++i) {
            double minD = std::numeric_limits<double>::max();
            for (size_t c = 0; c < centroids.size(); ++c) {
                const double dr = samples[i].r - centroids[c].r;
                const double dg = samples[i].g - centroids[c].g;
                const double db = samples[i].b - centroids[c].b;
                const double dSq = dr * dr + dg * dg + db * db;
                if (dSq < minD) minD = dSq;
            }
            if (minD > bestDistSq) {
                bestDistSq = minD;
                bestIdx = i;
            }
        }
        centroids.push_back(samples[bestIdx]);
    }

    std::vector<int> counts(static_cast<size_t>(numClusters), 0);
    std::vector<double> sumR(static_cast<size_t>(numClusters), 0.0);
    std::vector<double> sumG(static_cast<size_t>(numClusters), 0.0);
    std::vector<double> sumB(static_cast<size_t>(numClusters), 0.0);

    for (int iter = 0; iter < maxIterations; ++iter) {
        std::fill(counts.begin(), counts.end(), 0);
        std::fill(sumR.begin(), sumR.end(), 0.0);
        std::fill(sumG.begin(), sumG.end(), 0.0);
        std::fill(sumB.begin(), sumB.end(), 0.0);

        for (size_t i = 0; i < samples.size(); ++i) {
            int bestC = 0;
            double bestD = std::numeric_limits<double>::max();
            for (int c = 0; c < numClusters; ++c) {
                const double dr = samples[i].r - centroids[static_cast<size_t>(c)].r;
                const double dg = samples[i].g - centroids[static_cast<size_t>(c)].g;
                const double db = samples[i].b - centroids[static_cast<size_t>(c)].b;
                const double dSq = dr * dr + dg * dg + db * db;
                if (dSq < bestD) {
                    bestD = dSq;
                    bestC = c;
                }
            }
            const size_t idx = static_cast<size_t>(bestC);
            counts[idx]++;
            sumR[idx] += samples[i].r;
            sumG[idx] += samples[i].g;
            sumB[idx] += samples[i].b;
        }

        double moved = 0.0;
        for (int c = 0; c < numClusters; ++c) {
            const size_t idx = static_cast<size_t>(c);
            if (counts[idx] == 0) continue;
            const double nr = sumR[idx] / counts[idx];
            const double ng = sumG[idx] / counts[idx];
            const double nb = sumB[idx] / counts[idx];
            moved += std::fabs(nr - centroids[idx].r) +
                     std::fabs(ng - centroids[idx].g) +
                     std::fabs(nb - centroids[idx].b);
            centroids[idx] = {nr, ng, nb};
        }
        if (moved < 1.0) break;
    }

    struct ScoredColor {
        Color color;
        double score;
    };
    std::vector<ScoredColor> ranked;
    for (int c = 0; c < numClusters; ++c) {
        const size_t idx = static_cast<size_t>(c);
        const double maxCh = std::max(centroids[idx].r, std::max(centroids[idx].g, centroids[idx].b));
        const double minCh = std::min(centroids[idx].r, std::min(centroids[idx].g, centroids[idx].b));
        const double chroma = maxCh - minCh;
        const double score = static_cast<double>(counts[idx]) * (1.0 + chroma / 180.0);
        ranked.push_back({
            {clampByte(centroids[idx].r), clampByte(centroids[idx].g), clampByte(centroids[idx].b), 255},
            score
        });
    }

    std::sort(ranked.begin(), ranked.end(), [](const ScoredColor& a, const ScoredColor& b) {
        return a.score > b.score;
    });

    std::vector<Color> palette;
    for (size_t i = 0; i < ranked.size(); ++i) {
        palette.push_back(ranked[i].color);
    }
    return palette;
}

std::vector<Color> remapStrokeColorway(
    const std::vector<Color>& strokeColors,
    const std::vector<Color>& targetPalette
) {
    if (strokeColors.empty() || targetPalette.empty()) return strokeColors;

    std::map<uint32_t, int> freq;
    for (size_t i = 0; i < strokeColors.size(); ++i) {
        freq[packRgb(strokeColors[i])]++;
    }

    std::vector<std::pair<uint32_t, int>> sorted(freq.begin(), freq.end());
    std::sort(sorted.begin(), sorted.end(), [](const std::pair<uint32_t, int>& a, const std::pair<uint32_t, int>& b) {
        if (a.second != b.second) return a.second > b.second;
        return a.first < b.first;
    });

    std::map<uint32_t, Color> mapping;
    for (size_t i = 0; i < sorted.size(); ++i) {
        mapping[sorted[i].first] = targetPalette[i % targetPalette.size()];
    }

    std::vector<Color> remapped;
    remapped.reserve(strokeColors.size());
    for (size_t i = 0; i < strokeColors.size(); ++i) {
        remapped.push_back(mapping[packRgb(strokeColors[i])]);
    }
    return remapped;
}

}  // namespace alpona
