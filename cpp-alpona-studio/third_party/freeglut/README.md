# FreeGLUT 3.6.0 for Windows (64-bit MinGW)

Bundled so the Alpona Studio desktop app builds on Windows without any extra download.

| Folder | Contents |
| --- | --- |
| `include/GL/` | FreeGLUT headers (`freeglut.h`, `glut.h`, …) |
| `lib/x64/libfreeglut.a` | MinGW import library for `libfreeglut.dll` (linked as `-lfreeglut`; named `.a` so it also links with `-static`) |
| `bin/x64/libfreeglut.dll` | Runtime DLL, copied next to `AlponaStudio.exe` by the build |

- Source: official FreeGLUT 3.6.0 release, <https://sourceforge.net/projects/freeglut/files/freeglut/3.6.0/>
  (`freeglut-3.6.0.tar.gz`, SHA-256 `9c3d4d6516fbfa0280edc93c77698fb7303e443c1aaaf37d269e3288a6c3ea52`).
- Built with MinGW-w64 GCC 13 (`x86_64-w64-mingw32`), CMake, `-DFREEGLUT_BUILD_SHARED_LIBS=ON
  -DFREEGLUT_BUILD_STATIC_LIBS=OFF -DFREEGLUT_BUILD_DEMOS=OFF`, linked with `-static-libgcc`.
  The DLL only depends on Windows system DLLs (`opengl32`, `gdi32`, `user32`, `winmm`, `msvcrt`, …).
- License: MIT/X-Consortium style, see [`COPYING`](COPYING).

Linux and macOS builds do not use this folder (they use the system GLUT).
