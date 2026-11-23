/**
 * Alpona Studio — CSE 401/402 Computer Graphics & Image Processing Lab
 * Metropolitan University, Sylhet
 *
 * Authors:
 *   Shimul Chowdhury       (ID: 231-115-087)
 *   Gobindo Debnath Dipro  (ID: 231-115-118)
 *
 * Interactive 2D Bengali Symmetry Art & Pattern Design Tool
 * Built in C++11 with OpenGL and FreeGLUT.
 *
 * Pro Desktop Features Wired into GLUT:
 *   - CommittedFrameCache (60fps cached base framebuffer preview composition)
 *   - Real-time dashed OpenGL Symmetry Reflection Axes (computeSymmetryReflectionAxes)
 *   - Magnetic Snap-to-Axis & Guide Ring toggle ([X] via snapPointToSymmetryGuides)
 *   - Viewport Zoom In/Out/Reset ([+], [-], [0] via zoomCanvasViewportAtPoint)
 *   - Pure C++11 PNG ([S]), Vector SVG ([V]), and 3D Binary .STL Pitha Mold ([T]) Exporters
 */

#ifdef __APPLE__
#include <GLUT/glut.h>
#else
#include <GL/freeglut.h>
#endif

#include "../include/canvas_assist.h"
#include "../include/canvas_buffer.h"
#include "../include/floodfill.h"
#include "../include/frame_cache.h"
#include "../include/motifs.h"
#include "../include/png_writer.h"
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

CanvasBuffer gBuffer(kCanvasSize, kCanvasSize);
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

const Color kPalette[] = {
    {250, 248, 242, 255}, // 1: Rice Paste Ivory
    {220, 38, 38, 255},   // 2: Sindoor Crimson
    {245, 158, 11, 255},  // 3: Turmeric Gold
    {225, 29, 72, 255},   // 4: Alta Rose
    {22, 163, 74, 255},   // 5: Pata Green
    {37, 99, 235, 255}    // 6: Neel Indigo
};

std::string colorToHex(Color c) {
    std::ostringstream oss;
    oss << "#" << std::hex << std::uppercase << std::setfill('0')
        << std::setw(2) << static_cast<int>(c.r)
        << std::setw(2) << static_cast<int>(c.g)
        << std::setw(2) << static_cast<int>(c.b);
    return oss.str();
}

void commitHistoryChanged() {
    ++gHistoryRevision;
    gFrameCache.render(gBuffer, gBgColor, gHistory, gHistoryRevision, nullptr);
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
    std::string toolName = "Freehand";
    if (gTool == ToolKind::Line) toolName = "Bresenham Line";
    else if (gTool == ToolKind::Circle) toolName = "Midpoint Circle";
    else if (gTool == ToolKind::SeedFill) toolName = "Iterative Seed Fill";

    int zoomPct = static_cast<int>(std::round(gViewport.zoom * 100.0));
    std::string title = "Alpona Studio | " + toolName +
                        " | " + std::to_string(gSymmetry.sectors) +
                        (gSymmetry.reflect ? " Dn" : " Cn") +
                        " | Snap:" + (gSnapConfig.snapToAxis ? "ON" : "OFF") +
                        " | Zoom:" + std::to_string(zoomPct) + "%" +
                        " | [F/L/O/B] [X]Snap [A]Axes [+/-]Zoom [S]PNG [V]SVG [T]STL";
    glutSetWindowTitle(title.c_str());
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
            glVertex2d(ax.x1, static_cast<double>(kCanvasSize) - ax.y1);
            glVertex2d(ax.x2, static_cast<double>(kCanvasSize) - ax.y2);
            glEnd();
        }
        glDisable(GL_LINE_STIPPLE);
    }

    glDisable(GL_BLEND);
}

void displayCallback() {
    glClear(GL_COLOR_BUFFER_BIT);

    // Flip vertically when blitting top-down CanvasBuffer to OpenGL bottom-up origin
    std::vector<uint8_t> flipped(kCanvasSize * kCanvasSize * 4);
    const uint8_t* src = gBuffer.data();
    for (int y = 0; y < kCanvasSize; ++y) {
        const int dstY = kCanvasSize - 1 - y;
        std::copy(
            src + y * kCanvasSize * 4,
            src + (y + 1) * kCanvasSize * 4,
            flipped.begin() + dstY * kCanvasSize * 4
        );
    }

    glRasterPos2i(0, 0);
    glPixelZoom(static_cast<GLfloat>(gViewport.zoom), static_cast<GLfloat>(gViewport.zoom));
    glDrawPixels(kCanvasSize, kCanvasSize, GL_RGBA, GL_UNSIGNED_BYTE, flipped.data());
    glPixelZoom(1.0f, 1.0f);
    drawSymmetryGuides();
    glutSwapBuffers();
}

Point2D mapMouseToLogical(int x, int y) {
    StageRect rect = {0.0, 0.0, static_cast<double>(kCanvasSize), static_cast<double>(kCanvasSize)};
    Point2D raw = screenToCanvasWithViewport(
        static_cast<double>(x),
        static_cast<double>(y),
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

void mouseCallback(int button, int state, int x, int y) {
    if (button != GLUT_LEFT_BUTTON) return;
    const Point2D pt = mapMouseToLogical(x, y);

    if (state == GLUT_DOWN) {
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
    const Point2D pt = mapMouseToLogical(x, y);

    if (gTool == ToolKind::Freehand) {
        gActiveOp.points.push_back(pt);
    } else if (gTool == ToolKind::Line) {
        gActiveOp.p1 = pt;
    } else if (gTool == ToolKind::Circle) {
        const double dx = pt.x - gActiveOp.p0.x;
        const double dy = pt.y - gActiveOp.p0.y;
        gActiveOp.radius = std::sqrt(dx * dx + dy * dy);
    }

    // Fast O(W*H) cached base blit + single preview op via CommittedFrameCache
    rebuildCanvas(true);
    glutPostRedisplay();
}

void exportSvgSnapshot() {
    std::string filename = "alpona_vector_" + std::to_string(gExportCounter++) + ".svg";
    SvgWriter svg(kCanvasSize, kCanvasSize, colorToHex(gBgColor));
    const Point2D center = {kCanvasSize * 0.5, kCanvasSize * 0.5};
    for (size_t i = 0; i < gHistory.size(); ++i) {
        const DrawOperation& op = gHistory[i];
        const std::string hex = colorToHex(op.color);
        if (op.kind == ToolKind::Line) {
            auto segs = generateSymmetricSegments(op.p0, op.p1, center, op.symmetry);
            for (size_t s = 0; s < segs.size(); ++s) {
                svg.addLine(segs[s].first, segs[s].second, hex, static_cast<double>(op.thickness));
            }
        } else if (op.kind == ToolKind::Circle) {
            auto centers = generateSymmetricPoints(op.p0, center, op.symmetry);
            for (size_t c = 0; c < centers.size(); ++c) {
                svg.addCircle(centers[c], op.radius, hex, static_cast<double>(op.thickness));
            }
        } else if (op.kind == ToolKind::Freehand && op.points.size() >= 2) {
            for (size_t k = 1; k < op.points.size(); ++k) {
                auto segs = generateSymmetricSegments(op.points[k - 1], op.points[k], center, op.symmetry);
                for (size_t s = 0; s < segs.size(); ++s) {
                    svg.addLine(segs[s].first, segs[s].second, hex, static_cast<double>(op.thickness));
                }
            }
        }
    }
    if (svg.saveToFile(filename)) {
        std::cout << "[Alpona Studio] Exported Vector SVG -> " << filename << std::endl;
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
        std::cout << "[Alpona Studio] Exported 3D Pitha Mold STL (" << mesh.triangleCount
                  << " tris) -> " << filename << std::endl;
    }
}

void keyboardCallback(unsigned char key, int, int) {
    const Point2D canvasCenter = {kCanvasSize * 0.5, kCanvasSize * 0.5};
    switch (key) {
        case 'f': case 'F': gTool = ToolKind::Freehand; break;
        case 'l': case 'L': gTool = ToolKind::Line; break;
        case 'o': case 'O': gTool = ToolKind::Circle; break;
        case 'b': case 'B': gTool = ToolKind::SeedFill; break;

        case '4': gSymmetry.sectors = 4; break;
        case '6': gSymmetry.sectors = 6; break;
        case '8': gSymmetry.sectors = 8; break;
        case '2': gSymmetry.sectors = 12; break;
        case 'r': case 'R': gSymmetry.reflect = !gSymmetry.reflect; break;
        case 'g': case 'G': gShowGuides = !gShowGuides; break;
        case 'a': case 'A': gShowReflectionAxes = !gShowReflectionAxes; break;
        case 'x': case 'X':
            gSnapConfig.snapToAxis = !gSnapConfig.snapToAxis;
            gSnapConfig.snapToRing = gSnapConfig.snapToAxis;
            break;

        case '+': case '=':
            gViewport = zoomCanvasViewportAtPoint(gViewport, gViewport.zoom * 1.25, canvasCenter, kCanvasSize);
            break;
        case '-': case '_':
            gViewport = zoomCanvasViewportAtPoint(gViewport, gViewport.zoom / 1.25, canvasCenter, kCanvasSize);
            break;
        case '0':
            gViewport = CanvasViewport();
            break;

        case 'u': case 'U':
            if (!gHistory.empty()) {
                gRedoStack.push_back(gHistory.back());
                gHistory.pop_back();
                commitHistoryChanged();
            }
            break;
        case 'y': case 'Y':
            if (!gRedoStack.empty()) {
                gHistory.push_back(gRedoStack.back());
                gRedoStack.pop_back();
                commitHistoryChanged();
            }
            break;
        case 'c': case 'C':
            gHistory.clear();
            gRedoStack.clear();
            commitHistoryChanged();
            break;

        // Starter Bengali Alpona motifs
        case 'm': case 'M':
            gHistory = buildPadmaLotusMotif(kCanvasSize);
            gSymmetry = {8, true};
            commitHistoryChanged();
            break;
        case 'n': case 'N':
            gHistory = buildBoishakhiSunMotif(kCanvasSize);
            gSymmetry = {12, true};
            commitHistoryChanged();
            break;

        // Pigment color palette shortcuts (q, w, e, a, d, z)
        case 'q': gActiveColor = kPalette[0]; break;
        case 'w': gActiveColor = kPalette[1]; break;
        case 'e': gActiveColor = kPalette[2]; break;
        case 'd': gActiveColor = kPalette[4]; break;
        case 'z': gActiveColor = kPalette[5]; break;

        // Exporters: PNG [S], Vector SVG [V], 3D Binary .STL [T]
        case 's': case 'S': {
            std::string filename = "alpona_export_" + std::to_string(gExportCounter++) + ".png";
            if (saveCanvasToPng(gBuffer, filename)) {
                std::cout << "[Alpona Studio] Exported " << filename << std::endl;
            }
            break;
        }
        case 'v': case 'V':
            exportSvgSnapshot();
            break;
        case 't': case 'T':
            exportStlSnapshot();
            break;
        case 27: // ESC
            glutLeaveMainLoop();
            return;
        default:
            return;
    }

    updateWindowTitle();
    glutPostRedisplay();
}

void reshapeCallback(int w, int h) {
    glViewport(0, 0, w, h);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluOrtho2D(0.0, kCanvasSize, 0.0, kCanvasSize);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
}

} // namespace

int main(int argc, char** argv) {
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGBA);
    glutInitWindowSize(kCanvasSize, kCanvasSize);
    glutCreateWindow("Alpona Studio — CSE 401/402 Computer Graphics Lab");

    // Load default Padma Lotus Alpona starter motif via CommittedFrameCache
    gHistory = buildPadmaLotusMotif(kCanvasSize);
    commitHistoryChanged();
    updateWindowTitle();

    glutDisplayFunc(displayCallback);
    glutReshapeFunc(reshapeCallback);
    glutMouseFunc(mouseCallback);
    glutMotionFunc(motionCallback);
    glutKeyboardFunc(keyboardCallback);

    glutMainLoop();
    return 0;
}
