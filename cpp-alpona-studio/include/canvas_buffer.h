#ifndef ALPONA_CANVAS_BUFFER_H
#define ALPONA_CANVAS_BUFFER_H

#include <cstddef>
#include <cstdint>
#include <vector>

namespace alpona {

struct Color {
    uint8_t r;
    uint8_t g;
    uint8_t b;
    uint8_t a;

    bool operator==(const Color& other) const {
        return r == other.r && g == other.g && b == other.b && a == other.a;
    }

    bool operator!=(const Color& other) const {
        return !(*this == other);
    }
};

struct Point2D {
    double x;
    double y;
};

struct ClipBounds {
    double xmin;
    double ymin;
    double xmax;
    double ymax;
};

struct SymmetryConfig {
    int sectors;
    bool reflect;

    SymmetryConfig(int s = 8, bool r = true) : sectors(s), reflect(r) {}
};

class CanvasBuffer {
public:
    CanvasBuffer(int width, int height)
        : width_(width), height_(height), pixels_(width * height * 4, 0) {}

    int width() const { return width_; }
    int height() const { return height_; }
    const uint8_t* data() const { return pixels_.data(); }
    uint8_t* data() { return pixels_.data(); }

    void clear(Color bg) {
        for (int i = 0; i < width_ * height_; ++i) {
            pixels_[i * 4 + 0] = bg.r;
            pixels_[i * 4 + 1] = bg.g;
            pixels_[i * 4 + 2] = bg.b;
            pixels_[i * 4 + 3] = bg.a;
        }
    }

    bool inBounds(int x, int y) const {
        return x >= 0 && x < width_ && y >= 0 && y < height_;
    }

    bool setPixel(int x, int y, Color c) {
        if (!inBounds(x, y)) return false;
        const size_t idx = static_cast<size_t>((y * width_ + x) * 4);
        if (c.a >= 255) {
            pixels_[idx + 0] = c.r;
            pixels_[idx + 1] = c.g;
            pixels_[idx + 2] = c.b;
            pixels_[idx + 3] = 255;
        } else if (c.a > 0) {
            const double alpha = static_cast<double>(c.a) / 255.0;
            const double inv = 1.0 - alpha;
            pixels_[idx + 0] = static_cast<uint8_t>(
                static_cast<double>(c.r) * alpha + static_cast<double>(pixels_[idx + 0]) * inv + 0.5
            );
            pixels_[idx + 1] = static_cast<uint8_t>(
                static_cast<double>(c.g) * alpha + static_cast<double>(pixels_[idx + 1]) * inv + 0.5
            );
            pixels_[idx + 2] = static_cast<uint8_t>(
                static_cast<double>(c.b) * alpha + static_cast<double>(pixels_[idx + 2]) * inv + 0.5
            );
            pixels_[idx + 3] = 255;
        }
        return true;
    }

    Color getPixel(int x, int y) const {
        if (!inBounds(x, y)) return {0, 0, 0, 0};
        const size_t idx = static_cast<size_t>((y * width_ + x) * 4);
        return {
            pixels_[idx + 0],
            pixels_[idx + 1],
            pixels_[idx + 2],
            pixels_[idx + 3]
        };
    }

private:
    int width_;
    int height_;
    std::vector<uint8_t> pixels_;
};

} // namespace alpona

#endif // ALPONA_CANVAS_BUFFER_H
