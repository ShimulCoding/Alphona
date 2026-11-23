#ifndef ALPONA_PHONG_LIGHTING_H
#define ALPONA_PHONG_LIGHTING_H

#include "canvas_buffer.h"
#include <vector>

namespace alpona {

enum class DiyaShadingModel {
    Phong,
    Gouraud,
    NormalMap
};

struct DiyaLight {
    double x; // normalized [0..1]
    double y; // normalized [0..1]
    double z; // height above floor
    double r; // flame red [0..1]
    double g; // flame green [0..1]
    double b; // flame blue [0..1]
    double intensity;
};

struct PhongMaterial {
    double ka;
    double kd;
    double ks;
    double shininess;
    double reliefStrength;
    DiyaShadingModel model;
};

struct Vec3d {
    double x;
    double y;
    double z;
};

/**
 * Computes surface normal N = normalize(-gx*relief, -gy*relief, 1) from
 * a 3x3 Sobel gradient of the chalk/rice-paste relief heightfield.
 */
Vec3d computeReliefNormalAt(
    const std::vector<double>& heightfield,
    int width,
    int height,
    int x,
    int y,
    double reliefStrength
);

/**
 * Renders an Alpona CanvasBuffer under CSE 401 Phong / Gouraud Night-Courtyard
 * Diya Illumination (or Sobel Relief Normal Map).
 */
CanvasBuffer renderPhongDiyaLighting(
    const CanvasBuffer& alpona,
    Color background,
    const std::vector<DiyaLight>& lights,
    const PhongMaterial& material
);

} // namespace alpona

#endif // ALPONA_PHONG_LIGHTING_H
