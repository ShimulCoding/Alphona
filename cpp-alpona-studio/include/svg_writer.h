#ifndef ALPONA_SVG_WRITER_H
#define ALPONA_SVG_WRITER_H

#include <fstream>
#include <iomanip>
#include <sstream>
#include <string>
#include <vector>
#include "canvas_buffer.h"

namespace alpona {

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
