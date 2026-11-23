#include "stencil_bridger.h"
#include "image_processing.h"
#include <algorithm>
#include <cmath>
#include <limits>
#include <vector>

namespace alpona {

namespace {

struct ComponentResult {
    std::vector<int> labels;
    std::vector<uint8_t> anchored;
    std::vector<int> islandIds;
    int componentCount;
};

ComponentResult labelMaterialComponents(
    const std::vector<uint8_t>& mask,
    int width,
    int height
) {
    const int total = width * height;
    ComponentResult res;
    res.labels.assign(static_cast<size_t>(total), 0);
    res.componentCount = 0;

    std::vector<int> queue(static_cast<size_t>(total), 0);
    std::vector<uint8_t> anchoredList;
    anchoredList.push_back(0);  // 1-indexed

    const int dx[8] = {-1, 0, 1, -1, 1, -1, 0, 1};
    const int dy[8] = {-1, -1, -1, 0, 0, 1, 1, 1};

    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            const int idx = y * width + x;
            if (mask[static_cast<size_t>(idx)] == 0 || res.labels[static_cast<size_t>(idx)] != 0) {
                continue;
            }
            res.componentCount++;
            const int cid = res.componentCount;
            bool touchesBorder = false;
            int head = 0;
            int tail = 0;
            queue[static_cast<size_t>(tail++)] = idx;
            res.labels[static_cast<size_t>(idx)] = cid;

            while (head < tail) {
                const int cur = queue[static_cast<size_t>(head++)];
                const int cx = cur % width;
                const int cy = cur / width;
                if (cx == 0 || cy == 0 || cx == width - 1 || cy == height - 1) {
                    touchesBorder = true;
                }
                for (int k = 0; k < 8; ++k) {
                    const int nx = cx + dx[k];
                    const int ny = cy + dy[k];
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    const int nIdx = ny * width + nx;
                    if (mask[static_cast<size_t>(nIdx)] == 1 &&
                        res.labels[static_cast<size_t>(nIdx)] == 0) {
                        res.labels[static_cast<size_t>(nIdx)] = cid;
                        queue[static_cast<size_t>(tail++)] = nIdx;
                    }
                }
            }
            anchoredList.push_back(touchesBorder ? 1 : 0);
        }
    }

    res.anchored = anchoredList;
    for (int id = 1; id <= res.componentCount; ++id) {
        if (res.anchored[static_cast<size_t>(id)] == 0) {
            res.islandIds.push_back(id);
        }
    }
    return res;
}

void carveBridge(
    std::vector<uint8_t>& mask,
    std::vector<uint8_t>& bridgeMask,
    int width,
    int height,
    int x0,
    int y0,
    int x1,
    int y1,
    int bridgeWidth
) {
    const int half = std::max(1, bridgeWidth / 2);
    const double len = std::hypot(static_cast<double>(x1 - x0), static_cast<double>(y1 - y0));
    const int steps = std::max(1, static_cast<int>(std::ceil(len * 1.5)));
    for (int s = 0; s <= steps; ++s) {
        const double t = static_cast<double>(s) / static_cast<double>(steps);
        const int cx = static_cast<int>(std::round(x0 + (x1 - x0) * t));
        const int cy = static_cast<int>(std::round(y0 + (y1 - y0) * t));
        for (int dy = -half; dy <= half; ++dy) {
            for (int dx = -half; dx <= half; ++dx) {
                if (dx * dx + dy * dy > half * half + 1) continue;
                const int px = cx + dx;
                const int py = cy + dy;
                if (px >= 0 && px < width && py >= 0 && py < height) {
                    const size_t idx = static_cast<size_t>(py * width + px);
                    mask[idx] = 1;
                    bridgeMask[idx] = 1;
                }
            }
        }
    }
}

}  // namespace

StencilBridgeAnalysis analyzeAndBridgeStencil(
    const CanvasBuffer& sourceAlpona,
    int bridgeWidthPx,
    bool symmetricDualBridge,
    int threshold
) {
    const CanvasBuffer stencil = extractPrintableStencil(sourceAlpona, threshold);
    const int width = stencil.width();
    const int height = stencil.height();
    const int total = width * height;

    std::vector<uint8_t> initialMask(static_cast<size_t>(total), 0);
    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            const Color c = stencil.getPixel(x, y);
            const double lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
            initialMask[static_cast<size_t>(y * width + x)] = (lum >= 145.0) ? 1 : 0;
        }
    }

    const ComponentResult rawComp = labelMaterialComponents(initialMask, width, height);
    if (!rawComp.islandIds.empty()) {
        std::vector<int> areas(static_cast<size_t>(rawComp.componentCount + 1), 0);
        for (int i = 0; i < total; ++i) {
            const int id = rawComp.labels[static_cast<size_t>(i)];
            if (id > 0) areas[static_cast<size_t>(id)]++;
        }
        for (int i = 0; i < total; ++i) {
            const int id = rawComp.labels[static_cast<size_t>(i)];
            if (id > 0 &&
                rawComp.anchored[static_cast<size_t>(id)] == 0 &&
                areas[static_cast<size_t>(id)] < 10) {
                initialMask[static_cast<size_t>(i)] = 0;
            }
        }
    }

    const ComponentResult initialComp = labelMaterialComponents(initialMask, width, height);
    std::vector<uint8_t> bridgedMask = initialMask;
    std::vector<uint8_t> bridgePixels(static_cast<size_t>(total), 0);

    StencilBridgeAnalysis out(width, height);
    out.initialIslandCount = static_cast<int>(initialComp.islandIds.size());

    const int safeBridgeW = std::max(3, std::min(16, bridgeWidthPx));
    const double halfW = static_cast<double>(width) * 0.5;
    const double halfH = static_cast<double>(height) * 0.5;
    const int dirs[8][2] = {
        {-1, 0}, {1, 0}, {0, -1}, {0, 1},
        {-1, -1}, {1, -1}, {-1, 1}, {1, 1}
    };

    for (int pass = 0; pass < 32; ++pass) {
        const ComponentResult comp = labelMaterialComponents(bridgedMask, width, height);
        if (comp.islandIds.empty()) break;

        std::vector<int> dist(static_cast<size_t>(total), -1);
        std::vector<int> nearestAnchor(static_cast<size_t>(total), -1);
        std::vector<int> q(static_cast<size_t>(total), 0);
        int head = 0;
        int tail = 0;

        for (int i = 0; i < total; ++i) {
            const int id = comp.labels[static_cast<size_t>(i)];
            if (id > 0 && comp.anchored[static_cast<size_t>(id)] == 1) {
                dist[static_cast<size_t>(i)] = 0;
                nearestAnchor[static_cast<size_t>(i)] = i;
                q[static_cast<size_t>(tail++)] = i;
            }
        }

        const int kInf = std::numeric_limits<int>::max();
        std::vector<int> bestIslandIdx(static_cast<size_t>(comp.componentCount + 1), -1);
        std::vector<int> bestAnchorIdx(static_cast<size_t>(comp.componentCount + 1), -1);
        std::vector<int> bestDist(static_cast<size_t>(comp.componentCount + 1), kInf);

        while (head < tail) {
            const int cur = q[static_cast<size_t>(head++)];
            const int curD = dist[static_cast<size_t>(cur)];
            const int cx = cur % width;
            const int cy = cur / width;
            const int anc = nearestAnchor[static_cast<size_t>(cur)];

            for (int d = 0; d < 8; ++d) {
                const int nx = cx + dirs[d][0];
                const int ny = cy + dirs[d][1];
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                const int nIdx = ny * width + nx;
                const int nComp = comp.labels[static_cast<size_t>(nIdx)];
                if (nComp > 0 && comp.anchored[static_cast<size_t>(nComp)] == 0) {
                    const int ax = anc % width;
                    const int ay = anc / width;
                    const int dSq = (nx - ax) * (nx - ax) + (ny - ay) * (ny - ay);
                    if (dSq < bestDist[static_cast<size_t>(nComp)]) {
                        bestDist[static_cast<size_t>(nComp)] = dSq;
                        bestIslandIdx[static_cast<size_t>(nComp)] = nIdx;
                        bestAnchorIdx[static_cast<size_t>(nComp)] = anc;
                    }
                    continue;
                }
                if (bridgedMask[static_cast<size_t>(nIdx)] == 0 &&
                    dist[static_cast<size_t>(nIdx)] == -1) {
                    dist[static_cast<size_t>(nIdx)] = curD + 1;
                    nearestAnchor[static_cast<size_t>(nIdx)] = anc;
                    q[static_cast<size_t>(tail++)] = nIdx;
                }
            }
        }

        bool carvedAny = false;
        for (size_t k = 0; k < comp.islandIds.size(); ++k) {
            const int islId = comp.islandIds[k];
            if (bestDist[static_cast<size_t>(islId)] == kInf) continue;
            const int iIdx = bestIslandIdx[static_cast<size_t>(islId)];
            const int aIdx = bestAnchorIdx[static_cast<size_t>(islId)];
            const int ix = iIdx % width;
            const int iy = iIdx / width;
            const int ax = aIdx % width;
            const int ay = aIdx / width;

            carveBridge(bridgedMask, bridgePixels, width, height, ix, iy, ax, ay, safeBridgeW);
            out.bridges.push_back({
                islId,
                ix,
                iy,
                ax,
                ay,
                std::hypot(static_cast<double>(ix - ax), static_cast<double>(iy - ay)),
                safeBridgeW
            });
            carvedAny = true;

            if (symmetricDualBridge) {
                const int mx0 = std::max(0, std::min(width - 1, static_cast<int>(std::round(2.0 * halfW - ix))));
                const int my0 = std::max(0, std::min(height - 1, static_cast<int>(std::round(2.0 * halfH - iy))));
                const int mx1 = std::max(0, std::min(width - 1, static_cast<int>(std::round(2.0 * halfW - ax))));
                const int my1 = std::max(0, std::min(height - 1, static_cast<int>(std::round(2.0 * halfH - ay))));
                if (std::hypot(static_cast<double>(mx0 - ix), static_cast<double>(my0 - iy)) > safeBridgeW * 2.0) {
                    carveBridge(bridgedMask, bridgePixels, width, height, mx0, my0, mx1, my1, safeBridgeW);
                }
            }
        }
        if (!carvedAny) break;
    }

    const ComponentResult finalComp = labelMaterialComponents(bridgedMask, width, height);
    out.remainingIslandCount = static_cast<int>(finalComp.islandIds.size());

    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            const size_t idx = static_cast<size_t>(y * width + x);
            const uint8_t bw = bridgedMask[idx] == 1 ? 250 : 20;
            out.bridgedStencil.setPixel(x, y, {bw, bw, bw, 255});

            const int origId = initialComp.labels[idx];
            const bool wasIsland = (origId > 0 && initialComp.anchored[static_cast<size_t>(origId)] == 0);
            if (bridgePixels[idx] == 1) {
                out.diagnosticView.setPixel(x, y, {16, 185, 129, 255});
            } else if (wasIsland) {
                out.diagnosticView.setPixel(x, y, {220, 38, 38, 255});
            } else if (initialMask[idx] == 1) {
                out.diagnosticView.setPixel(x, y, {248, 247, 243, 255});
            } else {
                out.diagnosticView.setPixel(x, y, {24, 24, 27, 255});
            }
        }
    }

    return out;
}

}  // namespace alpona
