#ifndef ALPONA_PNG_WRITER_H
#define ALPONA_PNG_WRITER_H

#include "canvas_buffer.h"
#include <cstdint>
#include <fstream>
#include <string>
#include <vector>

namespace alpona {

namespace detail {

inline uint32_t crc32(const uint8_t* data, size_t len) {
    uint32_t crc = 0xFFFFFFFFu;
    for (size_t i = 0; i < len; ++i) {
        crc ^= data[i];
        for (int b = 0; b < 8; ++b) {
            crc = (crc & 1u) ? (0xEDB88320u ^ (crc >> 1)) : (crc >> 1);
        }
    }
    return crc ^ 0xFFFFFFFFu;
}

inline uint32_t adler32(const uint8_t* data, size_t len) {
    uint32_t a = 1, b = 0;
    for (size_t i = 0; i < len; ++i) {
        a = (a + data[i]) % 65521u;
        b = (b + a) % 65521u;
    }
    return (b << 16) | a;
}

inline void writeBigEndian32(std::vector<uint8_t>& out, uint32_t v) {
    out.push_back(static_cast<uint8_t>((v >> 24) & 0xFF));
    out.push_back(static_cast<uint8_t>((v >> 16) & 0xFF));
    out.push_back(static_cast<uint8_t>((v >> 8) & 0xFF));
    out.push_back(static_cast<uint8_t>(v & 0xFF));
}

inline void writeChunk(
    std::vector<uint8_t>& out,
    const char type[4],
    const std::vector<uint8_t>& payload
) {
    writeBigEndian32(out, static_cast<uint32_t>(payload.size()));
    const size_t typeStart = out.size();
    for (int i = 0; i < 4; ++i) out.push_back(static_cast<uint8_t>(type[i]));
    out.insert(out.end(), payload.begin(), payload.end());
    const uint32_t crc = crc32(out.data() + typeStart, 4 + payload.size());
    writeBigEndian32(out, crc);
}

} // namespace detail

/**
 * Zero-dependency pure C++11 PNG exporter.
 * Writes a standards-compliant 32-bit RGBA PNG file using uncompressed DEFLATE
 * blocks with valid CRC-32 and Adler-32 checksums (ideal for Code::Blocks/MinGW).
 */
inline bool saveCanvasToPng(const CanvasBuffer& buffer, const std::string& filepath) {
    const uint32_t w = static_cast<uint32_t>(buffer.width());
    const uint32_t h = static_cast<uint32_t>(buffer.height());
    if (w == 0 || h == 0) return false;

    std::vector<uint8_t> raw;
    raw.reserve(h * (1 + w * 4));
    const uint8_t* px = buffer.data();
    for (uint32_t y = 0; y < h; ++y) {
        raw.push_back(0); // PNG filter type 0 (None)
        const uint8_t* row = px + static_cast<size_t>(y) * w * 4;
        raw.insert(raw.end(), row, row + w * 4);
    }

    // Wrap raw scanlines in valid zlib stream using uncompressed DEFLATE blocks
    std::vector<uint8_t> zlibStream;
    zlibStream.push_back(0x78); // CMF: deflate, 32K window
    zlibStream.push_back(0x01); // FLG: no dict, check bits

    size_t offset = 0;
    while (offset < raw.size()) {
        const size_t remaining = raw.size() - offset;
        const uint16_t blockLen = static_cast<uint16_t>(
            remaining > 65535 ? 65535 : remaining
        );
        const bool isFinal = (offset + blockLen >= raw.size());
        zlibStream.push_back(isFinal ? 0x01 : 0x00);
        zlibStream.push_back(static_cast<uint8_t>(blockLen & 0xFF));
        zlibStream.push_back(static_cast<uint8_t>((blockLen >> 8) & 0xFF));
        const uint16_t nlen = static_cast<uint16_t>(~blockLen);
        zlibStream.push_back(static_cast<uint8_t>(nlen & 0xFF));
        zlibStream.push_back(static_cast<uint8_t>((nlen >> 8) & 0xFF));
        zlibStream.insert(
            zlibStream.end(),
            raw.begin() + static_cast<std::ptrdiff_t>(offset),
            raw.begin() + static_cast<std::ptrdiff_t>(offset + blockLen)
        );
        offset += blockLen;
    }

    detail::writeBigEndian32(zlibStream, detail::adler32(raw.data(), raw.size()));

    std::vector<uint8_t> png;
    static const uint8_t kSig[8] = {137, 80, 78, 71, 13, 10, 26, 10};
    png.insert(png.end(), kSig, kSig + 8);

    std::vector<uint8_t> ihdr;
    detail::writeBigEndian32(ihdr, w);
    detail::writeBigEndian32(ihdr, h);
    ihdr.push_back(8); // bit depth
    ihdr.push_back(6); // RGBA color type
    ihdr.push_back(0); // compression
    ihdr.push_back(0); // filter
    ihdr.push_back(0); // interlace
    detail::writeChunk(png, "IHDR", ihdr);
    detail::writeChunk(png, "IDAT", zlibStream);
    detail::writeChunk(png, "IEND", {});

    std::ofstream out(filepath, std::ios::binary);
    if (!out) return false;
    out.write(
        reinterpret_cast<const char*>(png.data()),
        static_cast<std::streamsize>(png.size())
    );
    return out.good();
}

} // namespace alpona

#endif // ALPONA_PNG_WRITER_H
