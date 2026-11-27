#include "../include/desktop_gui.h"
#include <algorithm>

namespace alpona {

std::vector<DesktopGuiButton> buildDesktopGuiButtons(const DesktopGuiLayout& layout) {
    (void)layout;
    std::vector<DesktopGuiButton> buttons;
    buttons.reserve(33);

    auto addBtn = [&](DesktopButtonId id,
                      DesktopButtonSection section,
                      const std::string& label,
                      int x,
                      int y,
                      int w,
                      int h,
                      bool hasSwatch = false,
                      Color swatch = {0, 0, 0, 0}) {
        DesktopGuiButton b;
        b.id = id;
        b.section = section;
        b.label = label;
        b.x = x;
        b.y = y;
        b.width = w;
        b.height = h;
        b.hasSwatch = hasSwatch;
        b.swatchColor = swatch;
        buttons.push_back(b);
    };

    // 1. Top Toolbar Buttons (y = 7, height = 28)
    const int topY = 7;
    const int topH = 28;
    addBtn(DesktopButtonId::ToolFreehand, DesktopButtonSection::TopToolbar, "Brush", 270, topY, 64, topH);
    addBtn(DesktopButtonId::ToolLine, DesktopButtonSection::TopToolbar, "Line", 340, topY, 58, topH);
    addBtn(DesktopButtonId::ToolCircle, DesktopButtonSection::TopToolbar, "Circle", 404, topY, 64, topH);
    addBtn(DesktopButtonId::ToolFill, DesktopButtonSection::TopToolbar, "Fill", 474, topY, 56, topH);

    addBtn(DesktopButtonId::ActionUndo, DesktopButtonSection::TopToolbar, "Undo", 548, topY, 56, topH);
    addBtn(DesktopButtonId::ActionRedo, DesktopButtonSection::TopToolbar, "Redo", 610, topY, 56, topH);
    addBtn(DesktopButtonId::ActionClear, DesktopButtonSection::TopToolbar, "Clear", 672, topY, 58, topH);

    addBtn(DesktopButtonId::ExportPng, DesktopButtonSection::TopToolbar, "Save PNG", 748, topY, 80, topH);
    addBtn(DesktopButtonId::ExportSvg, DesktopButtonSection::TopToolbar, "Save SVG", 834, topY, 78, topH);
    addBtn(DesktopButtonId::ExportStl, DesktopButtonSection::TopToolbar, "3D STL", 918, topY, 72, topH);

    // 2. Left Studio Dock: Quick-Start Templates (2x2 grid at y = 74..142)
    addBtn(DesktopButtonId::TemplatePadmaLotus, DesktopButtonSection::QuickTemplates, "Padma Lotus", 14, 74, 112, 30);
    addBtn(DesktopButtonId::TemplateBoishakhiSun, DesktopButtonSection::QuickTemplates, "Boishakhi Sun", 134, 74, 112, 30);
    addBtn(DesktopButtonId::TemplateKalkaRosette, DesktopButtonSection::QuickTemplates, "Kalka Rosette", 14, 110, 112, 30);
    addBtn(DesktopButtonId::TemplateBlankCanvas, DesktopButtonSection::QuickTemplates, "Blank Canvas", 134, 110, 112, 30);

    // 3. Left Studio Dock: Traditional Pigment Swatches (3x2 grid at y = 178..246)
    addBtn(DesktopButtonId::PigmentIvory, DesktopButtonSection::Pigments, "Ivory", 14, 178, 72, 30, true, {250, 248, 242, 255});
    addBtn(DesktopButtonId::PigmentCrimson, DesktopButtonSection::Pigments, "Sindoor", 94, 178, 72, 30, true, {220, 38, 38, 255});
    addBtn(DesktopButtonId::PigmentGold, DesktopButtonSection::Pigments, "Turmeric", 174, 178, 72, 30, true, {245, 158, 11, 255});
    addBtn(DesktopButtonId::PigmentRose, DesktopButtonSection::Pigments, "Alta", 14, 214, 72, 30, true, {225, 29, 72, 255});
    addBtn(DesktopButtonId::PigmentGreen, DesktopButtonSection::Pigments, "Pata", 94, 214, 72, 30, true, {22, 163, 74, 255});
    addBtn(DesktopButtonId::PigmentIndigo, DesktopButtonSection::Pigments, "Neel", 174, 214, 72, 30, true, {37, 99, 235, 255});

    // 4. Left Studio Dock: Surface Themes (3 buttons at y = 282..312)
    addBtn(DesktopButtonId::SurfaceCourtyard, DesktopButtonSection::Surfaces, "Courtyard", 14, 282, 72, 30, true, {22, 22, 27, 255});
    addBtn(DesktopButtonId::SurfaceTerracotta, DesktopButtonSection::Surfaces, "Red Clay", 94, 282, 72, 30, true, {124, 45, 18, 255});
    addBtn(DesktopButtonId::SurfaceIndigo, DesktopButtonSection::Surfaces, "Midnight", 174, 282, 72, 30, true, {23, 37, 84, 255});

    // 5. Left Studio Dock: Symmetry & Studio Assist (y = 350..456)
    addBtn(DesktopButtonId::Sym4, DesktopButtonSection::Symmetry, "4x", 14, 350, 52, 30);
    addBtn(DesktopButtonId::Sym6, DesktopButtonSection::Symmetry, "6x", 74, 350, 52, 30);
    addBtn(DesktopButtonId::Sym8, DesktopButtonSection::Symmetry, "8x", 134, 350, 52, 30);
    addBtn(DesktopButtonId::Sym12, DesktopButtonSection::Symmetry, "12x", 194, 350, 52, 30);

    addBtn(DesktopButtonId::SymToggleReflect, DesktopButtonSection::Symmetry, "Mirror (Dn / Cn)", 14, 388, 232, 30);
    addBtn(DesktopButtonId::AssistToggleSnap, DesktopButtonSection::Symmetry, "Magnetic Snap", 14, 426, 112, 30);
    addBtn(DesktopButtonId::AssistToggleAxes, DesktopButtonSection::Symmetry, "Guide Axes", 134, 426, 112, 30);

    // 6. Left Studio Dock: Viewport Zoom (y = 494..524)
    addBtn(DesktopButtonId::ZoomOut, DesktopButtonSection::Viewport, "Zoom -", 14, 494, 72, 30);
    addBtn(DesktopButtonId::ZoomReset, DesktopButtonSection::Viewport, "100%", 94, 494, 72, 30);
    addBtn(DesktopButtonId::ZoomIn, DesktopButtonSection::Viewport, "Zoom +", 174, 494, 72, 30);

    // 7. Left Studio Dock: Live 2D / Image Lab / 3D Workspace Views (2x2 grid at y = 556..620)
    addBtn(DesktopButtonId::ViewStudio, DesktopButtonSection::WorkspaceViews, "2D Studio", 14, 556, 112, 28);
    addBtn(DesktopButtonId::ViewImageLab, DesktopButtonSection::WorkspaceViews, "Image Lab NPR", 134, 556, 112, 28);
    addBtn(DesktopButtonId::View3D, DesktopButtonSection::WorkspaceViews, "3D Courtyard", 14, 590, 112, 28);
    addBtn(DesktopButtonId::ViewDiya, DesktopButtonSection::WorkspaceViews, "Night Diya 3D", 134, 590, 112, 28);

    return buttons;
}

bool isPointInsideCanvasStage(int mouseX, int mouseY, const DesktopGuiLayout& layout) {
    return mouseX >= layout.canvasX &&
           mouseX < (layout.canvasX + layout.canvasSize) &&
           mouseY >= layout.canvasY &&
           mouseY < (layout.canvasY + layout.canvasSize);
}

Point2D windowToCanvasStagePoint(int mouseX, int mouseY, const DesktopGuiLayout& layout) {
    const double lx = std::max(0.0, std::min(static_cast<double>(layout.canvasSize - 1),
                                             static_cast<double>(mouseX - layout.canvasX)));
    const double ly = std::max(0.0, std::min(static_cast<double>(layout.canvasSize - 1),
                                             static_cast<double>(mouseY - layout.canvasY)));
    return {lx, ly};
}

DesktopGuiHitResult hitTestDesktopGui(int mouseX, int mouseY, const DesktopGuiLayout& layout) {
    DesktopGuiHitResult res;
    const std::vector<DesktopGuiButton> buttons = buildDesktopGuiButtons(layout);
    for (size_t i = 0; i < buttons.size(); ++i) {
        const DesktopGuiButton& b = buttons[i];
        if (mouseX >= b.x && mouseX <= (b.x + b.width) &&
            mouseY >= b.y && mouseY <= (b.y + b.height)) {
            res.hitGui = true;
            res.hitCanvas = false;
            res.buttonId = b.id;
            res.buttonLabel = b.label;
            return res;
        }
    }

    if (isPointInsideCanvasStage(mouseX, mouseY, layout)) {
        res.hitGui = false;
        res.hitCanvas = true;
        res.canvasLocalPoint = windowToCanvasStagePoint(mouseX, mouseY, layout);
    }
    return res;
}

DesktopSplashState computeDesktopSplashProgress(int elapsedMs, int durationMs, bool skip) {
    DesktopSplashState state;
    const int safeDuration = std::max(100, durationMs);
    if (skip || elapsedMs >= safeDuration) {
        state.phase = DesktopSplashPhase::Complete;
        state.progressPct = 100;
        state.overlayOpacity = 0.0;
        state.lotusRotationDeg = 22.5;
        state.statusLabel = "Alpona Studio Ready";
        state.isComplete = true;
        return state;
    }

    const int clampedElapsed = std::max(0, elapsedMs);
    const double t = static_cast<double>(clampedElapsed) / static_cast<double>(safeDuration);
    state.progressPct = std::min(100, std::max(0, static_cast<int>(t * 100.0 + 0.5)));
    state.lotusRotationDeg = 22.5 * t;
    state.isComplete = false;

    if (t < 0.45) {
        state.phase = DesktopSplashPhase::EmblemBloom;
        state.overlayOpacity = 1.0;
        state.statusLabel = "Initializing 8-Fold Symmetry Framebuffer...";
    } else if (t < 0.78) {
        state.phase = DesktopSplashPhase::StageCalibrate;
        state.overlayOpacity = 1.0;
        state.statusLabel = "Calibrating Pigments, Shaders & Spatial Surfaces...";
    } else {
        state.phase = DesktopSplashPhase::RevealFade;
        const double fadeT = (t - 0.78) / 0.22;
        state.overlayOpacity = std::max(0.0, 1.0 - fadeT);
        state.statusLabel = "Entering Graphics Rendering Workspace...";
    }
    return state;
}

} // namespace alpona
