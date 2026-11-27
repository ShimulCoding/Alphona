#include "team_planner.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iomanip>
#include <sstream>

// Team Floor Planner (C++11 twin of src/graphics/teamPlanner.ts): splits a large alpona
// into team sections ('sectors' = pie slices clockwise from 12 o'clock, 'strips' = bands
// from the top) and estimates painted area and paint per colour from the rendered pixels.

namespace alpona {

namespace {

struct Swatch {
    const char* name;
    const char* hex;
    Color rgb;
};

// Same order and colours as ALPONA_PALETTE in src/graphics/types.ts.
const Swatch kPalette[] = {
    {"Rice Paste", "#FAF8F2", {250, 248, 242, 255}},
    {"Sindoor Red", "#DC2626", {220, 38, 38, 255}},
    {"Turmeric Gold", "#F59E0B", {245, 158, 11, 255}},
    {"Alta Rose", "#E11D48", {225, 29, 72, 255}},
    {"Marigold", "#EA580C", {234, 88, 12, 255}},
    {"Pata Green", "#16A34A", {22, 163, 74, 255}},
    {"Neel Indigo", "#2563EB", {37, 99, 235, 255}},
    {"Kajal Ink", "#18181B", {24, 24, 27, 255}},
};
const int kPaletteSize = static_cast<int>(sizeof(kPalette) / sizeof(kPalette[0]));
const int kBackgroundTolerance = 24;
const double kPi = 3.14159265358979323846;

double round4(double v) { return std::round(v * 10000.0) / 10000.0; }

int clampTeams(int teams) { return std::max(1, std::min(24, teams)); }

int colorDistance(Color a, Color b) {
    return std::abs(a.r - b.r) + std::abs(a.g - b.g) + std::abs(a.b - b.b);
}

} // namespace

int teamIndexForPixel(int x, int y, int width, int height, int teams, TeamSplitMode mode) {
    const int n = clampTeams(teams);
    if (mode == TeamSplitMode::Strips) {
        return std::min(n - 1, static_cast<int>(std::floor((y + 0.5) / height * n)));
    }
    const double dx = x + 0.5 - width / 2.0;
    const double dy = y + 0.5 - height / 2.0;
    double angle = std::atan2(dx, -dy);  // 0 at 12 o'clock, growing clockwise
    if (angle < 0) angle += 2.0 * kPi;
    return std::min(n - 1, static_cast<int>(std::floor(angle / (2.0 * kPi / n))));
}

TeamPlan computeTeamPlan(const CanvasBuffer& surface, Color background, const TeamPlanConfig& config) {
    TeamPlan plan;
    const int teams = clampTeams(config.teams);
    plan.mode = config.mode;
    plan.diameterCm = std::max(40.0, std::min(600.0, config.diameterCm));
    plan.paintMlPerSqM = std::max(1.0, config.paintMlPerSqM);
    const int width = surface.width();
    const int height = surface.height();
    const double pixelSqM =
        (plan.diameterCm / 100.0) * (plan.diameterCm / 100.0) / (static_cast<double>(width) * height);

    std::vector<std::vector<long>> counts(teams, std::vector<long>(kPaletteSize, 0));
    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            const Color c = surface.getPixel(x, y);
            if (colorDistance(c, background) < kBackgroundTolerance) continue;
            int best = 0;
            int bestDist = 1 << 30;
            for (int s = 0; s < kPaletteSize; ++s) {
                const int d = colorDistance(c, kPalette[s].rgb);
                if (d < bestDist) {
                    bestDist = d;
                    best = s;
                }
            }
            ++counts[teamIndexForPixel(x, y, width, height, teams, config.mode)][best];
        }
    }

    for (int t = 0; t < teams; ++t) {
        TeamSection section;
        section.team = t + 1;
        section.label = "Team " + std::to_string(t + 1);
        std::vector<int> order;
        long painted = 0;
        for (int s = 0; s < kPaletteSize; ++s) {
            painted += counts[t][s];
            if (counts[t][s] > 0) order.push_back(s);
        }
        std::stable_sort(order.begin(), order.end(), [&](int a, int b) {
            return counts[t][a] > counts[t][b];
        });
        for (size_t k = 0; k < order.size(); ++k) {
            TeamPigment p;
            p.name = kPalette[order[k]].name;
            p.hex = kPalette[order[k]].hex;
            p.areaSqM = round4(counts[t][order[k]] * pixelSqM);
            p.paintMl = static_cast<int>(std::round(p.areaSqM * plan.paintMlPerSqM));
            section.paintMl += p.paintMl;
            section.pigments.push_back(p);
        }
        section.areaSqM = round4(painted * pixelSqM);
        if (config.mode == TeamSplitMode::Sectors) {
            section.startDeg = round4(360.0 * t / teams);
            section.endDeg = round4(360.0 * (t + 1) / teams);
        } else {
            section.startCm = round4(plan.diameterCm * t / teams);
            section.endCm = round4(plan.diameterCm * (t + 1) / teams);
        }
        plan.totalAreaSqM += section.areaSqM;
        plan.totalPaintMl += section.paintMl;
        plan.teams.push_back(section);
    }
    plan.totalAreaSqM = round4(plan.totalAreaSqM);
    return plan;
}

std::string exportTeamPlanCsv(const TeamPlan& plan) {
    std::ostringstream csv;
    csv << "team,colour,area_m2,paint_ml\n" << std::fixed << std::setprecision(4);
    for (size_t t = 0; t < plan.teams.size(); ++t) {
        const TeamSection& s = plan.teams[t];
        for (size_t k = 0; k < s.pigments.size(); ++k) {
            csv << s.label << "," << s.pigments[k].name << "," << s.pigments[k].areaSqM << ","
                << s.pigments[k].paintMl << "\n";
        }
        csv << s.label << ",All colours," << s.areaSqM << "," << s.paintMl << "\n";
    }
    csv << "Total,," << plan.totalAreaSqM << "," << plan.totalPaintMl << "\n";
    return csv.str();
}

} // namespace alpona
