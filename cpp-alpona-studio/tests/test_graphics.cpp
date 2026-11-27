#include "../include/bezier.h"
#include "../include/canvas_assist.h"
#include "../include/canvas_buffer.h"
#include "../include/colorway_remap.h"
#include "../include/desktop_gui.h"
#include "../include/floodfill.h"
#include "../include/frame_cache.h"
#include "../include/frieze_border.h"
#include "../include/generative_composer.h"
#include "../include/homography.h"
#include "../include/image_processing.h"
#include "../include/layer_stack.h"
#include "../include/layer_transform.h"
#include "../include/motifs.h"
#include "../include/natural_media.h"
#include "../include/phong_lighting.h"
#include "../include/photo_unwarper.h"
#include "../include/png_writer.h"
#include "../include/projection3d.h"
#include "../include/projector_trace.h"
#include "../include/rasterizer.h"
#include "../include/stencil_bridger.h"
#include "../include/stl_stamp.h"
#include "../include/stroke_craft.h"
#include "../include/svg_writer.h"
#include "../include/timelapse_frames.h"
#include "../include/transforms.h"
#include "../include/viewport_camera.h"
#include "../include/weave_chart.h"

#include <cassert>
#include <cmath>
#include <fstream>
#include <iostream>

using namespace alpona;

int main() {
    // 1. CORE-1: Bresenham & DDA integer/incremental line drawing
    {
        CanvasBuffer buf(50, 50);
        Color white = {255, 255, 255, 255};
        assert(drawBresenhamLine(buf, 5, 10, 15, 10, white, 1) == 11);
        assert(buf.getPixel(10, 10) == white);
        assert(drawDdaLine(buf, 5, 20, 15, 30, white, 1) == 11);
        assert(buf.getPixel(10, 25) == white);
    }

    // 2. CORE-1/2: Bresenham midpoint circle 8-way symmetry
    {
        CanvasBuffer buf(100, 100);
        Color red = {220, 38, 38, 255};
        assert(drawBresenhamCircle(buf, 50, 50, 20, red, 1) > 100);
        assert(buf.getPixel(70, 50) == red);
        assert(buf.getPixel(30, 50) == red);
        assert(buf.getPixel(50, 70) == red);
        assert(buf.getPixel(50, 30) == red);
    }

    // 3. CORE-2: 2D symmetry & 3x3 homogeneous matrix + inverse
    {
        Point2D center = {100.0, 100.0};
        for (int n : {4, 6, 8, 12}) {
            auto cyclic = generateSymmetricPoints({140.0, 110.0}, center, {n, false});
            assert(static_cast<int>(cyclic.size()) == n);
            auto dihedral = generateSymmetricSegments(
                {120.0, 105.0}, {160.0, 125.0}, center, {n, true}
            );
            assert(static_cast<int>(dihedral.size()) == n * 2);
        }

        Mat3 m = mat3Multiply(mat3Translate(20.0, -10.0), mat3Rotate(0.6));
        m = mat3Multiply(m, mat3Scale(1.25, 0.8));
        Mat3 inv;
        assert(mat3Inverse(m, inv));
        Point2D orig = {42.0, 77.0};
        Point2D rt = applyMat3(inv, applyMat3(m, orig));
        assert(std::fabs(rt.x - orig.x) < 1e-6 && std::fabs(rt.y - orig.y) < 1e-6);
    }

    // 4. CORE-3: Cohen-Sutherland & Liang-Barsky line clipping agreement
    {
        ClipBounds bounds = {20.0, 20.0, 100.0, 100.0};
        Point2D a1 = {0.0, 50.0}, b1 = {140.0, 50.0};
        Point2D a2 = a1, b2 = b1;
        bool clip1 = false, clip2 = false;
        assert(cohenSutherlandClip(a1, b1, bounds, &clip1) && clip1);
        assert(liangBarskyClip(a2, b2, bounds, &clip2) && clip2);
        assert(std::fabs(a1.x - a2.x) < 1e-6 && std::fabs(b1.x - b2.x) < 1e-6);

        Point2D outA = {0.0, 0.0}, outB = {10.0, 120.0};
        assert(!cohenSutherlandClip(outA, outB, bounds));
        assert(!liangBarskyClip(outA, outB, bounds));
    }

    // 5. CORE-3/5: Sutherland-Hodgman polygon clipping
    {
        ClipBounds bounds = {20.0, 20.0, 80.0, 80.0};
        std::vector<Point2D> diamond = {{50, 5}, {70, 50}, {50, 95}, {30, 50}};
        auto clipped = sutherlandHodgmanClip(diamond, bounds);
        assert(clipped.size() >= 4);
        for (const auto& v : clipped) {
            assert(v.x >= 19.999 && v.x <= 80.001 && v.y >= 19.999 && v.y <= 80.001);
        }
    }

    // 6. CORE-1: Iterative Seed Fill containment
    {
        CanvasBuffer buf(40, 40);
        Color black = {0, 0, 0, 255}, white = {255, 255, 255, 255}, gold = {245, 158, 11, 255};
        buf.clear(black);
        drawBresenhamLine(buf, 10, 10, 20, 10, white, 1);
        drawBresenhamLine(buf, 20, 10, 20, 20, white, 1);
        drawBresenhamLine(buf, 20, 20, 10, 20, white, 1);
        drawBresenhamLine(buf, 10, 20, 10, 10, white, 1);
        assert(iterativeSeedFill(buf, 15, 15, gold) == 81);
        assert(buf.getPixel(5, 5) == black);
    }

    // 7. CORE-4/5: 3D Projection (Perspective vs Parallel) & Z-Buffer HSR
    {
        auto mesh = buildAlponaMonumentMesh(8);
        assert(mesh.size() > 20);
        Transform3DParams params;
        Vec3 nearP = projectPoint3D({1.0, 0.0, -0.5}, 300, 300, params);
        Vec3 farP  = projectPoint3D({1.0, 0.0, 1.5}, 300, 300, params);
        assert(nearP.x > farP.x);

        CanvasBuffer buf(180, 160);
        auto stats = render3DScene(buf, mesh, params);
        assert(stats.pixelsShaded > 1500);
        assert(stats.zBufferRejects > 100);
    }

    // 8. CORE-6: Image Point Ops, Spatial Sobel Filter & 2D FFT Frequency Filter
    {
        CanvasBuffer buf(64, 64);
        buf.clear({22, 22, 27, 255});
        drawBresenhamCircle(buf, 32, 32, 18, {250, 248, 242, 255}, 2);

        auto neg = applyNegative(buf);
        assert(neg.getPixel(0, 0).r == static_cast<uint8_t>(255 - 22));

        auto eq = applyHistogramEqualization(buf);
        assert(eq.width() == 64);

        auto sobel = applySpatialFilter(buf, SpatialFilterType::SobelEdge);
        int maxEdge = 0;
        for (int y = 0; y < 64; ++y)
            for (int x = 0; x < 64; ++x)
                maxEdge = std::max(maxEdge, static_cast<int>(sobel.getPixel(x, y).r));
        assert(maxEdge > 150);

        auto freq = applyFrequencyFilter(buf, FrequencyFilterType::GaussianLowPass, 16.0, 64);
        assert(freq.width() == 64 && freq.height() == 64);
    }

    // 9. Bengali Alpona starter motif & PNG writer
    {
        CanvasBuffer buf(240, 240);
        buf.clear({22, 22, 27, 255});
        for (const auto& op : buildPadmaLotusMotif(240)) {
            executeOperation(buf, op);
        }
        const std::string outPath = "/tmp/alpona_test_out.png";
        assert(saveCanvasToPng(buf, outPath));
        std::ifstream f(outPath, std::ios::binary);
        char sig[8] = {};
        f.read(sig, 8);
        assert(static_cast<uint8_t>(sig[0]) == 137 && sig[1] == 'P' && sig[2] == 'N' && sig[3] == 'G');
    }

    // 10. CORE-3/5: Weiler-Atherton concave polygon clipping splits U-polygon cleanly
    {
        ClipBounds bounds = {20.0, 20.0, 80.0, 80.0};
        std::vector<Point2D> concaveU = {
            {28, 5}, {72, 5}, {72, 65}, {58, 65},
            {58, 12}, {42, 12}, {42, 65}, {28, 65}
        };
        auto split = weilerAthertonClip(concaveU, bounds);
        assert(split.size() >= 2);
        for (const auto& poly : split) {
            assert(poly.size() >= 3);
            for (const auto& v : poly) {
                assert(v.x >= 19.999 && v.x <= 80.001 && v.y >= 19.999 && v.y <= 80.001);
            }
        }
    }

    // 11. CORE-6: Pixel Topology (N4, N8, D4, D8, De, BFS) & Printable Stencil
    {
        CanvasBuffer buf(32, 32);
        buf.clear({16, 16, 20, 255});
        drawBresenhamLine(buf, 6, 6, 14, 14, {255, 255, 255, 255}, 1);
        auto pm = computePixelRelationships(buf, 6, 6, 9, 9, 20);
        assert(pm.d4CityBlock == 6);
        assert(pm.d8Chessboard == 3);
        assert(std::fabs(pm.deEuclidean - 4.24264) < 0.01);
        assert(pm.n4Count == 4 && pm.n8Count == 8);
        assert(pm.connected8Path && !pm.connected4Path);

        auto stencil = extractPrintableStencil(buf, 40);
        bool hasInk = false, hasPaper = false;
        for (int y = 0; y < 32; ++y) {
            for (int x = 0; x < 32; ++x) {
                uint8_t v = stencil.getPixel(x, y).r;
                assert(v == 20 || v == 255);
                if (v == 20) hasInk = true;
                if (v == 255) hasPaper = true;
            }
        }
        assert(hasInk && hasPaper);
    }

    // 12. CORE-4/5: 3D Courtyard Floor Texture Projection & Near-Plane Frustum Clipping
    {
        CanvasBuffer tex(64, 64);
        tex.clear({43, 22, 21, 255});
        drawBresenhamCircle(tex, 32, 32, 22, {250, 248, 242, 255}, 2);

        CanvasBuffer out(200, 180);
        Transform3DParams normalP;
        normalP.rotXDeg = 38.0;
        normalP.rotYDeg = 28.0;
        normalP.focalLength = 2.8;
        auto resNormal = render3DCourtyardFloor(out, tex, normalP);
        assert(resNormal.pixelsShaded > 2500);
        assert(resNormal.anomalyVerticesCount == 0);

        Transform3DParams anomalyP = normalP;
        anomalyP.scale = 1.25;
        anomalyP.focalLength = 0.72;
        anomalyP.allowCopAnomaly = true;
        auto resAnom = render3DCourtyardFloor(out, tex, anomalyP);
        assert(resAnom.anomalyVerticesCount > 0);
    }

    // 13. Parametric Cubic Bezier & de Casteljau Subdivision
    {
        Point2D p0 = {10.0, 10.0}, p1 = {40.0, 80.0}, p2 = {80.0, 80.0}, p3 = {110.0, 10.0};
        Point2D ev = evaluateCubicBezier(p0, p1, p2, p3, 0.5);
        DeCasteljauFrame dc = deCasteljauSubdivision(p0, p1, p2, p3, 0.5);
        assert(std::fabs(ev.x - dc.point.x) < 1e-6 && std::fabs(ev.y - dc.point.y) < 1e-6);

        CanvasBuffer buf(160, 160);
        buf.clear({22, 22, 27, 255});
        int written = drawSymmetricCubicBezier(buf, {80, 40}, {108, 30}, {100, 16}, {84, 14}, SymmetryConfig(8, true), {250, 248, 242, 255}, 2, 20);
        assert(written > 100);
    }

    // 14. Zero-Dependency Vector SVG Writer
    {
        SvgWriter svg(720, 720, "#16161B");
        svg.addCircle({360, 360}, 120, "#FAF8F2", 3);
        svg.addCubicBezier({360, 240}, {410, 200}, {400, 150}, {360, 140}, "#DC2626", 3);
        std::string xml = svg.str();
        assert(xml.find("<svg ") != std::string::npos);
        assert(xml.find(" C ") != std::string::npos);
        assert(xml.find("</svg>") != std::string::npos);
    }

    // 15. CORE-6 Binary Mathematical Morphology Closing (Micro-Gap Sealer)
    {
        CanvasBuffer buf(32, 32);
        buf.clear({16, 16, 20, 255});
        drawBresenhamLine(buf, 4, 16, 14, 16, {255, 255, 255, 255}, 1);
        drawBresenhamLine(buf, 17, 16, 27, 16, {255, 255, 255, 255}, 1);
        assert(buf.getPixel(15, 16).r == 16);
        MorphologyMetrics mm = {};
        CanvasBuffer closed = applyMorphology(buf, MorphologyOpType::Close, 2, 70, &mm);
        assert(mm.gapsBridged >= 2);
        assert(closed.getPixel(15, 16).r == 220);
    }

    // 16. 4-Corner 3x3 Projective Homography Try-On & Chalk Blueprint Chord Math
    {
        HomographyQuad quad = {{120, 90}, {260, 100}, {310, 240}, {70, 230}};
        HomographyResult hom = solveHomographyFromUnitSquare(quad);
        assert(hom.valid);
        Point2D mappedBR = applyHomography(hom.h, 1.0, 1.0);
        assert(std::fabs(mappedBR.x - quad.br.x) < 1e-4 && std::fabs(mappedBR.y - quad.br.y) < 1e-4);

        CanvasBuffer floor(340, 260);
        floor.clear({118, 72, 58, 255});
        CanvasBuffer tex(64, 64);
        tex.clear({22, 22, 27, 255});
        drawBresenhamCircle(tex, 32, 32, 20, {250, 248, 242, 255}, 2);
        CanvasBuffer comp(340, 260);
        int warped = renderVirtualFloorTryOn(floor, tex, quad, comp, 0.9);
        assert(warped > 5000);

        auto rings = computeChalkBlueprintRings(200.0, 6);
        assert(rings.size() == 4);
        assert(std::fabs(rings[3].sectorChordCm - 100.0) < 0.2);
    }

    // 17. 2x2 Supersampling Anti-Aliasing (SSAA) Box Filter
    {
        CanvasBuffer hi(4, 4);
        hi.clear({0, 0, 0, 255});
        hi.setPixel(0, 0, {255, 255, 255, 255});
        hi.setPixel(1, 0, {255, 255, 255, 255});
        CanvasBuffer ssaa = downsample2xSSAA(hi);
        assert(ssaa.width() == 2 && ssaa.height() == 2);
        assert(ssaa.getPixel(0, 0).r == 128);
    }

    // 18. Street-Photo Alpona Unwarper & Polar Symmetry Detector
    {
        CanvasBuffer flat(96, 96);
        flat.clear({24, 24, 28, 255});
        // Draw 8 symmetric spokes around center so polar autocorrelation peaks at 8
        for (int k = 0; k < 8; ++k) {
            const double ang = (2.0 * 3.14159265358979323846 * k) / 8.0;
            const int x1 = static_cast<int>(48 + 36 * std::cos(ang));
            const int y1 = static_cast<int>(48 + 36 * std::sin(ang));
            drawBresenhamLine(flat, 48, 48, x1, y1, {250, 248, 242, 255}, 2);
        }
        SymmetryReport rep = detectRotationalSymmetryOrder(flat);
        assert(rep.detectedSectors == 8);
        assert(rep.confidencePercent >= 60);

        HomographyQuad fullQuad = {{0, 0}, {95, 0}, {95, 95}, {0, 95}};
        CanvasBuffer rect = rectifyPhotoQuad(flat, fullQuad, 64);
        assert(rect.width() == 64 && rect.height() == 64);
        CanvasBuffer restored = restoreRotationalSymmetry(rect, 8, true);
        assert(restored.width() == 64 && restored.height() == 64);
    }

    // 19. Phong / Gouraud Night-Courtyard Diya Lighting & Sobel Relief Normals
    {
        CanvasBuffer art(48, 48);
        art.clear({20, 20, 24, 255});
        drawBresenhamCircle(art, 24, 24, 14, {250, 248, 242, 255}, 2);
        std::vector<DiyaLight> lights;
        lights.push_back({0.2, 0.2, 0.16, 1.0, 0.72, 0.34, 1.2});
        PhongMaterial phongMat = {0.22, 0.95, 0.45, 22.0, 2.2, DiyaShadingModel::Phong};
        CanvasBuffer litPhong = renderPhongDiyaLighting(art, {20, 20, 24, 255}, lights, phongMat);
        assert(litPhong.width() == 48 && litPhong.height() == 48);
        // Pixel near the top-left diya must be warmer/brighter than far corner
        assert(litPhong.getPixel(10, 10).r > litPhong.getPixel(44, 44).r);

        PhongMaterial gouraudMat = phongMat;
        gouraudMat.model = DiyaShadingModel::Gouraud;
        CanvasBuffer litGouraud = renderPhongDiyaLighting(art, {20, 20, 24, 255}, lights, gouraudMat);
        assert(litGouraud.getPixel(10, 10).r > litGouraud.getPixel(44, 44).r);
    }

    // 20. Darkroom Projector & Step-by-Step Floor Tracing Stage Partitioning
    {
        std::vector<PrimitiveKind> ops = {
            PrimitiveKind::Circle,
            PrimitiveKind::Circle,
            PrimitiveKind::Line,
            PrimitiveKind::Polygon,
            PrimitiveKind::Bezier,
            PrimitiveKind::Fill
        };
        auto counts = countOperationsPerStage(ops);
        assert(counts[0] == 2); // Stage 1: Circles
        assert(counts[1] == 2); // Stage 2: Line + Polygon
        assert(counts[2] == 1); // Stage 3: Bezier
        assert(counts[3] == 1); // Stage 4: Fill
    }

    // 21. Parametric HD Timelapse Reel Frame Interpolation
    {
        ReelProgress p = computeReelProgress(10, 0.25);
        assert(p.completedCount == 2);
        assert(p.activeIndex == 2);
        assert(std::fabs(p.activeT - 0.5) < 1e-6);

        Point2D mid = samplePartialLineEnd({0, 0}, {100, 50}, 0.5);
        assert(std::fabs(mid.x - 50.0) < 1e-6 && std::fabs(mid.y - 25.0) < 1e-6);

        auto arc = samplePartialCircleArc({50, 50}, 20.0, 0.5, 40);
        assert(arc.size() >= 10);
    }

    // 22. Saree Paar Frieze Border Studio (7 Frieze Groups + Polar Unwrap + 90-deg Miter Corner)
    {
        CanvasBuffer art(96, 96);
        art.clear({22, 22, 27, 255});
        drawBresenhamCircle(art, 48, 48, 34, {250, 248, 242, 255}, 3);
        double uOut = 0.0, vOut = 0.0;
        mapFriezeCoordinates(FriezeGroup::P11G, 1, 0.25, 0.2, uOut, vOut);
        assert(std::fabs(vOut - 0.8) < 1e-6);

        CanvasBuffer tile = unwrapAlponaRingToTile(art, 48, 36, 0.3, 0.9, 8);
        assert(tile.width() == 48 && tile.height() == 36);
        CanvasBuffer strip = renderFriezeStrip(tile, FriezeGroup::P2MM, 4, true, {245, 158, 11, 255});
        assert(strip.width() == 48 * 4 && strip.height() > 36);
        CanvasBuffer corner = renderMiteredCorner90(strip, 160, {74, 29, 26, 255});
        assert(corner.width() == 160 && corner.height() == 160);
    }

    // 23. Laser/Cricut Stencil Island Detector (BFS) & Shortest-Distance Auto-Bridger
    {
        CanvasBuffer art(84, 84);
        art.clear({22, 22, 27, 255});
        drawBresenhamCircle(art, 42, 42, 30, {250, 248, 242, 255}, 3);
        drawBresenhamCircle(art, 42, 42, 14, {250, 248, 242, 255}, 3);
        StencilBridgeAnalysis analysis = analyzeAndBridgeStencil(art, 6, true, 44);
        assert(analysis.initialIslandCount >= 2);
        assert(analysis.remainingIslandCount == 0);
        assert(analysis.bridges.size() >= 2);
    }

    // 24. Photo K-Means Colorway Quantization & Stroke Remapper
    {
        CanvasBuffer photo(32, 32);
        for (int y = 0; y < 32; ++y) {
            for (int x = 0; x < 32; ++x) {
                photo.setPixel(x, y, x < 16 ? Color{200, 24, 36, 255} : Color{245, 180, 20, 255});
            }
        }
        auto pal = extractKMeansPalette(photo, 2);
        assert(pal.size() == 2);
        std::vector<Color> strokes = {{255, 255, 255, 255}, {255, 255, 255, 255}, {10, 10, 10, 255}};
        auto remapped = remapStrokeColorway(strokes, pal);
        assert(remapped.size() == 3);
        assert(remapped[0] == pal[0] && remapped[2] == pal[1]);
    }

    // 25. Chaikin Stroke Stabilizer & Tapered Rice-Paste Calligraphy Brush
    {
        std::vector<Point2D> shaky = {{10, 50}, {30, 20}, {50, 80}, {70, 25}, {90, 50}};
        auto smooth = stabilizeStrokePoints(shaky, 2);
        assert(smooth.size() > shaky.size());
        assert(std::fabs(smooth.front().x - 10.0) < 1e-6);
        assert(std::fabs(smooth.back().x - 90.0) < 1e-6);

        auto arc = computePolylineArcParameters(smooth);
        assert(std::fabs(arc.front()) < 1e-6);
        assert(std::fabs(arc.back() - 1.0) < 1e-6);

        int tipW = computeRicePasteTaperThickness(6, 0.0);
        int midW = computeRicePasteTaperThickness(6, 0.5);
        assert(midW > tipW * 2);
    }

    // 26. 3D Pitha Mold & Woodblock Stamp .STL/.OBJ Relief Generator
    {
        CanvasBuffer art(96, 96);
        art.clear({24, 24, 27, 255});
        drawBresenhamCircle(art, 48, 48, 30, {250, 248, 242, 255}, 4);

        StlStampOptions opts;
        opts.gridSize = 32;
        opts.mode = StampPresetMode::WoodblockStamp;
        StampHeightfield hf = buildStampHeightfield(art, {24, 24, 27, 255}, opts);
        assert(hf.activeCells > 400);
        assert(hf.maxZ > hf.minZ + 1.0f);

        StampMeshSummary mesh = generateStampMesh(hf, opts);
        assert(mesh.triangleCount > 1500);
        assert(mesh.estimatedVolumeCm3 > 5.0);

        std::vector<uint8_t> stl = serializeBinaryStl(mesh);
        assert(stl.size() == 84 + mesh.triangleCount * 50);

        std::string obj = serializeAsciiObj(mesh);
        assert(obj.find("o AlponaStamp") != std::string::npos);

        CanvasBuffer preview = renderStampTurntablePreview(hf, opts, 30.0, 42.0, 140, 110);
        assert(preview.width() == 140 && preview.height() == 110);
    }

    // 27. Jamdani Handloom & Nakshi Kantha Weave Chart Generator
    {
        CanvasBuffer art(96, 96);
        art.clear({27, 40, 69, 255});
        drawBresenhamCircle(art, 48, 48, 34, {250, 246, 238, 255}, 4);
        drawBresenhamCircle(art, 48, 48, 18, {234, 179, 8, 255}, 3);

        WeaveChartOptions opts;
        opts.gridSize = 40;
        opts.maxColors = 5;
        opts.ditherMode = WeaveDitherMode::FloydSteinberg;
        opts.palettePreset = WeavePalettePreset::JamdaniZari;
        WeaveChartResult chart = buildWeaveChart(art, opts);
        assert(chart.gridSize == 40);
        assert(chart.totalStitches == 1600);
        assert(chart.threads.size() == 5);
        int stitchSum = 0;
        for (size_t i = 0; i < chart.threads.size(); ++i) {
            stitchSum += chart.threads[i].stitchCount;
        }
        assert(stitchSum == 1600);

        std::string csv = exportWeaveChartCsv(chart);
        assert(csv.find("Jamdani / Nakshi Kantha Weave Chart (40x40)") != std::string::npos);
    }

    // 28. Procedural Lata-Pata L-System, Phyllotaxis & Rhodonea Composer
    {
        std::map<char, std::string> rules;
        rules['F'] = "F[+F][-F]F";
        std::string expanded = expandLSystem("F", rules, 2);
        assert(expanded.size() > 25);

        ProceduralAlponaConfig cfg;
        cfg.seed = 2026;
        cfg.sectors = 8;
        ProceduralComposeResult res = composeProceduralAlpona(160, cfg);
        assert(res.phyllotaxisDots >= 16);
        assert(res.lSystemAxiomLength > 25);
        assert(res.polylines.size() == 2);
        assert(!res.lines.empty());

        CanvasBuffer surf(160, 160);
        surf.clear({24, 24, 27, 255});
        rasterizeProceduralAlpona(surf, res);
        int litPixels = 0;
        for (int y = 0; y < 160; ++y) {
            for (int x = 0; x < 160; ++x) {
                if (surf.getPixel(x, y).r > 100) litPixels++;
            }
        }
        assert(litPixels > 300);
    }

    // 29. Natural Media Chaler Guro & Mati Courtyard NPR Renderer
    {
        double n1 = fbm2D(3.25, 7.5);
        double n2 = fbm2D(3.25, 7.5);
        assert(std::fabs(n1 - n2) < 1e-12);
        assert(n1 >= 0.0 && n1 <= 1.0);

        CanvasBuffer art(80, 80);
        art.clear({24, 24, 27, 255});
        drawBresenhamCircle(art, 40, 40, 22, {250, 248, 242, 255}, 3);

        NaturalMediaOptions matiOpts;
        matiOpts.substrate = NaturalSubstrateId::MatiMud;
        CanvasBuffer mati = renderNaturalMediaAlpona(art, {24, 24, 27, 255}, matiOpts);
        Color corner = mati.getPixel(0, 0);
        assert(corner.r > corner.g && corner.g > corner.b);

        NaturalMediaOptions cottonOpts;
        cottonOpts.substrate = NaturalSubstrateId::TantCotton;
        CanvasBuffer cotton = renderNaturalMediaAlpona(art, {24, 24, 27, 255}, cottonOpts);
        Color strokePx = cotton.getPixel(62, 40);
        assert(strokePx.r > strokePx.g + 50);
    }

    // 30. Symmetry Reflection Axes, Magnetic Snap-to-Axis, Guide Rings & Compass Arc Lock
    {
        auto d4Axes = computeSymmetryReflectionAxes(720, {4, true});
        assert(d4Axes.size() == 4);
        assert(d4Axes[0].isReflectionMirror && std::fabs(d4Axes[1].angleDeg - 45.0) < 1e-6);

        auto c6Axes = computeSymmetryReflectionAxes(720, {6, false});
        assert(c6Axes.size() == 6 && !c6Axes[0].isReflectionMirror);

        SnapConfig cfg;
        SnapResult both = snapPointToSymmetryGuides({596.0, 364.0}, 720, {8, true}, cfg);
        assert(both.wasSnapped && both.hasSnappedAxis && both.hasSnappedRing);
        assert(std::fabs(both.snappedAxisAngleDeg - 0.0) < 1e-6);
        assert(std::fabs(both.snappedRingRadius - 240.0) < 1e-6);
        assert(std::fabs(both.point.x - 600.0) < 1e-6 && std::fabs(both.point.y - 360.0) < 1e-6);

        SnapConfig lockCfg;
        lockCfg.snapToAxis = false;
        lockCfg.compassArcLock = true;
        SnapResult locked = snapPointToSymmetryGuides({510.0, 420.0}, 720, {8, true}, lockCfg, 185.0);
        assert(locked.wasSnapped && locked.hasLockedRadius);
        double dLock = std::hypot(locked.point.x - 360.0, locked.point.y - 360.0);
        assert(std::fabs(dLock - 185.0) <= 1.2);
    }

    // 31. Interactive Stroke Layer Stack & Symmetric Hit-Test Eraser
    {
        std::vector<LayerStrokeOp> stack;

        LayerStrokeOp ring;
        ring.id = 101;
        ring.kind = LayerOpKind::Circle;
        ring.p0 = {360.0, 360.0};
        ring.radius = 180.0;
        ring.thickness = 3;
        ring.symmetry = {1, false};
        stack.push_back(ring);

        LayerStrokeOp spoke;
        spoke.id = 102;
        spoke.kind = LayerOpKind::Line;
        spoke.p0 = {360.0, 180.0};
        spoke.p1 = {360.0, 260.0};
        spoke.thickness = 3;
        spoke.symmetry = {4, false};
        stack.push_back(spoke);

        // Hit-test symmetric 90-deg copy of spoke
        assert(hitTestLayerAtPoint(stack, {500.0, 360.0}, 720, 14.0) == 102);
        // Topmost layer wins at shared point (360, 180)
        assert(hitTestLayerAtPoint(stack, {360.0, 180.0}, 720, 14.0) == 102);

        // Hide topmost layer -> underlying ring is hit
        assert(toggleLayerVisibility(stack, 102));
        assert(hitTestLayerAtPoint(stack, {360.0, 180.0}, 720, 14.0) == 101);

        // Reorder, recolor, and delete
        assert(moveLayerOrder(stack, 101, true));
        assert(stack.back().id == 101);
        assert(recolorLayer(stack, 101, {245, 158, 11, 255}));
        assert(stack.back().color.r == 245);
        assert(deleteLayerById(stack, 102));
        assert(stack.size() == 1 && stack[0].id == 101);
    }

    // 32. Precision Canvas Zoom (1x-4x), Pan & Exact Screen-to-Canvas Inversion
    {
        StageRect rect = {100.0, 80.0, 600.0, 600.0};
        CanvasViewport defVp;
        CanvasViewport clamped = clampCanvasViewport(CanvasViewport(7.0, 999.0, -999.0), 720);
        assert(std::fabs(clamped.zoom - 4.0) < 1e-6);
        assert(std::fabs(clamped.panX - 270.0) < 1e-6 && std::fabs(clamped.panY + 270.0) < 1e-6);

        Point2D anchor = {480.0, 260.0};
        Point2D normBefore = canvasToStageNormalized(anchor, defVp, 720);
        CanvasViewport zoomed = zoomCanvasViewportAtPoint(defVp, 2.5, anchor, 720);
        Point2D normAfter = canvasToStageNormalized(anchor, zoomed, 720);
        assert(std::fabs(normBefore.x - normAfter.x) < 1e-6);
        assert(std::fabs(normBefore.y - normAfter.y) < 1e-6);

        CanvasViewport panned = panCanvasViewportByScreenDelta(zoomed, 45.0, -30.0, rect.width, 720);
        Point2D target = {412.0, 318.0};
        Point2D proj = canvasToStageNormalized(target, panned, 720);
        Point2D inv = screenToCanvasWithViewport(
            rect.left + proj.x * rect.width,
            rect.top + proj.y * rect.height,
            rect,
            panned,
            720
        );
        assert(std::fabs(inv.x - target.x) < 1e-6 && std::fabs(inv.y - target.y) < 1e-6);
    }

    // 33. CommittedFrameCache: Base pixel reuse, preview composition & pixel parity
    {
        std::vector<DrawOperation> motif = buildPadmaLotusMotif(180);
        Color bg = {22, 22, 27, 255};
        DrawOperation preview;
        preview.kind = ToolKind::Line;
        preview.p0 = {90.0, 20.0};
        preview.p1 = {150.0, 90.0};
        preview.color = {245, 158, 11, 255};
        preview.thickness = 2;
        preview.symmetry = {8, true};

        CommittedFrameCache cache;
        CanvasBuffer cachedBuf(180, 180);
        cache.render(cachedBuf, bg, motif, 1, nullptr);
        assert(cache.fullRebuilds() == 1 && cache.cacheHits() == 0);

        cache.render(cachedBuf, bg, motif, 1, &preview);
        cache.render(cachedBuf, bg, motif, 1, &preview);
        assert(cache.fullRebuilds() == 1 && cache.cacheHits() == 2);

        CanvasBuffer refBuf(180, 180);
        refBuf.clear(bg);
        for (size_t i = 0; i < motif.size(); ++i) executeOperation(refBuf, motif[i]);
        executeOperation(refBuf, preview);
        for (int y = 0; y < 180; ++y) {
            for (int x = 0; x < 180; ++x) {
                assert(cachedBuf.getPixel(x, y) == refBuf.getPixel(x, y));
            }
        }
    }

    // 34. Stylus Pressure + Chaler Guro Taper Parity
    {
        assert(computePressureTaperThickness(6, 0.5, 0.5, true) ==
               computeRicePasteTaperThickness(6, 0.5));
        int lightPx = computePressureTaperThickness(6, 0.5, 0.15, true);
        int heavyPx = computePressureTaperThickness(6, 0.5, 0.95, true);
        assert(heavyPx > lightPx + 3);
    }

    // 35. Named Layer Groups & Post-Placement Cubic Bezier Control-Point Editing
    {
        std::vector<LayerStrokeOp> stack;
        LayerStrokeOp coreRing;
        coreRing.id = 201;
        coreRing.kind = LayerOpKind::Circle;
        coreRing.p0 = {360.0, 360.0};
        coreRing.radius = 60.0;
        coreRing.group = "Core";
        stack.push_back(coreRing);

        LayerStrokeOp bez;
        bez.id = 202;
        bez.kind = LayerOpKind::Bezier;
        bez.p0 = {360.0, 200.0};
        bez.p1 = {420.0, 180.0};
        bez.p2 = {460.0, 240.0};
        bez.p3 = {440.0, 300.0};
        bez.symmetry = {8, true};
        bez.group = "Motifs";
        stack.push_back(bez);

        assert(assignLayerGroup(stack, 202, "Border"));
        assert(stack[1].group == "Border");
        assert(toggleGroupVisibility(stack, "Core") == 1);
        assert(stack[0].hidden == true);
        assert(toggleGroupVisibility(stack, "Core") == 1);
        assert(stack[0].hidden == false);

        assert(updateBezierControlPoint(stack, 202, BezierHandle::P1, {480.0, 140.0}));
        assert(std::fabs(stack[1].p1.x - 480.0) < 1e-6 && std::fabs(stack[1].p1.y - 140.0) < 1e-6);
    }

    // 36. Porter-Duff Source-Over Alpha Blending in CanvasBuffer::setPixel
    {
        CanvasBuffer buf(40, 40);
        buf.clear({0, 0, 0, 255});
        buf.setPixel(20, 20, {255, 255, 255, 128});
        Color px = buf.getPixel(20, 20);
        assert(px.r >= 124 && px.r <= 132);
        assert(px.g == px.r && px.b == px.r && px.a == 255);
    }

    // 37. Layer Lock Protection & Per-Layer Opacity + Eraser skipLocked Guard
    {
        std::vector<LayerStrokeOp> stack;
        LayerStrokeOp bez;
        bez.id = 301;
        bez.kind = LayerOpKind::Bezier;
        bez.p0 = {360.0, 200.0};
        bez.p1 = {400.0, 180.0};
        bez.p2 = {440.0, 220.0};
        bez.p3 = {360.0, 260.0};
        bez.color = {220, 38, 38, 255};
        bez.symmetry = {1, false};
        stack.push_back(bez);

        assert(toggleLayerLock(stack, 301));
        assert(stack[0].locked == true);
        assert(!recolorLayer(stack, 301, {245, 158, 11, 255}));
        assert(!setLayerOpacity(stack, 301, 0.4));
        assert(!deleteLayerById(stack, 301));
        assert(!updateBezierControlPoint(stack, 301, BezierHandle::P1, {500.0, 120.0}));
        assert(hitTestLayerAtPoint(stack, {360.0, 200.0}, 720, 14.0, true) == -1);
        assert(hitTestLayerAtPoint(stack, {360.0, 200.0}, 720, 14.0, false) == 301);

        assert(toggleLayerLock(stack, 301));
        assert(setLayerOpacity(stack, 301, 0.55));
        assert(std::fabs(stack[0].opacity - 0.55) < 1e-6);
        assert(deleteLayerById(stack, 301));
        assert(stack.empty());
    }

    // 38. Universal Layer Transform (Bounds, Translate, Scale, Rotate + Lock Guard)
    {
        LayerStrokeOp circle;
        circle.id = 401;
        circle.kind = LayerOpKind::Circle;
        circle.p0 = {360.0, 240.0};
        circle.radius = 40.0;
        circle.symmetry = {8, true};

        LayerBounds b = computeLayerBounds(circle);
        assert(std::fabs(b.cx - 360.0) < 1e-6 && std::fabs(b.cy - 240.0) < 1e-6);
        assert(std::fabs(b.width - 80.0) < 1e-6);

        LayerStrokeOp moved = translateLayerOp(circle, 25.0, -15.0);
        assert(std::fabs(moved.p0.x - 385.0) < 1e-6 && std::fabs(moved.p0.y - 225.0) < 1e-6);

        LayerStrokeOp scaled = scaleLayerOpAroundPoint(circle, 1.5, {360.0, 240.0});
        assert(std::fabs(scaled.radius - 60.0) < 1e-6);

        LayerStrokeOp line;
        line.id = 402;
        line.kind = LayerOpKind::Line;
        line.p0 = {400.0, 360.0};
        line.p1 = {460.0, 360.0};
        LayerStrokeOp rotated = rotateLayerOpAroundPoint(line, 3.14159265358979323846 / 2.0, {430.0, 360.0});
        assert(std::fabs(rotated.p0.x - 430.0) < 1e-5 && std::fabs(rotated.p0.y - 330.0) < 1e-5);
        assert(std::fabs(rotated.p1.x - 430.0) < 1e-5 && std::fabs(rotated.p1.y - 390.0) < 1e-5);

        // Locked op stays immutable under translate/scale/rotate
        circle.locked = true;
        LayerStrokeOp lockedMove = translateLayerOp(circle, 50.0, 50.0);
        assert(std::fabs(lockedMove.p0.x - 360.0) < 1e-6);
    }

    // 39. Horizontal & Vertical Mirror Flip (mat3Reflect + mirrorLayerOp + Lock Guard)
    {
        Mat3 mx = mat3Reflect(true, false);
        Mat3 my = mat3Reflect(false, true);
        Point2D p = {40.0, -25.0};
        Point2D px = applyMat3(mx, p);
        Point2D py = applyMat3(my, p);
        assert(std::fabs(px.x - (-40.0)) < 1e-6 && std::fabs(px.y - (-25.0)) < 1e-6);
        assert(std::fabs(py.x - 40.0) < 1e-6 && std::fabs(py.y - 25.0) < 1e-6);

        LayerStrokeOp bez;
        bez.id = 501;
        bez.kind = LayerOpKind::Bezier;
        bez.p0 = {400.0, 200.0};
        bez.p1 = {440.0, 180.0};
        bez.p2 = {480.0, 220.0};
        bez.p3 = {420.0, 260.0};
        bez.symmetry = {1, false};

        LayerStrokeOp bezH = mirrorLayerOp(bez, true, false, {360.0, 360.0});
        assert(std::fabs(bezH.p0.x - 320.0) < 1e-6 && std::fabs(bezH.p0.y - 200.0) < 1e-6);
        assert(std::fabs(bezH.p1.x - 280.0) < 1e-6 && std::fabs(bezH.p2.x - 240.0) < 1e-6);

        LayerStrokeOp bezV = mirrorLayerOp(bez, false, true, {360.0, 360.0});
        assert(std::fabs(bezV.p0.x - 400.0) < 1e-6 && std::fabs(bezV.p0.y - 520.0) < 1e-6);
        assert(std::fabs(bezV.p3.y - 460.0) < 1e-6);

        bez.locked = true;
        LayerStrokeOp lockedFlip = mirrorLayerOp(bez, true, true, {360.0, 360.0});
        assert(std::fabs(lockedFlip.p0.x - 400.0) < 1e-6 && std::fabs(lockedFlip.p0.y - 200.0) < 1e-6);
    }

    // 40. Grouped Layer Stack Sections & Collapse/Expand Category Parity
    {
        std::vector<LayerStrokeOp> stack;
        LayerStrokeOp a; a.id = 1; a.group = "Core"; a.hidden = false; a.locked = true;
        LayerStrokeOp b; b.id = 2; b.group = "Petals"; b.hidden = true;
        LayerStrokeOp c; c.id = 3; c.group = "Core"; c.hidden = false;
        LayerStrokeOp d; d.id = 4; d.group = "Border"; d.hidden = false;
        stack.push_back(a);
        stack.push_back(b);
        stack.push_back(c);
        stack.push_back(d);

        std::vector<std::string> collapsed = {"Border", "Petals"};
        std::vector<LayerGroupSummary> sections = buildLayerGroupSections(stack, collapsed);
        assert(sections.size() == 3);
        // Ordered by highest z-index descending: Border (idx 3), Core (idx 2), Petals (idx 1)
        assert(sections[0].name == "Border" && sections[0].collapsed == true && sections[0].total == 1);
        assert(sections[1].name == "Core" && sections[1].collapsed == false && sections[1].total == 2 && sections[1].locked == 1);
        assert(sections[1].layerIds.size() == 2 && sections[1].layerIds[0] == 3 && sections[1].layerIds[1] == 1);
        assert(sections[2].name == "Petals" && sections[2].collapsed == true && sections[2].visible == 0);
    }

    // 41. Group Select Tool Parity (selectGroupAtPoint across symmetric copies, hidden skip & miss)
    {
        std::vector<LayerStrokeOp> stack;

        LayerStrokeOp coreRing;
        coreRing.id = 10;
        coreRing.kind = LayerOpKind::Circle;
        coreRing.p0 = {360.0, 360.0};
        coreRing.radius = 50.0;
        coreRing.symmetry = {1, false};
        coreRing.group = "Core";

        LayerStrokeOp borderRing;
        borderRing.id = 20;
        borderRing.kind = LayerOpKind::Circle;
        borderRing.p0 = {360.0, 360.0};
        borderRing.radius = 240.0;
        borderRing.symmetry = {1, false};
        borderRing.group = "Border";

        LayerStrokeOp borderSpoke;
        borderSpoke.id = 21;
        borderSpoke.kind = LayerOpKind::Line;
        borderSpoke.p0 = {360.0, 120.0};
        borderSpoke.p1 = {360.0, 160.0};
        borderSpoke.symmetry = {4, false};
        borderSpoke.group = "Border";

        LayerStrokeOp hiddenTop;
        hiddenTop.id = 30;
        hiddenTop.kind = LayerOpKind::Circle;
        hiddenTop.p0 = {360.0, 360.0};
        hiddenTop.radius = 50.0;
        hiddenTop.symmetry = {1, false};
        hiddenTop.group = "Petals";
        hiddenTop.hidden = true;

        stack.push_back(coreRing);
        stack.push_back(borderRing);
        stack.push_back(borderSpoke);
        stack.push_back(hiddenTop);

        // Clicking 90-degree symmetric copy of borderSpoke (580, 360) selects ALL Border ops (20 & 21)
        GroupSelectionResult borderSel = selectGroupAtPoint(stack, {580.0, 360.0}, 720, 18.0);
        assert(borderSel.groupName == "Border");
        assert(borderSel.hitLayerId == 21);
        assert(borderSel.layerIds.size() == 2 && borderSel.layerIds[0] == 20 && borderSel.layerIds[1] == 21);

        // Clicking inner ring skips hiddenTop ("Petals") and selects "Core"
        GroupSelectionResult coreSel = selectGroupAtPoint(stack, {410.0, 360.0}, 720, 18.0);
        assert(coreSel.groupName == "Core");
        assert(coreSel.hitLayerId == 10);
        assert(coreSel.layerIds.size() == 1 && coreSel.layerIds[0] == 10);

        // Clicking empty canvas corner returns empty miss result
        GroupSelectionResult miss = selectGroupAtPoint(stack, {20.0, 20.0}, 720, 18.0);
        assert(miss.groupName.empty() && miss.hitLayerId == -1 && miss.layerIds.empty());
    }

    // 42. Code::Blocks OpenGL Desktop Studio GUI Layout, Button Hit-Testing & Stage Coordinate Mapping
    {
        DesktopGuiLayout layout;
        assert(layout.windowWidth == 1000 && layout.windowHeight == 796);
        assert(layout.canvasX == 270 && layout.canvasY == 48 && layout.canvasSize == 720);

        std::vector<DesktopGuiButton> buttons = buildDesktopGuiButtons(layout);
        assert(buttons.size() == 37);

        // Hit-test Top Toolbar "Brush" button (270..334, 7..35)
        DesktopGuiHitResult hitBrush = hitTestDesktopGui(285, 20, layout);
        assert(hitBrush.hitGui == true && hitBrush.hitCanvas == false);
        assert(hitBrush.buttonId == DesktopButtonId::ToolFreehand);
        assert(hitBrush.buttonLabel == "Brush");

        // Hit-test Top Toolbar "Save PNG" CTA button (748..828, 7..35)
        DesktopGuiHitResult hitExport = hitTestDesktopGui(780, 20, layout);
        assert(hitExport.hitGui == true && hitExport.buttonId == DesktopButtonId::ExportPng);

        // Hit-test Left Studio Dock "Boishakhi Sun" quick-start template button (134..246, 74..104)
        DesktopGuiHitResult hitTemplate = hitTestDesktopGui(160, 88, layout);
        assert(hitTemplate.hitGui == true && hitTemplate.buttonId == DesktopButtonId::TemplateBoishakhiSun);

        // Hit-test Left Studio Dock "Sindoor" pigment swatch (94..166, 178..208)
        DesktopGuiHitResult hitPigment = hitTestDesktopGui(110, 190, layout);
        assert(hitPigment.hitGui == true && hitPigment.buttonId == DesktopButtonId::PigmentCrimson);

        // Hit-test Left Studio Dock "Image Lab NPR" & "3D Courtyard" workspace view buttons
        DesktopGuiHitResult hitNpr = hitTestDesktopGui(160, 568, layout);
        assert(hitNpr.hitGui == true && hitNpr.buttonId == DesktopButtonId::ViewImageLab);
        DesktopGuiHitResult hit3d = hitTestDesktopGui(40, 600, layout);
        assert(hit3d.hitGui == true && hit3d.buttonId == DesktopButtonId::View3D);

        // Hit-test inside the 720x720 Canvas Stage (center at window 630, 408 -> local 360, 360)
        DesktopGuiHitResult hitStage = hitTestDesktopGui(630, 408, layout);
        assert(hitStage.hitGui == false && hitStage.hitCanvas == true);
        assert(std::abs(hitStage.canvasLocalPoint.x - 360.0) < 1e-6);
        assert(std::abs(hitStage.canvasLocalPoint.y - 360.0) < 1e-6);
    }

    // 43. Branded Startup Splash Transition Progress & Phase Lifecycle (computeDesktopSplashProgress)
    {
        DesktopSplashState s0 = computeDesktopSplashProgress(0, 720, false);
        assert(s0.phase == DesktopSplashPhase::EmblemBloom);
        assert(s0.progressPct == 0 && s0.isComplete == false);
        assert(std::abs(s0.overlayOpacity - 1.0) < 1e-6);

        DesktopSplashState sMid = computeDesktopSplashProgress(360, 720, false);
        assert(sMid.phase == DesktopSplashPhase::StageCalibrate);
        assert(sMid.progressPct == 50 && sMid.isComplete == false);
        assert(std::abs(sMid.lotusRotationDeg - 11.25) < 1e-6);

        DesktopSplashState sFade = computeDesktopSplashProgress(648, 720, false);
        assert(sFade.phase == DesktopSplashPhase::RevealFade);
        assert(sFade.overlayOpacity < 1.0 && sFade.overlayOpacity > 0.0);

        DesktopSplashState sDone = computeDesktopSplashProgress(720, 720, false);
        assert(sDone.phase == DesktopSplashPhase::Complete);
        assert(sDone.progressPct == 100 && sDone.isComplete == true);
        assert(std::abs(sDone.overlayOpacity - 0.0) < 1e-6);

        DesktopSplashState sSkipped = computeDesktopSplashProgress(120, 720, true);
        assert(sSkipped.isComplete == true && sSkipped.progressPct == 100);
    }

    std::cout << "All 43 C++11 Alpona Studio v1.4.2 tests passed!" << std::endl;
    return 0;
}
