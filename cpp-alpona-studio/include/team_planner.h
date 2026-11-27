#ifndef ALPONA_TEAM_PLANNER_H
#define ALPONA_TEAM_PLANNER_H

#include "canvas_buffer.h"

#include <string>
#include <vector>

namespace alpona {

enum class TeamSplitMode { Sectors, Strips };

struct TeamPlanConfig {
    double diameterCm = 300.0;
    int teams = 6;
    TeamSplitMode mode = TeamSplitMode::Sectors;
    double paintMlPerSqM = 175.0;
};

struct TeamPigment {
    std::string name;
    std::string hex;
    double areaSqM = 0.0;
    int paintMl = 0;
};

struct TeamSection {
    int team = 0;
    std::string label;
    double areaSqM = 0.0;
    int paintMl = 0;
    std::vector<TeamPigment> pigments;
    double startDeg = 0.0, endDeg = 0.0;
    double startCm = 0.0, endCm = 0.0;
};

struct TeamPlan {
    TeamSplitMode mode = TeamSplitMode::Sectors;
    double diameterCm = 0.0;
    double paintMlPerSqM = 175.0;
    std::vector<TeamSection> teams;
    double totalAreaSqM = 0.0;
    int totalPaintMl = 0;
};

int teamIndexForPixel(int, int, int, int, int, TeamSplitMode);
TeamPlan computeTeamPlan(const CanvasBuffer&, Color, const TeamPlanConfig&);
std::string exportTeamPlanCsv(const TeamPlan&);

} // namespace alpona

#endif // ALPONA_TEAM_PLANNER_H
