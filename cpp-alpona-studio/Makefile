CXX      := g++
CXXFLAGS := -std=c++11 -O2 -Wall -Wextra -Iinclude

CORE_SRC := src/transforms.cpp src/rasterizer.cpp src/floodfill.cpp src/motifs.cpp \
            src/image_processing.cpp src/projection3d.cpp src/bezier.cpp src/homography.cpp \
            src/photo_unwarper.cpp src/phong_lighting.cpp src/projector_trace.cpp \
            src/timelapse_frames.cpp src/frieze_border.cpp src/stencil_bridger.cpp \
            src/colorway_remap.cpp src/stroke_craft.cpp src/stl_stamp.cpp \
            src/weave_chart.cpp src/generative_composer.cpp src/natural_media.cpp \
            src/canvas_assist.cpp src/layer_stack.cpp src/layer_transform.cpp \
            src/viewport_camera.cpp src/frame_cache.cpp src/desktop_gui.cpp

ifeq ($(OS),Windows_NT)
  GL_LIBS := -lfreeglut -lopengl32 -lglu32 -lwinmm -lgdi32
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
	$(CXX) $(CXXFLAGS) src/main.cpp $(CORE_SRC) -o $(APP_BIN) $(GL_LIBS)

cli: $(CLI_BIN)

$(CLI_BIN): src/cli_pipeline.cpp $(CORE_SRC)
	$(CXX) $(CXXFLAGS) src/cli_pipeline.cpp $(CORE_SRC) -o $(CLI_BIN)

test: tests/test_graphics.cpp $(CORE_SRC)
	$(CXX) $(CXXFLAGS) tests/test_graphics.cpp $(CORE_SRC) -o $(TEST_BIN)
	$(RUN_TEST)

clean:
	-$(RM) $(APP_BIN) $(CLI_BIN) $(TEST_BIN)
