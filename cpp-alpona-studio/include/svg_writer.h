#ifndef ALPONA_SVG_WRITER_H
#define ALPONA_SVG_WRITER_H

#include <algorithm>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <string>
#include <vector>
#include "canvas_buffer.h"

namespace alpona {

// Converts a binary pixel mask (1 = painted) into compact SVG path data: horizontal runs
// of each row are merged downwards into rectangles ("M x y h w v h h -w z"), ordered
// top-to-bottom then left-to-right (identical to fillMaskToSvgPath in svgExport.ts).
inline std::string fillMaskToSvgPath(const std::vector<uint8_t>& mask, int width, int height) {
    struct Rect { int x, y, w, h; };
    std::vector<Rect> done;
    std::vector<Rect> open;
    for (int y = 0; y < height; ++y) {
        std::vector<Rect> next;
        int x = 0;
        while (x < width) {
            if (!mask[static_cast<size_t>(y) * width + x]) { ++x; continue; }
            const int start = x;
            while (x < width && mask[static_cast<size_t>(y) * width + x]) ++x;
            const int w = x - start;
            bool extended = false;
            for (size_t i = 0; i < open.size(); ++i) {
                if (open[i].x == start && open[i].w == w) {
                    Rect r = open[i];
                    ++r.h;
                    next.push_back(r);
                    open.erase(open.begin() + static_cast<long>(i));
                    extended = true;
                    break;
                }
            }
            if (!extended) next.push_back(Rect{start, y, w, 1});
        }
        done.insert(done.end(), open.begin(), open.end());
        open.swap(next);
    }
    done.insert(done.end(), open.begin(), open.end());
    std::sort(done.begin(), done.end(), [](const Rect& a, const Rect& b) {
        return a.y != b.y ? a.y < b.y : a.x < b.x;
    });
    std::ostringstream d;
    for (size_t i = 0; i < done.size(); ++i) {
        if (i) d << ' ';
        d << 'M' << done[i].x << ' ' << done[i].y << 'h' << done[i].w << 'v' << done[i].h
          << "h-" << done[i].w << 'z';
    }
    return d.str();
}

// Zero-dependency C++11 Vector SVG writer for laser cutters, vinyl stencils & high-DPI print.
class SvgWriter {
public:
    SvgWriter(int width, int height, const std::string& bgHex = "#16161B")
        : width_(width), height_(height) {
        out_ << "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
        out_ << "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 "
             << width_ << " " << height_ << "\" width=\"" << width_
             << "\" height=\"" << height_ << "\">\n";
        out_ << "  <rect x=\"0\" y=\"0\" width=\"" << width_ << "\" height=\""
             << height_ << "\" fill=\"" << bgHex << "\" />\n";
    }

    void addLine(const Point2D& a, const Point2D& b, const std::string& strokeHex, double strokeWidth) {
        out_ << std::fixed << std::setprecision(2)
             << "  <line x1=\"" << a.x << "\" y1=\"" << a.y
             << "\" x2=\"" << b.x << "\" y2=\"" << b.y
             << "\" stroke=\"" << strokeHex << "\" stroke-width=\"" << strokeWidth
             << "\" stroke-linecap=\"round\" />\n";
    }

    void addCircle(const Point2D& c, double radius, const std::string& strokeHex, double strokeWidth) {
        out_ << std::fixed << std::setprecision(2)
             << "  <circle cx=\"" << c.x << "\" cy=\"" << c.y << "\" r=\"" << radius
             << "\" fill=\"none\" stroke=\"" << strokeHex << "\" stroke-width=\""
             << strokeWidth << "\" />\n";
    }

    void addCubicBezier(
        const Point2D& p0,
        const Point2D& p1,
        const Point2D& p2,
        const Point2D& p3,
        const std::string& strokeHex,
        double strokeWidth
    ) {
        out_ << std::fixed << std::setprecision(2)
             << "  <path d=\"M " << p0.x << " " << p0.y
             << " C " << p1.x << " " << p1.y << ", "
             << p2.x << " " << p2.y << ", "
             << p3.x << " " << p3.y
             << "\" fill=\"none\" stroke=\"" << strokeHex
             << "\" stroke-width=\"" << strokeWidth
             << "\" stroke-linecap=\"round\" />\n";
    }

    void addFillPath(const std::string& pathData, const std::string& fillHex) {
        out_ << "  <path d=\"" << pathData << "\" fill=\"" << fillHex
             << "\" shape-rendering=\"crispEdges\" />\n";
    }

    std::string str() const {
        return out_.str() + "</svg>\n";
    }

    bool saveToFile(const std::string& filepath) const {
        std::ofstream ofs(filepath.c_str(), std::ios::binary);
        if (!ofs.is_open()) return false;
        ofs << str();
        return ofs.good();
    }

private:
    int width_;
    int height_;
    std::ostringstream out_;
};

} // namespace alpona

#endif // ALPONA_SVG_WRITER_H
