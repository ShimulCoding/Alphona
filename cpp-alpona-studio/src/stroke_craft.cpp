#include "stroke_craft.h"
#include <algorithm>
#include <cmath>

namespace alpona {

namespace {
constexpr double kPi = 3.14159265358979323846;
}  // namespace

std::vector<Point2D> stabilizeStrokePoints(
    const std::vector<Point2D>& points,
    int level
) {
    const int safeLevel = std::max(0, std::min(3, level));
    if (safeLevel == 0 || points.size() < 3) {
        return points;
    }

    // Pass 1: 3-point Gaussian moving average preserving exact endpoints
    std::vector<Point2D> current;
    current.reserve(points.size());
    current.push_back(points.front());
    for (size_t i = 1; i + 1 < points.size(); ++i) {
        current.push_back({
            0.25 * points[i - 1].x + 0.5 * points[i].x + 0.25 * points[i + 1].x,
            0.25 * points[i - 1].y + 0.5 * points[i].y + 0.25 * points[i + 1].y
        });
    }
    current.push_back(points.back());

    // Pass 2: Chaikin Corner-Cutting Subdivision
    for (int iter = 0; iter < safeLevel; ++iter) {
        if (current.size() < 3 || current.size() > 420) break;
        std::vector<Point2D> nextPts;
        nextPts.reserve(current.size() * 2);
        nextPts.push_back(current.front());
        for (size_t i = 0; i + 1 < current.size(); ++i) {
            const Point2D& a = current[i];
            const Point2D& b = current[i + 1];
            nextPts.push_back({0.75 * a.x + 0.25 * b.x, 0.75 * a.y + 0.25 * b.y});
            nextPts.push_back({0.25 * a.x + 0.75 * b.x, 0.25 * a.y + 0.75 * b.y});
        }
        nextPts.push_back(current.back());
        current.swap(nextPts);
    }

    return current;
}

int computeRicePasteTaperThickness(int baseThickness, double u) {
    const double clampedU = std::max(0.0, std::min(1.0, u));
    const double envelope = std::sin(kPi * clampedU);
    const double smoothBell = std::pow(std::max(0.0, envelope), 0.65);
    const double factor = 0.32 + 1.06 * smoothBell;
    return std::max(1, static_cast<int>(std::round(static_cast<double>(baseThickness) * factor)));
}

int computePressureTaperThickness(
    int baseThickness,
    double u,
    double pressure,
    bool applyTaper
) {
    const double p = (pressure > 0.0) ? std::max(0.05, std::min(1.0, pressure)) : 0.5;
    const double pressureScale = 0.325 + 1.35 * p;
    if (!applyTaper) {
        return std::max(
            1,
            static_cast<int>(std::round(static_cast<double>(baseThickness) * pressureScale))
        );
    }
    const double clampedU = std::max(0.0, std::min(1.0, u));
    const double envelope = std::sin(kPi * clampedU);
    const double smoothBell = std::pow(std::max(0.0, envelope), 0.65);
    const double taperFactor = 0.32 + 1.06 * smoothBell;
    return std::max(
        1,
        static_cast<int>(std::round(static_cast<double>(baseThickness) * taperFactor * pressureScale))
    );
}

std::vector<double> computePolylineArcParameters(
    const std::vector<Point2D>& points
) {
    std::vector<double> params;
    if (points.empty()) return params;
    if (points.size() == 1) {
        params.push_back(0.5);
        return params;
    }

    params.reserve(points.size());
    params.push_back(0.0);
    double total = 0.0;
    for (size_t i = 1; i < points.size(); ++i) {
        total += std::hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        params.push_back(total);
    }
    if (total <= 1e-6) {
        for (size_t i = 0; i < points.size(); ++i) {
            params[i] = static_cast<double>(i) / static_cast<double>(points.size() - 1);
        }
        return params;
    }
    for (size_t i = 0; i < params.size(); ++i) {
        params[i] /= total;
    }
    return params;
}

}  // namespace alpona
