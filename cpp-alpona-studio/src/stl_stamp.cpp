#include "stl_stamp.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <iomanip>
#include <sstream>

namespace alpona {

namespace {

const double kPi = 3.14159265358979323846;

void writeLeUint32(std::vector<uint8_t>& buf, size_t offset, uint32_t value) {
    buf[offset + 0] = static_cast<uint8_t>(value & 0xFFu);
    buf[offset + 1] = static_cast<uint8_t>((value >> 8) & 0xFFu);
    buf[offset + 2] = static_cast<uint8_t>((value >> 16) & 0xFFu);
    buf[offset + 3] = static_cast<uint8_t>((value >> 24) & 0xFFu);
}

void writeLeUint16(std::vector<uint8_t>& buf, size_t offset, uint16_t value) {
    buf[offset + 0] = static_cast<uint8_t>(value & 0xFFu);
    buf[offset + 1] = static_cast<uint8_t>((value >> 8) & 0xFFu);
}

void writeLeFloat32(std::vector<uint8_t>& buf, size_t offset, float value) {
    uint32_t bits = 0;
    std::memcpy(&bits, &value, sizeof(float));
    writeLeUint32(buf, offset, bits);
}

void pushTri(
    std::vector<StlTriangle>& out,
    double ax, double ay, double az,
    double bx, double by, double bz,
    double cx, double cy, double cz) {
    const double ux = bx - ax;
    const double uy = by - ay;
    const double uz = bz - az;
    const double vx = cx - ax;
    const double vy = cy - ay;
    const double vz = cz - az;
    double nx = uy * vz - uz * vy;
    double ny = uz * vx - ux * vz;
    double nz = ux * vy - uy * vx;
    const double len = std::sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 1e-8) return;
    nx /= len;
    ny /= len;
    nz /= len;
    StlTriangle tri;
    tri.nx = static_cast<float>(nx);
    tri.ny = static_cast<float>(ny);
    tri.nz = static_cast<float>(nz);
    tri.ax = static_cast<float>(ax);
    tri.ay = static_cast<float>(ay);
    tri.az = static_cast<float>(az);
    tri.bx = static_cast<float>(bx);
    tri.by = static_cast<float>(by);
    tri.bz = static_cast<float>(bz);
    tri.cx = static_cast<float>(cx);
    tri.cy = static_cast<float>(cy);
    tri.cz = static_cast<float>(cz);
    out.push_back(tri);
}

uint8_t clampByte(double v) {
    const int iv = static_cast<int>(std::floor(v + 0.5));
    if (iv < 0) return 0;
    if (iv > 255) return 255;
    return static_cast<uint8_t>(iv);
}

} // namespace

StampHeightfield buildStampHeightfield(
    const CanvasBuffer& alpona,
    Color bgColor,
    const StlStampOptions& options) {
    const int size = std::max(24, std::min(128, options.gridSize));
    std::vector<float> raw(static_cast<size_t>(size * size), 0.0f);
    std::vector<uint8_t> mask(static_cast<size_t>(size * size), 0);

    const double half = (size - 1) * 0.5;
    const double maxR = half * 0.985;

    for (int y = 0; y < size; ++y) {
        const int sy = std::min(
            alpona.height() - 1,
            static_cast<int>(std::floor(((y + 0.5) / size) * alpona.height())));
        for (int x = 0; x < size; ++x) {
            const size_t idx = static_cast<size_t>(y * size + x);
            const double dx = x - half;
            const double dy = y - half;
            if (options.circularBase && std::sqrt(dx * dx + dy * dy) > maxR) {
                mask[idx] = 0;
                raw[idx] = 0.0f;
                continue;
            }
            mask[idx] = 1;

            const int sampleX = options.mirrorHorizontal ? (size - 1 - x) : x;
            const int sx = std::min(
                alpona.width() - 1,
                static_cast<int>(std::floor(((sampleX + 0.5) / size) * alpona.width())));
            const Color px = alpona.getPixel(sx, sy);
            const double dr = static_cast<double>(px.r) - static_cast<double>(bgColor.r);
            const double dg = static_cast<double>(px.g) - static_cast<double>(bgColor.g);
            const double db = static_cast<double>(px.b) - static_cast<double>(bgColor.b);
            const double colorDist = std::sqrt(dr * dr + dg * dg + db * db);
            const double ink = std::max(0.0, std::min(1.0, (colorDist - 18.0) / 85.0));
            raw[idx] = static_cast<float>(ink);
        }
    }

    // 3x3 Gaussian draft-angle bevel smoothing pass
    std::vector<float> smooth(static_cast<size_t>(size * size), 0.0f);
    static const int k[9] = {1, 2, 1, 2, 4, 2, 1, 2, 1};
    for (int y = 0; y < size; ++y) {
        for (int x = 0; x < size; ++x) {
            const size_t idx = static_cast<size_t>(y * size + x);
            if (!mask[idx]) continue;
            double acc = 0.0;
            double wSum = 0.0;
            int ki = 0;
            for (int ky = -1; ky <= 1; ++ky) {
                const int ny = std::max(0, std::min(size - 1, y + ky));
                for (int kx = -1; kx <= 1; ++kx) {
                    const int nx = std::max(0, std::min(size - 1, x + kx));
                    const size_t nIdx = static_cast<size_t>(ny * size + nx);
                    const int wt = k[ki++];
                    if (mask[nIdx]) {
                        acc += raw[nIdx] * wt;
                        wSum += wt;
                    }
                }
            }
            const double beveled = (wSum > 0.0) ? (acc / wSum) : raw[idx];
            smooth[idx] = static_cast<float>(
                std::max(0.0, std::min(1.0, raw[idx] * 0.55 + beveled * 0.45)));
        }
    }

    StampHeightfield hf;
    hf.size = size;
    hf.heightsMm.assign(static_cast<size_t>(size * size), 0.0f);
    hf.mask = mask;
    hf.minZ = 1e9f;
    hf.maxZ = 0.0f;
    hf.activeCells = 0;

    for (size_t i = 0; i < hf.heightsMm.size(); ++i) {
        if (!mask[i]) {
            hf.heightsMm[i] = 0.0f;
            continue;
        }
        hf.activeCells++;
        const double hFactor = (options.mode == StampPresetMode::PithaMold)
                                   ? (1.0 - smooth[i])
                                   : static_cast<double>(smooth[i]);
        const float z = static_cast<float>(options.baseThicknessMm + hFactor * options.reliefHeightMm);
        hf.heightsMm[i] = z;
        if (z < hf.minZ) hf.minZ = z;
        if (z > hf.maxZ) hf.maxZ = z;
    }

    if (hf.activeCells == 0) {
        hf.minZ = 0.0f;
    }

    return hf;
}

StampMeshSummary generateStampMesh(
    const StampHeightfield& hf,
    const StlStampOptions& options) {
    const int n = hf.size;
    const double step = options.diameterMm / std::max(1, n - 1);
    const double halfMm = options.diameterMm * 0.5;

    std::vector<StlTriangle> triangles;
    triangles.reserve(static_cast<size_t>(n * n * 4));

    auto vx = [&](int x) { return x * step - halfMm; };
    auto vy = [&](int y) { return (n - 1 - y) * step - halfMm; };
    auto isCellActive = [&](int x, int y) -> bool {
        if (x < 0 || y < 0 || x >= n - 1 || y >= n - 1) return false;
        return hf.mask[static_cast<size_t>(y * n + x)] == 1 &&
               hf.mask[static_cast<size_t>(y * n + (x + 1))] == 1 &&
               hf.mask[static_cast<size_t>((y + 1) * n + x)] == 1 &&
               hf.mask[static_cast<size_t>((y + 1) * n + (x + 1))] == 1;
    };

    double volumeMm3 = 0.0;
    const double cellAreaMm2 = step * step;

    for (int y = 0; y < n - 1; ++y) {
        for (int x = 0; x < n - 1; ++x) {
            if (!isCellActive(x, y)) continue;

            const double x0 = vx(x);
            const double x1 = vx(x + 1);
            const double y0 = vy(y);
            const double y1 = vy(y + 1);

            const double z00 = hf.heightsMm[static_cast<size_t>(y * n + x)];
            const double z10 = hf.heightsMm[static_cast<size_t>(y * n + (x + 1))];
            const double z01 = hf.heightsMm[static_cast<size_t>((y + 1) * n + x)];
            const double z11 = hf.heightsMm[static_cast<size_t>((y + 1) * n + (x + 1))];

            volumeMm3 += ((z00 + z10 + z01 + z11) * 0.25) * cellAreaMm2;

            // Top relief quad (CCW +Z)
            pushTri(triangles, x0, y0, z00, x0, y1, z01, x1, y1, z11);
            pushTri(triangles, x0, y0, z00, x1, y1, z11, x1, y0, z10);

            // Bottom flat cap (CW -Z)
            pushTri(triangles, x0, y0, 0.0, x1, y1, 0.0, x0, y1, 0.0);
            pushTri(triangles, x0, y0, 0.0, x1, y0, 0.0, x1, y1, 0.0);

            // Perimeter side walls
            if (!isCellActive(x, y - 1)) {
                pushTri(triangles, x0, y0, 0.0, x0, y0, z00, x1, y0, z10);
                pushTri(triangles, x0, y0, 0.0, x1, y0, z10, x1, y0, 0.0);
            }
            if (!isCellActive(x, y + 1)) {
                pushTri(triangles, x1, y1, 0.0, x1, y1, z11, x0, y1, z01);
                pushTri(triangles, x1, y1, 0.0, x0, y1, z01, x0, y1, 0.0);
            }
            if (!isCellActive(x - 1, y)) {
                pushTri(triangles, x0, y1, 0.0, x0, y1, z01, x0, y0, z00);
                pushTri(triangles, x0, y1, 0.0, x0, y0, z00, x0, y0, 0.0);
            }
            if (!isCellActive(x + 1, y)) {
                pushTri(triangles, x1, y0, 0.0, x1, y0, z10, x1, y1, z11);
                pushTri(triangles, x1, y0, 0.0, x1, y1, z11, x1, y1, 0.0);
            }
        }
    }

    double totalHeightMm = hf.maxZ;
    if (options.includeHandle) {
        const double handleR = std::max(8.0, options.diameterMm * 0.16);
        const double handleH = std::max(12.0, options.diameterMm * 0.22);
        const int segs = 24;
        const double zTop = 0.0;
        const double zBot = -handleH;
        volumeMm3 += kPi * handleR * handleR * handleH;
        totalHeightMm += handleH;

        for (int i = 0; i < segs; ++i) {
            const double a0 = (2.0 * kPi * i) / segs;
            const double a1 = (2.0 * kPi * ((i + 1) % segs)) / segs;
            const double hx0 = std::cos(a0) * handleR;
            const double hy0 = std::sin(a0) * handleR;
            const double hx1 = std::cos(a1) * handleR;
            const double hy1 = std::sin(a1) * handleR;

            pushTri(triangles, hx0, hy0, zBot, hx1, hy1, zBot, hx1, hy1, zTop);
            pushTri(triangles, hx0, hy0, zBot, hx1, hy1, zTop, hx0, hy0, zTop);
            pushTri(triangles, 0.0, 0.0, zBot, hx1, hy1, zBot, hx0, hy0, zBot);
        }
    }

    StampMeshSummary summary;
    summary.triangleCount = triangles.size();
    summary.triangles = std::move(triangles);
    summary.widthMm = options.diameterMm;
    summary.depthMm = options.diameterMm;
    summary.heightMm = std::floor(totalHeightMm * 10.0 + 0.5) / 10.0;
    summary.estimatedVolumeCm3 = std::floor((volumeMm3 / 1000.0) * 100.0 + 0.5) / 100.0;
    return summary;
}

std::vector<uint8_t> serializeBinaryStl(const StampMeshSummary& mesh) {
    const size_t count = mesh.triangles.size();
    std::vector<uint8_t> bytes(84 + count * 50, 0);

    const std::string header = "Alpona Studio 3D Pitha Mold & Woodblock Stamp (CSE 401/402)";
    for (size_t i = 0; i < header.size() && i < 80; ++i) {
        bytes[i] = static_cast<uint8_t>(header[i]);
    }
    writeLeUint32(bytes, 80, static_cast<uint32_t>(count));

    size_t offset = 84;
    for (size_t i = 0; i < count; ++i) {
        const StlTriangle& t = mesh.triangles[i];
        writeLeFloat32(bytes, offset + 0, t.nx);
        writeLeFloat32(bytes, offset + 4, t.ny);
        writeLeFloat32(bytes, offset + 8, t.nz);
        writeLeFloat32(bytes, offset + 12, t.ax);
        writeLeFloat32(bytes, offset + 16, t.ay);
        writeLeFloat32(bytes, offset + 20, t.az);
        writeLeFloat32(bytes, offset + 24, t.bx);
        writeLeFloat32(bytes, offset + 28, t.by);
        writeLeFloat32(bytes, offset + 32, t.bz);
        writeLeFloat32(bytes, offset + 36, t.cx);
        writeLeFloat32(bytes, offset + 40, t.cy);
        writeLeFloat32(bytes, offset + 44, t.cz);
        writeLeUint16(bytes, offset + 48, 0);
        offset += 50;
    }

    return bytes;
}

std::string serializeAsciiObj(const StampMeshSummary& mesh) {
    std::ostringstream oss;
    oss << "# Alpona Studio 3D Relief Stamp (.OBJ)\n";
    oss << "# Triangles: " << mesh.triangleCount << "\n";
    oss << "o AlponaStamp\n";
    oss << std::fixed << std::setprecision(3);

    size_t vIdx = 1;
    for (size_t i = 0; i < mesh.triangles.size(); ++i) {
        const StlTriangle& t = mesh.triangles[i];
        oss << "v " << t.ax << " " << t.ay << " " << t.az << "\n";
        oss << "v " << t.bx << " " << t.by << " " << t.bz << "\n";
        oss << "v " << t.cx << " " << t.cy << " " << t.cz << "\n";
        oss << "f " << vIdx << " " << (vIdx + 1) << " " << (vIdx + 2) << "\n";
        vIdx += 3;
    }
    return oss.str();
}

CanvasBuffer renderStampTurntablePreview(
    const StampHeightfield& hf,
    const StlStampOptions& options,
    double yawDeg,
    double pitchDeg,
    int outW,
    int outH) {
    CanvasBuffer out(outW, outH);
    std::vector<float> zBuf(static_cast<size_t>(outW * outH), -1e9f);

    for (int y = 0; y < outH; ++y) {
        const double g = static_cast<double>(y) / std::max(1, outH - 1);
        const Color bg = {
            clampByte(28.0 + g * 12.0),
            clampByte(26.0 + g * 11.0),
            clampByte(29.0 + g * 12.0),
            255
        };
        for (int x = 0; x < outW; ++x) {
            out.setPixel(x, y, bg);
        }
    }

    double matR = 162.0, matG = 108.0, matB = 64.0, matSpec = 0.28, matShininess = 22.0;
    if (options.mode == StampPresetMode::PithaMold) {
        matR = 214.0; matG = 168.0; matB = 108.0; matSpec = 0.42; matShininess = 32.0;
    } else if (options.mode == StampPresetMode::TerracottaCoaster) {
        matR = 186.0; matG = 88.0; matB = 60.0; matSpec = 0.25; matShininess = 18.0;
    }

    const double yaw = (yawDeg * kPi) / 180.0;
    const double clampedPitch = std::max(18.0, std::min(82.0, pitchDeg));
    const double pitch = (clampedPitch * kPi) / 180.0;
    const double cosY = std::cos(yaw);
    const double sinY = std::sin(yaw);
    const double cosP = std::cos(pitch);
    const double sinP = std::sin(pitch);

    const int n = hf.size;
    const double half = (n - 1) * 0.5;
    const double scale = (std::min(outW, outH) * 0.78) / n;
    const double zExag = scale * (n / std::max(30.0, options.diameterMm)) * 1.45;
    const double cxOut = outW * 0.5;
    const double cyOut = outH * 0.54;

    const double lx = 0.52, ly = -0.58, lz = 0.63;
    const double lLen = std::sqrt(lx * lx + ly * ly + lz * lz);
    const double Lx = lx / lLen;
    const double Ly = ly / lLen;
    const double Lz = lz / lLen;

    const int splatRadius = std::max(1, static_cast<int>(std::ceil(scale * 0.72)));

    for (int y = 0; y < n; ++y) {
        for (int x = 0; x < n; ++x) {
            const size_t idx = static_cast<size_t>(y * n + x);
            if (!hf.mask[idx]) continue;

            const double zMm = hf.heightsMm[idx];
            const double zL = (x > 0 && hf.mask[idx - 1]) ? hf.heightsMm[idx - 1] : 0.0;
            const double zR = (x < n - 1 && hf.mask[idx + 1]) ? hf.heightsMm[idx + 1] : 0.0;
            const double zU = (y > 0 && hf.mask[idx - static_cast<size_t>(n)]) ? hf.heightsMm[idx - static_cast<size_t>(n)] : 0.0;
            const double zD = (y < n - 1 && hf.mask[idx + static_cast<size_t>(n)]) ? hf.heightsMm[idx + static_cast<size_t>(n)] : 0.0;

            double nx = -(zR - zL) * 0.9;
            double ny = -(zD - zU) * 0.9;
            double nz = 1.6;
            const double nLen = std::sqrt(nx * nx + ny * ny + nz * nz);
            nx /= nLen;
            ny /= nLen;
            nz /= nLen;

            const double rnx = nx * cosY - ny * sinY;
            const double rny = nx * sinY + ny * cosY;
            const double rnz = nz;

            const double ndl = std::max(0.0, rnx * Lx + rny * Ly + rnz * Lz);
            const double hx = Lx, hy = Ly, hz = Lz + 1.0;
            const double hLen = std::sqrt(hx * hx + hy * hy + hz * hz);
            const double ndh = std::max(0.0, (rnx * hx + rny * hy + rnz * hz) / hLen);
            const double spec = matSpec * std::pow(ndh, matShininess);
            const double reliefRange = std::max(0.5, static_cast<double>(hf.maxZ - hf.minZ));
            const double reliefTint = 0.86 + 0.22 * ((zMm - hf.minZ) / reliefRange);
            const double lit = (0.24 + 0.76 * ndl) * reliefTint;

            const double pr = matR * lit + 255.0 * spec;
            const double pg = matG * lit + 245.0 * spec;
            const double pb = matB * lit + 225.0 * spec;

            const double lx0 = x - half;
            const double ly0 = y - half;
            const double rx = lx0 * cosY - ly0 * sinY;
            const double ry = lx0 * sinY + ly0 * cosY;

            const int sx = static_cast<int>(std::floor(cxOut + rx * scale + 0.5));
            const int syTop = static_cast<int>(std::floor(cyOut + ry * scale * sinP - zMm * zExag * cosP + 0.5));
            const int syBot = static_cast<int>(std::floor(cyOut + ry * scale * sinP + 0.5));
            const float depthKey = static_cast<float>(ry * 100.0 + zMm * 2.0);

            const int yMin = std::max(0, syTop - splatRadius);
            const int yMax = std::min(outH - 1, std::max(syTop + splatRadius, syBot));
            for (int py = yMin; py <= yMax; ++py) {
                const bool isSide = py > syTop + splatRadius;
                const double sideShade = isSide ? 0.62 : 1.0;
                const Color col = {
                    clampByte(pr * sideShade),
                    clampByte(pg * sideShade),
                    clampByte(pb * sideShade),
                    255
                };
                const float zVal = isSide ? (depthKey - 0.5f) : depthKey;
                for (int px = std::max(0, sx - splatRadius); px <= std::min(outW - 1, sx + splatRadius); ++px) {
                    const size_t pIdx = static_cast<size_t>(py * outW + px);
                    if (zVal >= zBuf[pIdx]) {
                        zBuf[pIdx] = zVal;
                        out.setPixel(px, py, col);
                    }
                }
            }
        }
    }

    return out;
}

} // namespace alpona
