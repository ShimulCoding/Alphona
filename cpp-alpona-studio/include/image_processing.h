#ifndef ALPONA_IMAGE_PROCESSING_H
#define ALPONA_IMAGE_PROCESSING_H

#include "canvas_buffer.h"
#include <array>
#include <complex>
#include <vector>

namespace alpona {

enum class SpatialFilterType {
    BoxMean,
    Gaussian,
    LaplacianSharpen,
    SobelEdge
};

enum class FrequencyFilterType {
    IdealLowPass,
    GaussianLowPass,
    IdealHighPass,
    GaussianHighPass
};

// Point Processing & Histogram (CLO-6 Week 13)
CanvasBuffer applyGrayscale(const CanvasBuffer& src);
CanvasBuffer applyNegative(const CanvasBuffer& src);
CanvasBuffer applyGammaTransform(const CanvasBuffer& src, double gamma);
CanvasBuffer applyLogTransform(const CanvasBuffer& src);
std::array<int, 256> computeLuminanceHistogram(const CanvasBuffer& src);
CanvasBuffer applyHistogramEqualization(const CanvasBuffer& src);

// Spatial Domain 3x3 Convolution (CLO-6 Week 14)
CanvasBuffer applySpatialFilter(const CanvasBuffer& src, SpatialFilterType filter);

// Frequency Domain 2D Radix-2 FFT (CLO-6 Week 14)
void fft1d(std::vector<std::complex<double>>& data, bool inverse);
CanvasBuffer applyFrequencyFilter(
    const CanvasBuffer& src,
    FrequencyFilterType filter,
    double cutoffD0,
    int fftSize = 64
);

// Printable Stencil & Pixel Relationships (CLO-6 Week 13-14)
struct PixelMetrics {
    int d4CityBlock;
    int d8Chessboard;
    double deEuclidean;
    int n4Count;
    int n8Count;
    bool is4Adjacent;
    bool is8Adjacent;
    int component4Size;
    int component8Size;
    bool connected4Path;
    bool connected8Path;
};

CanvasBuffer extractPrintableStencil(const CanvasBuffer& src, int threshold = 48);

PixelMetrics computePixelRelationships(
    const CanvasBuffer& src,
    int x1, int y1,
    int x2, int y2,
    int intensityTolerance = 28
);

// Binary Mathematical Morphology (Erode, Dilate, Open, Close - Flood-Gap Sealer)
enum class MorphologyOpType {
    Erode,
    Dilate,
    Open,
    Close
};

struct MorphologyMetrics {
    int foregroundBefore;
    int foregroundAfter;
    int gapsBridged;
};

CanvasBuffer applyMorphology(
    const CanvasBuffer& src,
    MorphologyOpType op,
    int radius = 1,
    int threshold = 72,
    MorphologyMetrics* outMetrics = nullptr
);

CanvasBuffer downsample2xSSAA(const CanvasBuffer& src);

} // namespace alpona

#endif // ALPONA_IMAGE_PROCESSING_H
