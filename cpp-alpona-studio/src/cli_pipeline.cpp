/**
 * AlponaCLI — Standalone Zero-OpenGL C++11 Headless Maker & Graphics Pipeline
 * Alpona Studio v1.4.2 — Enterprise 2D/3D Vector & Raster Core
 *
 * Exposes all Alpona Studio C++11 modules from the command line without requiring
 * a GLUT/X11 window:
 *   - Starter Bengali motifs (Padma Lotus, Boishakhi Sun, Kalka Rosette, Courtyard Chowk)
 *   - Procedural Lata-Pata L-System + Phyllotaxis + Rhodonea generator
 *   - Pure C++11 PNG export, Vector SVG export, Watertight Binary 3D .STL Pitha Mold / Woodblock export,
 *     Jamdani/Nakshi Kantha Weave CSV chart, Frieze Border strip, Auto-Bridged Stencil PNG,
 *     and Natural Media Chaler Guro finish PNG.
 */

#include "frieze_border.h"
#include "generative_composer.h"
#include "kolam_composer.h"
#include "team_planner.h"
#include "motifs.h"
#include "natural_media.h"
#include "png_writer.h"
#include "stencil_bridger.h"
#include "stl_stamp.h"
#include "svg_writer.h"
#include "transforms.h"
#include "weave_chart.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

using namespace alpona;

namespace {

void writeOpsToSvg(
    const std::vector<DrawOperation>& ops,
    int canvasSize,
    Color bgColor,
    const std::string& path
) {
    const std::string svg = buildOperationsSvg(ops, canvasSize, bgColor);
    std::ofstream ofs(path.c_str(), std::ios::binary);
    if (ofs.is_open() && (ofs << svg)) {
        std::cout << "[AlponaCLI] Exported Vector SVG -> " << path << "\n";
    } else {
        std::cerr << "[AlponaCLI] ERROR: Could not write SVG to " << path << "\n";
    }
}

void printUsage() {
    std::cout
        << "AlponaCLI (Alpona Studio v1.4.2 Headless Pipeline)\n"
        << "Usage:\n"
        << "  AlponaCLI [options]\n\n"
        << "Input Source:\n"
        << "  --motif <padma|boishakhi|kalka|chowk>  Load a starter Bengali Alpona motif (default: padma)\n"
        << "  --procedural <seed>                    Generate Procedural Lata-Pata + Phyllotaxis Alpona\n"
        << "  --sectors <4..16>                      Symmetry sector count for procedural mode (default: 8)\n"
        << "  --size <px>                            Canvas resolution in px (default: 512)\n"
        << "  --kolam <rows>x<cols>                  Draw a pulli dot-grid kolam, e.g. --kolam 7x7 (2..12 dots)\n"
        << "  --kolam-symmetry <none|mirror|rotational>  Kolam mirror layout symmetry (default: mirror)\n"
        << "  --kolam-density <0..1>                 Share of inner edges with a mirror (default: 0.35)\n"
        << "  --kolam-seed <n>                       Kolam seed; searches n, n+1, ... for one stroke (default: 7)\n"
        << "  --kolam-loops                          Keep the seed as is (allow several loops)\n\n"
        << "Exporters:\n"
        << "  --export-png <file.png>                Export software-rasterized RGBA PNG\n"
        << "  --export-svg <file.svg>                Export precision vector SVG\n"
        << "  --export-stl <file.stl>                Export watertight binary 3D .STL stamp/mold\n"
        << "  --mode <woodblock|pitha|coaster>       3D .STL preset mode (default: pitha)\n"
        << "  --export-weave <file.csv>              Export Jamdani/Nakshi Kantha weave chart CSV\n"
        << "  --export-frieze <file.png>             Export p2mm Frieze Saree Paar border strip PNG\n"
        << "  --export-stencil <file.png>            Export BFS Auto-Bridged Floor Stencil PNG\n"
        << "  --export-natural <file.png>            Export Natural Media Chaler Guro finish PNG\n"
        << "  --export-team-plan <file.csv>          Team floor plan: area & paint per team and colour\n"
        << "  --team-plan <1..24>                    Number of teams for --export-team-plan (default: 6)\n"
        << "  --team-mode <sectors|strips>           Split into pie slices or top-to-bottom strips\n"
        << "  --floor-cm <40..600>                   Real width of the design on the floor (default: 300)\n"
        << "  --help                                 Show this help message\n";
}

} // namespace

int main(int argc, char** argv) {
    std::string motifName = "padma";
    bool useProcedural = false;
    bool useKolam = false;
    KolamConfig kolamCfg;
    uint32_t procSeed = 2026;
    int sectors = 8;
    int canvasSize = 512;

    std::string pngPath;
    std::string svgPath;
    std::string stlPath;
    std::string stlModeStr = "pitha";
    std::string weavePath;
    std::string friezePath;
    std::string stencilPath;
    std::string naturalPath;
    std::string teamPlanPath;
    TeamPlanConfig teamCfg;

    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--help" || arg == "-h") {
            printUsage();
            return 0;
        } else if (arg == "--motif" && i + 1 < argc) {
            motifName = argv[++i];
            useProcedural = false;
        } else if (arg == "--procedural" && i + 1 < argc) {
            useProcedural = true;
            procSeed = static_cast<uint32_t>(std::strtoul(argv[++i], nullptr, 10));
        } else if (arg == "--kolam" && i + 1 < argc) {
            useKolam = true;
            useProcedural = false;
            const std::string dims = argv[++i];
            const size_t xPos = dims.find_first_of("xX");
            const int rows = std::atoi(dims.substr(0, xPos).c_str());
            const int cols = xPos == std::string::npos ? rows : std::atoi(dims.substr(xPos + 1).c_str());
            kolamCfg.rows = clampKolamDots(rows);
            kolamCfg.cols = clampKolamDots(cols);
        } else if (arg == "--kolam-symmetry" && i + 1 < argc) {
            const std::string sym = argv[++i];
            kolamCfg.symmetry = sym == "none" ? KolamSymmetry::None
                              : sym == "rotational" ? KolamSymmetry::Rotational
                              : KolamSymmetry::Mirror;
        } else if (arg == "--kolam-density" && i + 1 < argc) {
            kolamCfg.mirrorDensity = std::atof(argv[++i]);
        } else if (arg == "--kolam-seed" && i + 1 < argc) {
            kolamCfg.seed = static_cast<uint32_t>(std::strtoul(argv[++i], nullptr, 10));
        } else if (arg == "--kolam-loops") {
            kolamCfg.requireSingleLoop = false;
        } else if (arg == "--sectors" && i + 1 < argc) {
            sectors = std::atoi(argv[++i]);
            if (sectors < 4) sectors = 4;
            if (sectors > 16) sectors = 16;
        } else if (arg == "--size" && i + 1 < argc) {
            canvasSize = std::atoi(argv[++i]);
            if (canvasSize < 128) canvasSize = 128;
            if (canvasSize > 2048) canvasSize = 2048;
        } else if (arg == "--export-png" && i + 1 < argc) {
            pngPath = argv[++i];
        } else if (arg == "--export-svg" && i + 1 < argc) {
            svgPath = argv[++i];
        } else if (arg == "--export-stl" && i + 1 < argc) {
            stlPath = argv[++i];
        } else if (arg == "--mode" && i + 1 < argc) {
            stlModeStr = argv[++i];
        } else if (arg == "--export-weave" && i + 1 < argc) {
            weavePath = argv[++i];
        } else if (arg == "--export-frieze" && i + 1 < argc) {
            friezePath = argv[++i];
        } else if (arg == "--export-stencil" && i + 1 < argc) {
            stencilPath = argv[++i];
        } else if (arg == "--export-team-plan" && i + 1 < argc) {
            teamPlanPath = argv[++i];
        } else if (arg == "--team-plan" && i + 1 < argc) {
            teamCfg.teams = std::atoi(argv[++i]);
        } else if (arg == "--team-mode" && i + 1 < argc) {
            teamCfg.mode = std::string(argv[++i]) == "strips" ? TeamSplitMode::Strips : TeamSplitMode::Sectors;
        } else if (arg == "--floor-cm" && i + 1 < argc) {
            teamCfg.diameterCm = std::atof(argv[++i]);
        } else if (arg == "--export-natural" && i + 1 < argc) {
            naturalPath = argv[++i];
        }
    }

    Color bgColor = {22, 22, 27, 255};
    CanvasBuffer surface(canvasSize, canvasSize);
    std::vector<DrawOperation> ops;

    if (useKolam) {
        surface.clear(bgColor);
        KolamComposeResult kolam = composeKolam(canvasSize, kolamCfg);
        ops = buildKolamDrawOperations(
            kolam, Color{248, 244, 236, 255}, Color{245, 158, 11, 255},
            std::max(2, canvasSize / 240));
        for (size_t i = 0; i < ops.size(); ++i) {
            executeOperation(surface, ops[i]);
        }
        std::cout << "[AlponaCLI] Drew " << kolam.rows << "x" << kolam.cols
                  << " pulli kolam (" << kolam.loopCount
                  << (kolam.loopCount == 1 ? " loop = one stroke" : " loops")
                  << ", " << kolam.segmentCount << " segments, "
                  << kolam.innerMirrorCount << " mirrors, seed=" << kolam.seedUsed << ")\n";
    } else if (useProcedural) {
        surface.clear(bgColor);
        ProceduralAlponaConfig cfg;
        cfg.seed = procSeed;
        cfg.sectors = sectors;
        ProceduralComposeResult proc = composeProceduralAlpona(canvasSize, cfg);
        rasterizeProceduralAlpona(surface, proc);
        std::cout << "[AlponaCLI] Generated Procedural Alpona (seed=" << procSeed
                  << ", sectors=" << sectors
                  << ", phyllotaxis=" << proc.phyllotaxisDots
                  << ", L-system len=" << proc.lSystemAxiomLength << ")\n";
    } else {
        if (motifName == "boishakhi") {
            bgColor = {74, 29, 26, 255};
            ops = buildBoishakhiSunMotif(canvasSize);
        } else if (motifName == "kalka") {
            bgColor = {17, 24, 39, 255};
            ops = buildKalkaRosetteMotif(canvasSize);
        } else if (motifName == "chowk") {
            bgColor = {250, 250, 247, 255};
            ops = buildCourtyardChowkMotif(canvasSize);
        } else {
            bgColor = {22, 22, 27, 255};
            ops = buildPadmaLotusMotif(canvasSize);
        }
        surface.clear(bgColor);
        for (size_t i = 0; i < ops.size(); ++i) {
            executeOperation(surface, ops[i]);
        }
        std::cout << "[AlponaCLI] Rasterized motif '" << motifName << "' ("
                  << ops.size() << " ops @ " << canvasSize << "x" << canvasSize << ")\n";
    }

    if (!pngPath.empty()) {
        if (saveCanvasToPng(surface, pngPath)) {
            std::cout << "[AlponaCLI] Exported PNG -> " << pngPath << "\n";
        } else {
            std::cerr << "[AlponaCLI] ERROR: Could not write PNG to " << pngPath << "\n";
            return 1;
        }
    }

    if (!svgPath.empty()) {
        writeOpsToSvg(ops, canvasSize, bgColor, svgPath);
    }

    if (!stlPath.empty()) {
        StlStampOptions stlOpts;
        if (stlModeStr == "woodblock") {
            stlOpts.mode = StampPresetMode::WoodblockStamp;
            stlOpts.mirrorHorizontal = true;
            stlOpts.includeHandle = true;
        } else if (stlModeStr == "coaster") {
            stlOpts.mode = StampPresetMode::TerracottaCoaster;
            stlOpts.mirrorHorizontal = false;
            stlOpts.includeHandle = false;
        } else {
            stlOpts.mode = StampPresetMode::PithaMold;
            stlOpts.mirrorHorizontal = true;
            stlOpts.includeHandle = false;
        }
        stlOpts.gridSize = 64;
        StampHeightfield hf = buildStampHeightfield(surface, bgColor, stlOpts);
        StampMeshSummary mesh = generateStampMesh(hf, stlOpts);
        std::vector<uint8_t> bytes = serializeBinaryStl(mesh);
        std::ofstream ofs(stlPath.c_str(), std::ios::binary);
        if (!ofs.is_open()) {
            std::cerr << "[AlponaCLI] ERROR: Could not write STL to " << stlPath << "\n";
            return 1;
        }
        ofs.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
        std::cout << "[AlponaCLI] Exported 3D Binary STL (" << stlModeStr << ", "
                  << mesh.triangleCount << " tris, " << bytes.size() << " bytes) -> "
                  << stlPath << "\n";
    }

    if (!teamPlanPath.empty()) {
        const TeamPlan plan = computeTeamPlan(surface, bgColor, teamCfg);
        std::ofstream ofs(teamPlanPath.c_str(), std::ios::binary);
        if (!ofs.is_open()) {
            std::cerr << "[AlponaCLI] ERROR: Could not write team plan to " << teamPlanPath << "\n";
            return 1;
        }
        ofs << exportTeamPlanCsv(plan);
        std::cout << "[AlponaCLI] Team plan: " << plan.teams.size() << " teams ("
                  << (plan.mode == TeamSplitMode::Strips ? "strips" : "sectors") << ") on a "
                  << plan.diameterCm << " cm floor, " << plan.totalAreaSqM << " m2 painted, "
                  << plan.totalPaintMl << " mL paint -> " << teamPlanPath << "\n";
    }

    if (!weavePath.empty()) {
        WeaveChartOptions wOpts;
        wOpts.gridSize = 48;
        wOpts.maxColors = 6;
        WeaveChartResult chart = buildWeaveChart(surface, wOpts);
        std::string csv = exportWeaveChartCsv(chart);
        std::ofstream ofs(weavePath.c_str(), std::ios::binary);
        if (!ofs.is_open()) {
            std::cerr << "[AlponaCLI] ERROR: Could not write Weave CSV to " << weavePath << "\n";
            return 1;
        }
        ofs << csv;
        std::cout << "[AlponaCLI] Exported Weave Chart CSV (" << chart.gridSize << "x"
                  << chart.gridSize << ", " << chart.threads.size() << " threads) -> "
                  << weavePath << "\n";
    }

    if (!friezePath.empty()) {
        CanvasBuffer tile = unwrapAlponaRingToTile(surface, 128, 128, 0.35, 0.92, sectors);
        CanvasBuffer strip = renderFriezeStrip(tile, FriezeGroup::P2MM, 5, true, {245, 158, 11, 255});
        if (saveCanvasToPng(strip, friezePath)) {
            std::cout << "[AlponaCLI] Exported Frieze Border Strip PNG -> " << friezePath << "\n";
        } else {
            std::cerr << "[AlponaCLI] ERROR: Could not write Frieze PNG to " << friezePath << "\n";
            return 1;
        }
    }

    if (!stencilPath.empty()) {
        StencilBridgeAnalysis st = analyzeAndBridgeStencil(surface, 6, true, 44);
        if (saveCanvasToPng(st.bridgedStencil, stencilPath)) {
            std::cout << "[AlponaCLI] Exported Auto-Bridged Stencil PNG (islands "
                      << st.initialIslandCount << " -> " << st.remainingIslandCount
                      << ", bridges=" << st.bridges.size() << ") -> " << stencilPath << "\n";
        } else {
            std::cerr << "[AlponaCLI] ERROR: Could not write Stencil PNG to " << stencilPath << "\n";
            return 1;
        }
    }

    if (!naturalPath.empty()) {
        NaturalMediaOptions nOpts;
        nOpts.substrate = NaturalSubstrateId::MatiMud;
        CanvasBuffer natural = renderNaturalMediaAlpona(surface, bgColor, nOpts);
        if (saveCanvasToPng(natural, naturalPath)) {
            std::cout << "[AlponaCLI] Exported Natural Media Chaler Guro PNG -> " << naturalPath << "\n";
        } else {
            std::cerr << "[AlponaCLI] ERROR: Could not write Natural Media PNG to " << naturalPath << "\n";
            return 1;
        }
    }

    return 0;
}
