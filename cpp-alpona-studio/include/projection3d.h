#ifndef ALPONA_PROJECTION3D_H
#define ALPONA_PROJECTION3D_H

#include "canvas_buffer.h"
#include <vector>

namespace alpona {

enum class ProjectionMode {
    Perspective,
    Parallel
};

enum class HiddenSurfaceMode {
    Wireframe,
    Painters,
    ZBuffer,
    DepthMap
};

struct Vec3 {
    double x;
    double y;
    double z;
};

struct Triangle3D {
    Vec3 v0;
    Vec3 v1;
    Vec3 v2;
    Color color;
};

struct Transform3DParams {
    double rotXDeg;
    double rotYDeg;
    double rotZDeg;
    double scale;
    double translateX;
    double translateY;
    double focalLength;
    ProjectionMode projection;
    HiddenSurfaceMode hsrMode;
    bool allowCopAnomaly;

    Transform3DParams()
        : rotXDeg(28.0),
          rotYDeg(35.0),
          rotZDeg(0.0),
          scale(1.0),
          translateX(0.0),
          translateY(0.0),
          focalLength(3.2),
          projection(ProjectionMode::Perspective),
          hsrMode(HiddenSurfaceMode::ZBuffer),
          allowCopAnomaly(false) {}
};

struct Render3DStats {
    int triangles;
    int pixelsShaded;
    int zBufferRejects;
    int anomalyVerticesCount;
};

Vec3 transformVertex3D(Vec3 v, const Transform3DParams& params);
Vec3 projectPoint3D(Vec3 p, int width, int height, const Transform3DParams& params);
std::vector<Triangle3D> buildAlponaMonumentMesh(int sectors);

Render3DStats render3DScene(
    CanvasBuffer& buffer,
    const std::vector<Triangle3D>& mesh,
    const Transform3DParams& params,
    Color bg = {20, 20, 24, 255}
);

Render3DStats render3DCourtyardFloor(
    CanvasBuffer& buffer,
    const CanvasBuffer& alponaTexture,
    const Transform3DParams& params,
    Color bg = {20, 20, 24, 255}
);

} // namespace alpona

#endif // ALPONA_PROJECTION3D_H
