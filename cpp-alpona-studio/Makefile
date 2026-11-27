CXX      := g++
CXXFLAGS := -std=c++11 -O2 -Wall -Wextra -Iinclude

CORE_SRC := src/transforms.cpp src/rasterizer.cpp src/floodfill.cpp src/motifs.cpp \
            src/image_processing.cpp src/projection3d.cpp src/bezier.cpp src/homography.cpp \
            src/photo_unwarper.cpp src/phong_lighting.cpp src/projector_trace.cpp \
            src/timelapse_frames.cpp src/frieze_border.cpp src/stencil_bridger.cpp \
            src/colorway_remap.cpp src/stroke_craft.cpp src/stl_stamp.cpp \
            src/weave_chart.cpp src/generative_composer.cpp src/natural_media.cpp \
            src/canvas_assist.cpp src/layer_stack.cpp src/layer_transform.cpp \
            src/viewport_camera.cpp src/frame_cache.cpp src/desktop_gui.cpp \
            src/kolam_composer.cpp

ifeq ($(OS),Windows_NT)
  # Recipes use cmd.exe even when Git's sh.exe is on PATH (copy/del below).
  SHELL := cmd.exe
  .SHELLFLAGS := /c
  # FreeGLUT 3.6.0 for 64-bit MinGW is bundled in third_party/freeglut (no install needed).
  GL_INC := -Ithird_party/freeglut/include
  GL_LIBS := -Lthird_party/freeglut/lib/x64 -lfreeglut -lopengl32 -lglu32 -lwinmm -lgdi32
  # Static C/C++ runtime: the .exe also starts outside the MinGW/Code::Blocks console.
  LDFLAGS += -static-libgcc -static-libstdc++
  COPY_GLUT_DLL := copy /Y third_party\freeglut\bin\x64\libfreeglut.dll . >NUL
  APP_BIN := AlponaStudio.exe
  CLI_BIN := AlponaCLI.exe
  TEST_BIN := test_graphics.exe
  RUN_TEST := $(TEST_BIN)
  RM := del /Q /F
else
  UNAME_S := $(shell uname -s)
  ifeq ($(UNAME_S),Darwin)
    # macOS: uses Apple's built-in GLUT and OpenGL frameworks
    CXXFLAGS += -DGL_SILENCE_DEPRECATION
    GL_LIBS := -framework GLUT -framework OpenGL
  else
    GL_LIBS := -lglut -lGL -lGLU
  endif
  APP_BIN := AlponaStudio
  CLI_BIN := AlponaCLI
  TEST_BIN := test_graphics
  RUN_TEST := ./$(TEST_BIN)
  RM := rm -f
endif

.PHONY: all cli test clean

all: $(APP_BIN)

$(APP_BIN): src/main.cpp $(CORE_SRC)
	$(CXX) $(CXXFLAGS) $(GL_INC) src/main.cpp $(CORE_SRC) -o $(APP_BIN) $(GL_LIBS) $(LDFLAGS)
	$(COPY_GLUT_DLL)

cli: $(CLI_BIN)

$(CLI_BIN): src/cli_pipeline.cpp $(CORE_SRC)
	$(CXX) $(CXXFLAGS) src/cli_pipeline.cpp $(CORE_SRC) -o $(CLI_BIN) $(LDFLAGS)

test: tests/test_graphics.cpp $(CORE_SRC)
	$(CXX) $(CXXFLAGS) tests/test_graphics.cpp $(CORE_SRC) -o $(TEST_BIN) $(LDFLAGS)
	$(RUN_TEST)

clean:
	-$(RM) $(APP_BIN) $(CLI_BIN) $(TEST_BIN) libfreeglut.dll
