#ifndef ALPONA_STL_STAMP_H
#define ALPONA_STL_STAMP_H

#include "canvas_buffer.h"
#include <cstdint>
#include <string>
#include <vector>

namespace alpona {

enum class StampPresetMode {
    WoodblockStamp,
    PithaMold,
    TerracottaCoaster
};

struct StlStampOptions {
    StampPresetMode mode;
    int gridSize;
    double diameterMm;
    double baseThicknessMm;
    double reliefHeightMm;
    bool mirrorHorizontal;
    bool circularBase;
    bool includeHandle;

    StlStampOptions()
        : mode(StampPresetMode::WoodblockStamp),
          gridSize(80),
          diameterMm(95.0),
          baseThicknessMm(4.5),
          reliefHeightMm(3.2),
          mirrorHorizontal(true),
          circularBase(true),
          includeHandle(true) {}
};

struct StampHeightfield {
    int size;
    std::vector<float> heightsMm;
    std::vector<uint8_t> mask;
    float minZ;
    float maxZ;
    int activeCells;
};

struct StlTriangle {
    float nx, ny, nz;
    float ax, ay, az;
    float bx, by, bz;
    float cx, cy, cz;
};

struct StampMeshSummary {
    std::vector<StlTriangle> triangles;
    size_t triangleCount;
    double widthMm;
    double depthMm;
    double heightMm;
    double estimatedVolumeCm3;
};

StampHeightfield buildStampHeightfield(
    const CanvasBuffer& alpona,
    Color bgColor,
    const StlStampOptions& options);

StampMeshSummary generateStampMesh(
    const StampHeightfield& hf,
    const StlStampOptions& options);

std::vector<uint8_t> serializeBinaryStl(const StampMeshSummary& mesh);
std::string serializeAsciiObj(const StampMeshSummary& mesh);

CanvasBuffer renderStampTurntablePreview(
    const StampHeightfield& hf,
    const StlStampOptions& options,
    double yawDeg,
    double pitchDeg,
    int outW = 480,
    int outH = 380);

} // namespace alpona

#endif // ALPONA_STL_STAMP_H
