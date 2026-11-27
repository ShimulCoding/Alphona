/**
 * Alpona Studio Pro — Bengali Symmetry & Folk Art Design Suite
 *
 * Interactive 2D/3D Bengali Symmetry Art & Pattern Design Desktop Application
 * Built in C++11 with OpenGL and FreeGLUT (Code::Blocks Ready).
 *
 * Full Point-and-Click Desktop Studio GUI:
 *   - Top Interactive App Bar: Brush, Line, Circle, Fill, Undo, Redo, Clear, Save PNG, Save SVG, 3D STL
 *   - Left Interactive Studio Dock:
 *       * Quick-Start Templates (Padma Lotus, Boishakhi Sun, Kalka Rosette, Blank Canvas)
 *       * Traditional Pigment Swatches (Ivory, Sindoor, Turmeric, Alta, Pata, Neel)
 *       * Surface Themes (Dark Courtyard, Red Clay, Midnight Indigo)
 *       * Symmetry & Studio Assist (4x, 6x, 8x, 12x, Mirror Dn/Cn, Magnetic Snap, Guide Axes)
 *       * Viewport Zoom Controls (Zoom -, 100%, Zoom +)
 *   - 60fps CommittedFrameCache software framebuffer + dashed OpenGL reflection axes
 *   - Bottom Studio Status & Live Toast Bar
 */

#ifdef __APPLE__
#include <GLUT/glut.h>
#else
#include <GL/freeglut.h>
#endif

#include <cstdlib>
#include "../include/canvas_assist.h"
#include "../include/canvas_buffer.h"
#include "../include/desktop_gui.h"
#include "../include/floodfill.h"
#include "../include/frame_cache.h"
#include "../include/kolam_composer.h"
#include "../include/motifs.h"
#include "../include/natural_media.h"
#include "../include/phong_lighting.h"
#include "../include/png_writer.h"
#include "../include/projection3d.h"
#include "../include/rasterizer.h"
#include "../include/stl_stamp.h"
#include "../include/svg_writer.h"
#include "../include/transforms.h"
#include "../include/viewport_camera.h"

#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

using namespace alpona;

namespace {

constexpr int kCanvasSize = 720;
DesktopGuiLayout gGuiLayout;
std::vector<DesktopGuiButton> gGuiButtons;
DesktopButtonId gHoveredButton = DesktopButtonId::None;

enum class DesktopWorkspaceView {
    Studio2D = 0,
    ImageLabNpr,
    Courtyard3D,
    NightDiya3D
};

DesktopWorkspaceView gWorkspaceView = DesktopWorkspaceView::Studio2D;
CanvasBuffer gBuffer(kCanvasSize, kCanvasSize);
CanvasBuffer gViewBuffer(kCanvasSize, kCanvasSize);
CommittedFrameCache gFrameCache;
std::vector<DrawOperation> gHistory;
std::vector<DrawOperation> gRedoStack;
uint64_t gHistoryRevision = 1;

ToolKind gTool = ToolKind::Freehand;
SymmetryConfig gSymmetry = {8, true};
Color gBgColor = {22, 22, 27, 255};
Color gActiveColor = {250, 248, 242, 255};
int gThickness = 3;
bool gShowGuides = true;
bool gShowReflectionAxes = true;
SnapConfig gSnapConfig;
CanvasViewport gViewport;

bool gIsDrawing = false;
DrawOperation gActiveOp;
int gExportCounter = 1;
Point2D gLastCursor = {360.0, 360.0};
std::string gActiveTemplateName = "Padma Lotus";
std::string gStatusToast = "Welcome to Alpona Studio — Click any tool, pigment, or template to begin.";
bool gSplashDismissed = false;

const Color kPalette[] = {
    {250, 248, 242, 255}, // 0: Rice Paste Ivory
    {220, 38, 38, 255},   // 1: Sindoor Crimson
    {245, 158, 11, 255},  // 2: Turmeric Gold
    {225, 29, 72, 255},   // 3: Alta Rose
    {22, 163, 74, 255},   // 4: Pata Green
    {37, 99, 235, 255}    // 5: Neel Indigo
};

bool colorsEqual(Color a, Color b) {
    return a.r == b.r && a.g == b.g && a.b == b.b;
}

void rebuildWorkspaceViewBuffer() {
    if (gWorkspaceView == DesktopWorkspaceView::ImageLabNpr) {
        NaturalMediaOptions opts;
        opts.substrate = NaturalSubstrateId::MatiMud;
        gViewBuffer = renderNaturalMediaAlpona(gBuffer, gBgColor, opts);
    } else if (gWorkspaceView == DesktopWorkspaceView::Courtyard3D) {
        Transform3DParams p3d;
        p3d.rotXDeg = 36.0;
        p3d.rotYDeg = 28.0;
        p3d.focalLength = 3.0;
        render3DCourtyardFloor(gViewBuffer, gBuffer, p3d);
    } else if (gWorkspaceView == DesktopWorkspaceView::NightDiya3D) {
        std::vector<DiyaLight> lights = {
            {0.50, 0.50, 0.22, 1.0, 0.76, 0.32, 1.35},
            {0.22, 0.24, 0.16, 1.0, 0.64, 0.22, 0.95},
            {0.78, 0.24, 0.16, 1.0, 0.64, 0.22, 0.95},
            {0.22, 0.78, 0.16, 1.0, 0.64, 0.22, 0.95},
            {0.78, 0.78, 0.16, 1.0, 0.64, 0.22, 0.95}
        };
        PhongMaterial mat = {0.16, 0.78, 0.54, 28.0, 2.4, DiyaShadingModel::Phong};
        gViewBuffer = renderPhongDiyaLighting(gBuffer, gBgColor, lights, mat);
    }
}

void commitHistoryChanged() {
    ++gHistoryRevision;
    gFrameCache.render(gBuffer, gBgColor, gHistory, gHistoryRevision, nullptr);
    if (gWorkspaceView != DesktopWorkspaceView::Studio2D) {
        rebuildWorkspaceViewBuffer();
    }
}

void rebuildCanvas(bool includePreview = false) {
    gFrameCache.render(
        gBuffer,
        gBgColor,
        gHistory,
        gHistoryRevision,
        (includePreview && gIsDrawing) ? &gActiveOp : nullptr
    );
}

void updateWindowTitle() {
    std::string toolName = "Freehand Brush";
    if (gTool == ToolKind::Line) toolName = "Precision Line";
    else if (gTool == ToolKind::Circle) toolName = "Radial Circle";
    else if (gTool == ToolKind::SeedFill) toolName = "Pigment Fill";

    int zoomPct = static_cast<int>(std::round(gViewport.zoom * 100.0));
    std::string title = "Alpona Studio — 2D/3D Vector & Raster Design Suite | " +
                        gActiveTemplateName + " | " + toolName + " (" +
                        std::to_string(gSymmetry.sectors) +
                        (gSymmetry.reflect ? "-Fold Mirror)" : "-Fold Rotational)") +
                        " | " + std::to_string(zoomPct) + "%";
    glutSetWindowTitle(title.c_str());
}

// Convert top-down UI Y coordinate to OpenGL bottom-up Y coordinate
inline double glY(double topDownY) {
    return static_cast<double>(gGuiLayout.windowHeight) - topDownY;
}

void drawFilledRect(int x, int y, int w, int h, Color c) {
    glColor4ub(c.r, c.g, c.b, c.a);
    glBegin(GL_QUADS);
    glVertex2d(x, glY(y));
    glVertex2d(x + w, glY(y));
    glVertex2d(x + w, glY(y + h));
    glVertex2d(x, glY(y + h));
    glEnd();
}

void drawRectBorder(int x, int y, int w, int h, Color c, float lineWidth = 1.0f) {
    glColor4ub(c.r, c.g, c.b, c.a);
    glLineWidth(lineWidth);
    glBegin(GL_LINE_LOOP);
    glVertex2d(x + 0.5, glY(y + 0.5));
    glVertex2d(x + w - 0.5, glY(y + 0.5));
    glVertex2d(x + w - 0.5, glY(y + h - 0.5));
    glVertex2d(x + 0.5, glY(y + h - 0.5));
    glEnd();
}

void drawText(int x, int y, const std::string& text, Color c, void* font = GLUT_BITMAP_HELVETICA_12) {
    glColor4ub(c.r, c.g, c.b, c.a);
    glRasterPos2d(x, glY(y));
    for (size_t i = 0; i < text.size(); ++i) {
        glutBitmapCharacter(font, text[i]);
    }
}

bool isButtonActive(DesktopButtonId id) {
    switch (id) {
        case DesktopButtonId::ToolFreehand: return gTool == ToolKind::Freehand;
        case DesktopButtonId::ToolLine: return gTool == ToolKind::Line;
        case DesktopButtonId::ToolCircle: return gTool == ToolKind::Circle;
        case DesktopButtonId::ToolFill: return gTool == ToolKind::SeedFill;
        case DesktopButtonId::TemplatePadmaLotus: return gActiveTemplateName == "Padma Lotus";
        case DesktopButtonId::TemplateBoishakhiSun: return gActiveTemplateName == "Boishakhi Sun";
        case DesktopButtonId::TemplateKalkaRosette: return gActiveTemplateName == "Kalka Rosette";
        case DesktopButtonId::TemplateBlankCanvas: return gActiveTemplateName == "Blank Canvas";
        case DesktopButtonId::PigmentIvory: return colorsEqual(gActiveColor, kPalette[0]);
        case DesktopButtonId::PigmentCrimson: return colorsEqual(gActiveColor, kPalette[1]);
        case DesktopButtonId::PigmentGold: return colorsEqual(gActiveColor, kPalette[2]);
        case DesktopButtonId::PigmentRose: return colorsEqual(gActiveColor, kPalette[3]);
        case DesktopButtonId::PigmentGreen: return colorsEqual(gActiveColor, kPalette[4]);
        case DesktopButtonId::PigmentIndigo: return colorsEqual(gActiveColor, kPalette[5]);
        case DesktopButtonId::SurfaceCourtyard: return colorsEqual(gBgColor, {22, 22, 27, 255});
        case DesktopButtonId::SurfaceTerracotta: return colorsEqual(gBgColor, {124, 45, 18, 255});
        case DesktopButtonId::SurfaceIndigo: return colorsEqual(gBgColor, {23, 37, 84, 255});
        case DesktopButtonId::Sym4: return gSymmetry.sectors == 4;
        case DesktopButtonId::Sym6: return gSymmetry.sectors == 6;
        case DesktopButtonId::Sym8: return gSymmetry.sectors == 8;
        case DesktopButtonId::Sym12: return gSymmetry.sectors == 12;
        case DesktopButtonId::SymToggleReflect: return gSymmetry.reflect;
        case DesktopButtonId::AssistToggleSnap: return gSnapConfig.snapToAxis;
        case DesktopButtonId::AssistToggleAxes: return gShowReflectionAxes;
        case DesktopButtonId::ViewStudio: return gWorkspaceView == DesktopWorkspaceView::Studio2D;
        case DesktopButtonId::ViewImageLab: return gWorkspaceView == DesktopWorkspaceView::ImageLabNpr;
        case DesktopButtonId::View3D: return gWorkspaceView == DesktopWorkspaceView::Courtyard3D;
        case DesktopButtonId::ViewDiya: return gWorkspaceView == DesktopWorkspaceView::NightDiya3D;
        default: return false;
    }
}

void drawStudioChrome() {
    // 1. Window background (Warm Stone #F6F5F1)
    drawFilledRect(0, 0, gGuiLayout.windowWidth, gGuiLayout.windowHeight, {246, 245, 241, 255});

    // 2. Top App Bar (#FFFFFF with bottom border)
    drawFilledRect(0, 0, gGuiLayout.windowWidth, gGuiLayout.topBarHeight, {255, 255, 255, 255});
    drawFilledRect(0, gGuiLayout.topBarHeight - 1, gGuiLayout.windowWidth, 1, {220, 218, 212, 255});
    drawText(14, 26, "Alpona Studio", {24, 24, 27, 255}, GLUT_BITMAP_HELVETICA_18);
    drawFilledRect(138, 12, 24, 16, {24, 24, 27, 255});
    drawText(142, 24, "PRO", {250, 248, 242, 255}, GLUT_BITMAP_HELVETICA_10);

    // 3. Left Studio Dock (#FAF9F5 with right border)
    drawFilledRect(0, gGuiLayout.topBarHeight, gGuiLayout.leftDockWidth,
                   gGuiLayout.statusBarY - gGuiLayout.topBarHeight, {250, 249, 245, 255});
    drawFilledRect(gGuiLayout.leftDockWidth - 1, gGuiLayout.topBarHeight, 1,
                   gGuiLayout.statusBarY - gGuiLayout.topBarHeight, {220, 218, 212, 255});

    // Section Headings in Left Studio Dock
    drawText(14, 65, "Quick-Start Templates", {82, 82, 91, 255});
    drawText(14, 169, "Artisan Pigments", {82, 82, 91, 255});
    drawText(14, 273, "Courtyard Surface", {82, 82, 91, 255});
    drawText(14, 341, "Symmetry & Assist", {82, 82, 91, 255});
    drawText(14, 485, "Canvas Zoom", {82, 82, 91, 255});
    drawText(14, 547, "Workspace Views (2D / NPR / 3D)", {82, 82, 91, 255});

    // Studio Quick Tips Card inside Left Dock bottom area
    drawFilledRect(14, 628, 232, 130, {255, 255, 255, 255});
    drawRectBorder(14, 628, 232, 130, {228, 226, 220, 255});
    drawText(22, 648, ("Active: " + gActiveTemplateName + " (" +
                       std::to_string(gSymmetry.sectors) + "x)").c_str(), {24, 24, 27, 255});
    drawText(22, 668, ("Layers: " + std::to_string(gHistory.size()) + " strokes | Snap: " +
                       std::string(gSnapConfig.snapToAxis ? "On" : "Off")).c_str(),
             {82, 82, 91, 255});
    drawText(22, 692, "Keys: [F] Brush [L] Line [O] Circle", {113, 113, 122, 255});
    drawText(22, 710, "[B] Fill [U] Undo [S] PNG [V] SVG", {113, 113, 122, 255});
    drawText(22, 728, "[T] 3D STL [K] Kolam [ESC] Exit", {113, 113, 122, 255});

    // 4. Render All Interactive Buttons
    for (size_t i = 0; i < gGuiButtons.size(); ++i) {
        const DesktopGuiButton& b = gGuiButtons[i];
        const bool active = isButtonActive(b.id);
        const bool hovered = (b.id == gHoveredButton);
        const bool isPrimaryExport = (b.id == DesktopButtonId::ExportPng);

        Color fill = {255, 255, 255, 255};
        Color border = {212, 212, 216, 255};
        Color textCol = {39, 39, 42, 255};

        if (isPrimaryExport) {
            fill = hovered ? Color{153, 27, 27, 255} : Color{185, 28, 28, 255};
            border = fill;
            textCol = {255, 255, 255, 255};
        } else if (active) {
            fill = {24, 24, 27, 255};
            border = {24, 24, 27, 255};
            textCol = {255, 255, 255, 255};
        } else if (hovered) {
            fill = {244, 244, 245, 255};
            border = {161, 161, 170, 255};
        }

        drawFilledRect(b.x, b.y, b.width, b.height, fill);
        drawRectBorder(b.x, b.y, b.width, b.height, border, active ? 1.5f : 1.0f);

        int textOffsetX = 9;
        if (b.hasSwatch) {
            drawFilledRect(b.x + 6, b.y + 7, 14, 16, b.swatchColor);
            drawRectBorder(b.x + 6, b.y + 7, 14, 16, {161, 161, 170, 255});
            textOffsetX = 24;
        }
        drawText(b.x + textOffsetX, b.y + 19, b.label, textCol);
    }

    // 5. Bottom Status & Toast Notification Bar
    drawFilledRect(0, gGuiLayout.statusBarY, gGuiLayout.windowWidth,
                   gGuiLayout.windowHeight - gGuiLayout.statusBarY, {24, 24, 27, 255});
    drawText(14, gGuiLayout.statusBarY + 16, gStatusToast, {244, 244, 245, 255});

    std::ostringstream coordOss;
    coordOss << "Cursor: (" << static_cast<int>(std::round(gLastCursor.x)) << ", "
             << static_cast<int>(std::round(gLastCursor.y)) << ") px | Zoom: "
             << static_cast<int>(std::round(gViewport.zoom * 100.0)) << "% | v1.4.2 · Synced";
    drawText(665, gGuiLayout.statusBarY + 16, coordOss.str(), {212, 212, 216, 255});
}

void drawSymmetryGuides() {
    if (!gShowGuides && !gShowReflectionAxes) return;

    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

    if (gShowReflectionAxes) {
        std::vector<SymmetryReflectionAxis> axes =
            computeSymmetryReflectionAxes(kCanvasSize, gSymmetry);

        glEnable(GL_LINE_STIPPLE);
        glLineStipple(2, 0xAAAA);
        for (size_t i = 0; i < axes.size(); ++i) {
            const SymmetryReflectionAxis& ax = axes[i];
            if (ax.isPrimary) {
                glColor4f(0.96f, 0.62f, 0.04f, 0.68f);
                glLineWidth(1.5f);
            } else {
                glColor4f(0.96f, 0.62f, 0.04f, 0.34f);
                glLineWidth(1.0f);
            }
            glBegin(GL_LINES);
            glVertex2d(gGuiLayout.canvasX + ax.x1, glY(gGuiLayout.canvasY + ax.y1));
            glVertex2d(gGuiLayout.canvasX + ax.x2, glY(gGuiLayout.canvasY + ax.y2));
            glEnd();
        }
        glDisable(GL_LINE_STIPPLE);
    }

    glDisable(GL_BLEND);
}

void displayCallback() {
    glClear(GL_COLOR_BUFFER_BIT);

    // Draw surrounding studio toolbar, dock & status bar
    drawStudioChrome();

    // Frame around the 720x720 canvas stage
    drawRectBorder(gGuiLayout.canvasX - 1, gGuiLayout.canvasY - 1,
                   kCanvasSize + 2, kCanvasSize + 2, {180, 178, 172, 255}, 1.5f);

    // Flip vertically when blitting top-down CanvasBuffer to OpenGL bottom-up origin
    const CanvasBuffer& displayBuf =
        (gWorkspaceView == DesktopWorkspaceView::Studio2D) ? gBuffer : gViewBuffer;
    std::vector<uint8_t> flipped(kCanvasSize * kCanvasSize * 4);
    const uint8_t* src = displayBuf.data();
    for (int y = 0; y < kCanvasSize; ++y) {
        const int dstY = kCanvasSize - 1 - y;
        std::copy(
            src + y * kCanvasSize * 4,
            src + (y + 1) * kCanvasSize * 4,
            flipped.begin() + dstY * kCanvasSize * 4
        );
    }

    glRasterPos2d(gGuiLayout.canvasX, glY(gGuiLayout.canvasY + kCanvasSize));
    glDrawPixels(kCanvasSize, kCanvasSize, GL_RGBA, GL_UNSIGNED_BYTE, flipped.data());
    if (gWorkspaceView == DesktopWorkspaceView::Studio2D) {
        drawSymmetryGuides();
    }

    // Branded Startup Splash Overlay (first 720ms on launch or until clicked)
    const DesktopSplashState splash = computeDesktopSplashProgress(
        glutGet(GLUT_ELAPSED_TIME), 720, gSplashDismissed
    );
    if (!splash.isComplete && splash.overlayOpacity > 0.01) {
        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
        const uint8_t alpha = static_cast<uint8_t>(std::round(splash.overlayOpacity * 242.0));
        drawFilledRect(0, 0, gGuiLayout.windowWidth, gGuiLayout.windowHeight, {246, 245, 241, alpha});

        const int cardW = 440;
        const int cardH = 190;
        const int cardX = (gGuiLayout.windowWidth - cardW) / 2;
        const int cardY = (gGuiLayout.windowHeight - cardH) / 2;
        drawFilledRect(cardX, cardY, cardW, cardH, {255, 255, 255, alpha});
        drawRectBorder(cardX, cardY, cardW, cardH, {185, 28, 28, alpha}, 1.5f);

        drawText(cardX + 32, cardY + 52, "Alpona Studio", {24, 24, 27, alpha}, GLUT_BITMAP_HELVETICA_18);
        drawText(cardX + 32, cardY + 78, "Commercial 2D/3D Vector, Multi-Layer & Spatial Projection Suite",
                 {82, 82, 91, alpha});
        drawText(cardX + 32, cardY + 114, splash.statusLabel, {185, 28, 28, alpha});

        // Progress bar track & fill
        const int barX = cardX + 32;
        const int barY = cardY + 132;
        const int barW = cardW - 64;
        drawFilledRect(barX, barY, barW, 8, {228, 228, 231, alpha});
        const int fillW = (barW * splash.progressPct) / 100;
        drawFilledRect(barX, barY, fillW, 8, {185, 28, 28, alpha});
        glDisable(GL_BLEND);
    }

    glutSwapBuffers();
}

Point2D mapWindowMouseToCanvasLogical(int winX, int winY) {
    const Point2D local = windowToCanvasStagePoint(winX, winY, gGuiLayout);
    StageRect rect = {0.0, 0.0, static_cast<double>(kCanvasSize), static_cast<double>(kCanvasSize)};
    Point2D raw = screenToCanvasWithViewport(
        local.x,
        local.y,
        rect,
        gViewport,
        kCanvasSize
    );
    if (gSnapConfig.snapToAxis || gSnapConfig.snapToRing) {
        SnapResult snapped = snapPointToSymmetryGuides(raw, kCanvasSize, gSymmetry, gSnapConfig);
        return snapped.point;
    }
    return raw;
}

void exportSvgSnapshot() {
    std::string filename = "alpona_vector_" + std::to_string(gExportCounter++) + ".svg";
    // Shared with AlponaCLI: seed fills are exported as crisp vector regions too.
    const std::string svg = buildOperationsSvg(gHistory, kCanvasSize, gBgColor);
    std::ofstream ofs(filename.c_str(), std::ios::binary);
    if (ofs.is_open() && (ofs << svg)) {
        gStatusToast = "Saved Vector SVG artwork -> " + filename;
        std::cout << "[Alpona Studio Pro] " << gStatusToast << std::endl;
    }
}

void exportStlSnapshot() {
    std::string filename = "alpona_pitha_mold_" + std::to_string(gExportCounter++) + ".stl";
    StlStampOptions opts;
    opts.mode = StampPresetMode::PithaMold;
    opts.gridSize = 64;
    StampHeightfield hf = buildStampHeightfield(gBuffer, gBgColor, opts);
    StampMeshSummary mesh = generateStampMesh(hf, opts);
    std::vector<uint8_t> bytes = serializeBinaryStl(mesh);
    std::ofstream ofs(filename.c_str(), std::ios::binary);
    if (ofs.is_open()) {
        ofs.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
        gStatusToast = "Exported 3D Pitha Mold STL (" + std::to_string(mesh.triangleCount) + " triangles) -> " + filename;
        std::cout << "[Alpona Studio Pro] " << gStatusToast << std::endl;
    }
}

void executeGuiButtonAction(DesktopButtonId id) {
    const Point2D canvasCenter = {kCanvasSize * 0.5, kCanvasSize * 0.5};
    switch (id) {
        case DesktopButtonId::ToolFreehand:
            gTool = ToolKind::Freehand;
            gStatusToast = "Selected Freehand Brush — drag across the canvas to paint symmetric curves.";
            break;
        case DesktopButtonId::ToolLine:
            gTool = ToolKind::Line;
            gStatusToast = "Selected Precision Line tool — click and drag to draw radial spokes.";
            break;
        case DesktopButtonId::ToolCircle:
            gTool = ToolKind::Circle;
            gStatusToast = "Selected Radial Circle tool — drag outward to place symmetric rings.";
            break;
        case DesktopButtonId::ToolFill:
            gTool = ToolKind::SeedFill;
            gStatusToast = "Selected Pigment Fill tool — click any enclosed petal to fill across all sectors.";
            break;
        case DesktopButtonId::ActionUndo:
            if (!gHistory.empty()) {
                gRedoStack.push_back(gHistory.back());
                gHistory.pop_back();
                commitHistoryChanged();
                gStatusToast = "Undid last stroke (" + std::to_string(gHistory.size()) + " strokes on canvas).";
            }
            break;
        case DesktopButtonId::ActionRedo:
            if (!gRedoStack.empty()) {
                gHistory.push_back(gRedoStack.back());
                gRedoStack.pop_back();
                commitHistoryChanged();
                gStatusToast = "Redid stroke (" + std::to_string(gHistory.size()) + " strokes on canvas).";
            }
            break;
        case DesktopButtonId::ActionClear:
        case DesktopButtonId::TemplateBlankCanvas:
            gHistory.clear();
            gRedoStack.clear();
            gActiveTemplateName = "Blank Canvas";
            commitHistoryChanged();
            gStatusToast = "Started Blank Artisan Canvas — draw anywhere inside the courtyard stage.";
            break;
        case DesktopButtonId::ExportPng: {
            std::string filename = "alpona_export_" + std::to_string(gExportCounter++) + ".png";
            const CanvasBuffer& exportBuf =
                (gWorkspaceView == DesktopWorkspaceView::Studio2D) ? gBuffer : gViewBuffer;
            if (saveCanvasToPng(exportBuf, filename)) {
                gStatusToast = "Exported high-resolution PNG -> " + filename;
                std::cout << "[Alpona Studio Pro] " << gStatusToast << std::endl;
            }
            break;
        }
        case DesktopButtonId::ExportSvg:
            exportSvgSnapshot();
            break;
        case DesktopButtonId::ExportStl:
            exportStlSnapshot();
            break;
        case DesktopButtonId::TemplatePadmaLotus:
            gHistory = buildPadmaLotusMotif(kCanvasSize);
            gRedoStack.clear();
            gSymmetry = {8, true};
            gBgColor = {22, 22, 27, 255};
            gActiveTemplateName = "Padma Lotus";
            commitHistoryChanged();
            gStatusToast = "Loaded Padma Lotus Courtyard template (8-fold mirror symmetry).";
            break;
        case DesktopButtonId::TemplateBoishakhiSun:
            gHistory = buildBoishakhiSunMotif(kCanvasSize);
            gRedoStack.clear();
            gSymmetry = {12, true};
            gBgColor = {124, 45, 18, 255};
            gActiveTemplateName = "Boishakhi Sun";
            commitHistoryChanged();
            gStatusToast = "Loaded Boishakhi Terracotta Sun template (12-fold mirror symmetry).";
            break;
        case DesktopButtonId::TemplateKalkaRosette:
            gHistory = buildKalkaRosetteMotif(kCanvasSize);
            gRedoStack.clear();
            gSymmetry = {6, false};
            gBgColor = {23, 37, 84, 255};
            gActiveTemplateName = "Kalka Rosette";
            commitHistoryChanged();
            gStatusToast = "Loaded Shankha & Kalka Rosette template (6-fold rotational symmetry).";
            break;
        case DesktopButtonId::PigmentIvory:
            gActiveColor = kPalette[0];
            gStatusToast = "Selected Rice Paste Ivory pigment (#FAF8F2).";
            break;
        case DesktopButtonId::PigmentCrimson:
            gActiveColor = kPalette[1];
            gStatusToast = "Selected Sindoor Crimson pigment (#DC2626).";
            break;
        case DesktopButtonId::PigmentGold:
            gActiveColor = kPalette[2];
            gStatusToast = "Selected Turmeric Gold pigment (#F59E0B).";
            break;
        case DesktopButtonId::PigmentRose:
            gActiveColor = kPalette[3];
            gStatusToast = "Selected Alta Rose pigment (#E11D48).";
            break;
        case DesktopButtonId::PigmentGreen:
            gActiveColor = kPalette[4];
            gStatusToast = "Selected Pata Green pigment (#16A34A).";
            break;
        case DesktopButtonId::PigmentIndigo:
            gActiveColor = kPalette[5];
            gStatusToast = "Selected Neel Indigo pigment (#2563EB).";
            break;
        case DesktopButtonId::SurfaceCourtyard:
            gBgColor = {22, 22, 27, 255};
            commitHistoryChanged();
            gStatusToast = "Switched background to Dark Courtyard (#16161B).";
            break;
        case DesktopButtonId::SurfaceTerracotta:
            gBgColor = {124, 45, 18, 255};
            commitHistoryChanged();
            gStatusToast = "Switched background to Terracotta Red Clay (#7C2D12).";
            break;
        case DesktopButtonId::SurfaceIndigo:
            gBgColor = {23, 37, 84, 255};
            commitHistoryChanged();
            gStatusToast = "Switched background to Midnight Indigo (#172554).";
            break;
        case DesktopButtonId::Sym4:
            gSymmetry.sectors = 4;
            gStatusToast = "Set symmetry to 4 sectors.";
            break;
        case DesktopButtonId::Sym6:
            gSymmetry.sectors = 6;
            gStatusToast = "Set symmetry to 6 sectors.";
            break;
        case DesktopButtonId::Sym8:
            gSymmetry.sectors = 8;
            gStatusToast = "Set symmetry to 8 sectors.";
            break;
        case DesktopButtonId::Sym12:
            gSymmetry.sectors = 12;
            gStatusToast = "Set symmetry to 12 sectors.";
            break;
        case DesktopButtonId::SymToggleReflect:
            gSymmetry.reflect = !gSymmetry.reflect;
            gStatusToast = gSymmetry.reflect
                ? "Enabled Dihedral Mirror Reflection (Dn)."
                : "Switched to Pure Rotational Symmetry (Cn).";
            break;
        case DesktopButtonId::AssistToggleSnap:
            gSnapConfig.snapToAxis = !gSnapConfig.snapToAxis;
            gSnapConfig.snapToRing = gSnapConfig.snapToAxis;
            gStatusToast = gSnapConfig.snapToAxis
                ? "Enabled Magnetic Axis & Ring Snapping."
                : "Disabled Magnetic Snapping.";
            break;
        case DesktopButtonId::AssistToggleAxes:
            gShowReflectionAxes = !gShowReflectionAxes;
            gStatusToast = gShowReflectionAxes
                ? "Showing dashed symmetry guide axes."
                : "Hidden symmetry guide axes.";
            break;
        case DesktopButtonId::ZoomIn:
            gViewport = zoomCanvasViewportAtPoint(gViewport, gViewport.zoom * 1.25, canvasCenter, kCanvasSize);
            gStatusToast = "Zoomed in canvas viewport.";
            break;
        case DesktopButtonId::ZoomOut:
            gViewport = zoomCanvasViewportAtPoint(gViewport, gViewport.zoom / 1.25, canvasCenter, kCanvasSize);
            gStatusToast = "Zoomed out canvas viewport.";
            break;
        case DesktopButtonId::ZoomReset:
            gViewport = CanvasViewport();
            gStatusToast = "Reset canvas zoom to 100%.";
            break;
        case DesktopButtonId::ViewStudio:
            gWorkspaceView = DesktopWorkspaceView::Studio2D;
            gStatusToast = "Active View: 2D Studio — draw or edit symmetric strokes on canvas.";
            break;
        case DesktopButtonId::ViewImageLab:
            gWorkspaceView = DesktopWorkspaceView::ImageLabNpr;
            rebuildWorkspaceViewBuffer();
            gStatusToast = "Active View: Image Lab NPR — Natural Media Chaler Guro & Red Mati Mud Courtyard.";
            break;
        case DesktopButtonId::View3D:
            gWorkspaceView = DesktopWorkspaceView::Courtyard3D;
            rebuildWorkspaceViewBuffer();
            gStatusToast = "Active View: 3D Courtyard — Perspective-projected courtyard floor with Z-Buffer HSR.";
            break;
        case DesktopButtonId::ViewDiya:
            gWorkspaceView = DesktopWorkspaceView::NightDiya3D;
            rebuildWorkspaceViewBuffer();
            gStatusToast = "Active View: Night Diya 3D — Sobel relief normal map with 5 Phong point lights.";
            break;
        default:
            break;
    }
    updateWindowTitle();
    glutPostRedisplay();
}

void mouseCallback(int button, int state, int x, int y) {
    if (button != GLUT_LEFT_BUTTON) return;

    if (state == GLUT_DOWN) {
        gSplashDismissed = true;
        const DesktopGuiHitResult hit = hitTestDesktopGui(x, y, gGuiLayout);
        if (hit.hitGui) {
            executeGuiButtonAction(hit.buttonId);
            return;
        }
        if (!hit.hitCanvas) {
            return;
        }

        const Point2D pt = mapWindowMouseToCanvasLogical(x, y);
        gLastCursor = pt;

        if (gTool == ToolKind::SeedFill) {
            DrawOperation fillOp;
            fillOp.kind = ToolKind::SeedFill;
            fillOp.p0 = pt;
            fillOp.color = gActiveColor;
            fillOp.symmetricFill = true;
            fillOp.symmetry = gSymmetry;
            gHistory.push_back(fillOp);
            gRedoStack.clear();
            commitHistoryChanged();
            glutPostRedisplay();
            return;
        }

        gIsDrawing = true;
        gActiveOp = DrawOperation();
        gActiveOp.kind = gTool;
        gActiveOp.p0 = pt;
        gActiveOp.p1 = pt;
        gActiveOp.radius = 0.0;
        gActiveOp.points = {pt};
        gActiveOp.color = gActiveColor;
        gActiveOp.thickness = gThickness;
        gActiveOp.symmetry = gSymmetry;
    } else if (state == GLUT_UP && gIsDrawing) {
        gIsDrawing = false;
        gHistory.push_back(gActiveOp);
        gRedoStack.clear();
        commitHistoryChanged();
        glutPostRedisplay();
    }
}

void motionCallback(int x, int y) {
    if (!gIsDrawing) return;
    const Point2D pt = mapWindowMouseToCanvasLogical(x, y);
    gLastCursor = pt;

    if (gTool == ToolKind::Freehand) {
        gActiveOp.points.push_back(pt);
    } else if (gTool == ToolKind::Line) {
        gActiveOp.p1 = pt;
    } else if (gTool == ToolKind::Circle) {
        const double dx = pt.x - gActiveOp.p0.x;
        const double dy = pt.y - gActiveOp.p0.y;
        gActiveOp.radius = std::sqrt(dx * dx + dy * dy);
    }

    rebuildCanvas(true);
    glutPostRedisplay();
}

void passiveMotionCallback(int x, int y) {
    const DesktopGuiHitResult hit = hitTestDesktopGui(x, y, gGuiLayout);
    DesktopButtonId nextHover = hit.hitGui ? hit.buttonId : DesktopButtonId::None;
    bool needsRedraw = (nextHover != gHoveredButton);
    gHoveredButton = nextHover;

    if (hit.hitCanvas) {
        gLastCursor = mapWindowMouseToCanvasLogical(x, y);
        needsRedraw = true;
    }
    if (needsRedraw) {
        glutPostRedisplay();
    }
}

// [K] Pulli dot-grid kolam (mirror-curve composer). Each press tries the next seed.
uint32_t gKolamSeed = 7;

void loadKolamTemplate() {
    KolamConfig cfg;
    cfg.rows = 7;
    cfg.cols = 7;
    cfg.symmetry = KolamSymmetry::Mirror;
    cfg.seed = gKolamSeed;
    cfg.requireSingleLoop = true;
    KolamComposeResult kolam = composeKolam(kCanvasSize, cfg);
    gHistory = buildKolamDrawOperations(
        kolam, Color{248, 244, 236, 255}, Color{245, 158, 11, 255}, 3);
    gRedoStack.clear();
    gBgColor = {22, 22, 27, 255};
    gActiveTemplateName = "Pulli Kolam";
    commitHistoryChanged();
    gStatusToast = "Drew 7x7 pulli kolam: " +
                   std::string(kolam.isSingleLoop ? "one continuous stroke" : "several loops") +
                   " (seed " + std::to_string(kolam.seedUsed) + "). Press K for another.";
    std::cout << "[Alpona Studio Pro] " << gStatusToast << std::endl;
    gKolamSeed = kolam.seedUsed + 1;
    glutPostRedisplay();
}

void keyboardCallback(unsigned char key, int, int) {
    switch (key) {
        case 'f': case 'F': executeGuiButtonAction(DesktopButtonId::ToolFreehand); break;
        case 'l': case 'L': executeGuiButtonAction(DesktopButtonId::ToolLine); break;
        case 'o': case 'O': executeGuiButtonAction(DesktopButtonId::ToolCircle); break;
        case 'b': case 'B': executeGuiButtonAction(DesktopButtonId::ToolFill); break;

        case '4': executeGuiButtonAction(DesktopButtonId::Sym4); break;
        case '6': executeGuiButtonAction(DesktopButtonId::Sym6); break;
        case '8': executeGuiButtonAction(DesktopButtonId::Sym8); break;
        case '2': executeGuiButtonAction(DesktopButtonId::Sym12); break;
        case 'r': case 'R': executeGuiButtonAction(DesktopButtonId::SymToggleReflect); break;
        case 'a': case 'A': executeGuiButtonAction(DesktopButtonId::AssistToggleAxes); break;
        case 'x': case 'X': executeGuiButtonAction(DesktopButtonId::AssistToggleSnap); break;

        case '+': case '=': executeGuiButtonAction(DesktopButtonId::ZoomIn); break;
        case '-': case '_': executeGuiButtonAction(DesktopButtonId::ZoomOut); break;
        case '0': executeGuiButtonAction(DesktopButtonId::ZoomReset); break;

        case 'u': case 'U': executeGuiButtonAction(DesktopButtonId::ActionUndo); break;
        case 'y': case 'Y': executeGuiButtonAction(DesktopButtonId::ActionRedo); break;
        case 'c': case 'C': executeGuiButtonAction(DesktopButtonId::ActionClear); break;

        case 'm': case 'M': executeGuiButtonAction(DesktopButtonId::TemplatePadmaLotus); break;
        case 'n': case 'N': executeGuiButtonAction(DesktopButtonId::TemplateBoishakhiSun); break;

        case 'q': executeGuiButtonAction(DesktopButtonId::PigmentIvory); break;
        case 'w': executeGuiButtonAction(DesktopButtonId::PigmentCrimson); break;
        case 'e': executeGuiButtonAction(DesktopButtonId::PigmentGold); break;
        case 'd': executeGuiButtonAction(DesktopButtonId::PigmentGreen); break;
        case 'z': executeGuiButtonAction(DesktopButtonId::PigmentIndigo); break;

        case 's': case 'S': executeGuiButtonAction(DesktopButtonId::ExportPng); break;
        case 'v': case 'V': executeGuiButtonAction(DesktopButtonId::ExportSvg); break;
        case 't': case 'T': executeGuiButtonAction(DesktopButtonId::ExportStl); break;
        case 'k': case 'K': loadKolamTemplate(); break;
        case 27: // ESC
#ifdef __APPLE__
            std::exit(0);  // Apple GLUT has no glutLeaveMainLoop()
#else
            glutLeaveMainLoop();
#endif
            return;
        default:
            return;
    }
}

void reshapeCallback(int w, int h) {
    glViewport(0, 0, w, h);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluOrtho2D(0.0, gGuiLayout.windowWidth, 0.0, gGuiLayout.windowHeight);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
}

void splashTimerCallback(int) {
    const DesktopSplashState splash = computeDesktopSplashProgress(
        glutGet(GLUT_ELAPSED_TIME), 720, gSplashDismissed
    );
    glutPostRedisplay();
    if (!splash.isComplete) {
        glutTimerFunc(16, splashTimerCallback, 0);
    }
}

} // namespace

int main(int argc, char** argv) {
    gGuiButtons = buildDesktopGuiButtons(gGuiLayout);

    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGBA);
    glutInitWindowSize(gGuiLayout.windowWidth, gGuiLayout.windowHeight);
    glutCreateWindow("Alpona Studio — 2D/3D Vector & Raster Design Suite");

    // Load default Padma Lotus Alpona starter template via CommittedFrameCache
    gHistory = buildPadmaLotusMotif(kCanvasSize);
    commitHistoryChanged();
    updateWindowTitle();

    glutDisplayFunc(displayCallback);
    glutReshapeFunc(reshapeCallback);
    glutMouseFunc(mouseCallback);
    glutMotionFunc(motionCallback);
    glutPassiveMotionFunc(passiveMotionCallback);
    glutKeyboardFunc(keyboardCallback);
    glutTimerFunc(16, splashTimerCallback, 0);

    glutMainLoop();
    return 0;
}
