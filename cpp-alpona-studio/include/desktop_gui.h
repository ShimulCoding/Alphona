#ifndef ALPONA_DESKTOP_GUI_H
#define ALPONA_DESKTOP_GUI_H

#include "canvas_buffer.h"
#include <string>
#include <vector>

namespace alpona {

struct DesktopGuiLayout {
    int windowWidth = 1000;
    int windowHeight = 796;
    int topBarHeight = 42;
    int leftDockWidth = 260;
    int canvasX = 270;
    int canvasY = 48;
    int canvasSize = 720;
    int statusBarY = 772;
};

enum class DesktopButtonId {
    None = 0,
    // Top Toolbar: Drawing Tools & History & Export
    ToolFreehand,
    ToolLine,
    ToolCircle,
    ToolFill,
    ActionUndo,
    ActionRedo,
    ActionClear,
    ExportPng,
    ExportSvg,
    ExportStl,
    // Left Studio Dock: Quick-Start Templates
    TemplatePadmaLotus,
    TemplateBoishakhiSun,
    TemplateKalkaRosette,
    TemplateBlankCanvas,
    // Left Studio Dock: Pigment Swatches
    PigmentIvory,
    PigmentCrimson,
    PigmentGold,
    PigmentRose,
    PigmentGreen,
    PigmentIndigo,
    // Left Studio Dock: Surface Themes
    SurfaceCourtyard,
    SurfaceTerracotta,
    SurfaceIndigo,
    // Left Studio Dock: Symmetry & Assist
    Sym4,
    Sym6,
    Sym8,
    Sym12,
    SymToggleReflect,
    AssistToggleSnap,
    AssistToggleAxes,
    // Left Studio Dock: Viewport Zoom
    ZoomOut,
    ZoomReset,
    ZoomIn,
    // Left Studio Dock: Multi-View Workspace Modes (2D, Image Lab NPR, 3D Courtyard, Night Diya 3D)
    ViewStudio,
    ViewImageLab,
    View3D,
    ViewDiya
};

enum class DesktopButtonSection {
    TopToolbar,
    QuickTemplates,
    Pigments,
    Surfaces,
    Symmetry,
    Viewport,
    WorkspaceViews
};

struct DesktopGuiButton {
    DesktopButtonId id = DesktopButtonId::None;
    DesktopButtonSection section = DesktopButtonSection::TopToolbar;
    std::string label;
    int x = 0;
    int y = 0;
    int width = 0;
    int height = 0;
    Color swatchColor = {0, 0, 0, 0};
    bool hasSwatch = false;
};

struct DesktopGuiHitResult {
    bool hitGui = false;
    bool hitCanvas = false;
    DesktopButtonId buttonId = DesktopButtonId::None;
    std::string buttonLabel;
    Point2D canvasLocalPoint = {0.0, 0.0};
};

std::vector<DesktopGuiButton> buildDesktopGuiButtons(
    const DesktopGuiLayout& layout = DesktopGuiLayout()
);

bool isPointInsideCanvasStage(
    int mouseX,
    int mouseY,
    const DesktopGuiLayout& layout = DesktopGuiLayout()
);

Point2D windowToCanvasStagePoint(
    int mouseX,
    int mouseY,
    const DesktopGuiLayout& layout = DesktopGuiLayout()
);

DesktopGuiHitResult hitTestDesktopGui(
    int mouseX,
    int mouseY,
    const DesktopGuiLayout& layout = DesktopGuiLayout()
);

enum class DesktopSplashPhase {
    EmblemBloom = 0,
    StageCalibrate,
    RevealFade,
    Complete
};

struct DesktopSplashState {
    DesktopSplashPhase phase = DesktopSplashPhase::EmblemBloom;
    int progressPct = 0;
    double overlayOpacity = 1.0;
    double lotusRotationDeg = 0.0;
    std::string statusLabel;
    bool isComplete = false;
};

DesktopSplashState computeDesktopSplashProgress(
    int elapsedMs,
    int durationMs = 720,
    bool skip = false
);

} // namespace alpona

#endif // ALPONA_DESKTOP_GUI_H
