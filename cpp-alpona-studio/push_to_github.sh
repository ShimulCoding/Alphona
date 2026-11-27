#!/usr/bin/env bash
# Fast-Forward Multi-Cycle Git Commit & Push Script (Alpona Studio Pro v1.4.2)
# Repository: https://github.com/ShimulCoding/Alphona (preserves Cycles 1..46 on GitHub)
# Appends Cycles 47..58 with alternating authors:
#   Odd Cycles  (47, 49, 51, 53, 55, 57): ShimulCoding <shimulc17@gmail.com>
#   Even Cycles (48, 50, 52, 54, 56, 58): dipro20debnath <diprodebnath200@gmail.com>
#
# Run from the project root in Git Bash, macOS/Linux Terminal, or GitHub Codespaces:
#   bash cpp-alpona-studio/push_to_github.sh

set -euo pipefail

NO_PUSH=""
REPO_URL="https://github.com/ShimulCoding/Alphona.git"

for arg in "$@"; do
  if [ "$arg" = "--no-push" ]; then
    NO_PUSH="1"
  elif [[ "$arg" == http* ]] || [[ "$arg" == git@* ]]; then
    REPO_URL="$arg"
  fi
done

SHIMUL_NAME="ShimulCoding"
SHIMUL_EMAIL="shimulc17@gmail.com"
DIPRO_NAME="dipro20debnath"
DIPRO_EMAIL="diprodebnath200@gmail.com"

if [ ! -d ".git" ]; then
  git init -b main
fi

git config --global --add safe.directory "$(pwd)" >/dev/null 2>&1 || true
git config user.name "$SHIMUL_NAME"
git config user.email "$SHIMUL_EMAIL"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

# Anchor local history onto GitHub origin/main (Cycle 46) without modifying working tree files
if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "Fetching existing history from $REPO_URL ..."
  git fetch origin main
  git branch -f main origin/main
  git symbolic-ref HEAD refs/heads/main
  git reset --mixed -q origin/main
fi

add_if_exists() {
  for f in "$@"; do
    if [ -e "$f" ]; then
      git add "$f"
    fi
  done
}

commit_if_staged() {
  local name="$1"
  local email="$2"
  local message="$3"
  if ! git diff --cached --quiet; then
    GIT_AUTHOR_NAME="$name" \
    GIT_AUTHOR_EMAIL="$email" \
    GIT_COMMITTER_NAME="$name" \
    GIT_COMMITTER_EMAIL="$email" \
    git commit -m "$message"
  fi
}

# Cycle 47 (ShimulCoding): Spatial View Continuity Engine & CSS/Motion transitions
add_if_exists src/graphics/viewContinuity.ts src/index.css
commit_if_staged "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 47: feat(continuity): add spatial view continuity engine & CSS stage transitions"

# Cycle 48 (dipro20debnath): Canvas continuity surfaces across Studio, Image Lab & 3D View
add_if_exists src/components/AlponaCanvas.tsx src/components/ImageLabView.tsx src/components/Projection3DView.tsx
commit_if_staged "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 48: feat(views): integrate canvas continuity surfaces across Studio, Image Lab & 3D View"

# Cycle 49 (ShimulCoding): Multi-View 37-Button Code::Blocks C++11 OpenGL Desktop GUI (Alpona Studio PRO)
add_if_exists cpp-alpona-studio/include/desktop_gui.h cpp-alpona-studio/src/desktop_gui.cpp \
  cpp-alpona-studio/src/main.cpp cpp-alpona-studio/AlponaStudio.cbp cpp-alpona-studio/Makefile
commit_if_staged "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 49: feat(cpp-desktop): build 37-button multi-view C++11 OpenGL desktop GUI (2D, NPR, 3D, Diya & PRO header)"

# Cycle 50 (dipro20debnath): Desktop GUI TypeScript parity, Quick-Start templates & Splash Transition Engine
add_if_exists src/graphics/desktopGui.ts src/graphics/splashTransition.ts
commit_if_staged "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 50: feat(engine): add Desktop GUI parity, Quick-Start Studio templates & startup splash transition engine"

# Cycle 51 (ShimulCoding): Zero-flash pre-hydration Alpona Studio splash shell & StudioSplashOverlay
add_if_exists index.html src/components/StudioSplashOverlay.tsx
commit_if_staged "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 51: feat(splash): add zero-flash pre-hydration Alpona Studio splash shell & animated Padma Lotus overlay"

# Cycle 52 (dipro20debnath): Pulsing Local Storage Sync state & Alpona Studio v1.4.2 export metadata
add_if_exists src/graphics/draftStorage.ts src/graphics/exportCard.ts src/graphics/svgExport.ts \
  src/graphics/stlStampExporter.ts src/graphics/naturalMedia.ts
commit_if_staged "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 52: feat(storage): add pulsing Local Storage sync indicator state & Alpona Studio v1.4.2 export metadata"

# Cycle 53 (ShimulCoding): Commercial Core Subsystems I-VI terminology in C++11 CLI, STL & 43-test suite
add_if_exists cpp-alpona-studio/src/cli_pipeline.cpp cpp-alpona-studio/src/stl_stamp.cpp \
  cpp-alpona-studio/tests/test_graphics.cpp
commit_if_staged "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 53: refactor(cpp): standardize commercial Core Subsystems I-VI across AlponaCLI, STL & 43 unit tests"

# Cycle 54 (dipro20debnath): Unified commercial Core Subsystems I-VI UI across all studio panels
add_if_exists src/components/AlgorithmsView.tsx src/components/ControlDeck.tsx \
  src/components/DiyaLightingPanel.tsx src/components/FloorPrintView.tsx \
  src/components/FriezeBorderPanel.tsx src/components/PhotoUnwarperPanel.tsx \
  src/components/PixelStepperCard.tsx src/components/StencilBridgerPanel.tsx
commit_if_staged "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 54: refactor(ui): standardize commercial Core Subsystems I-VI terminology across all studio panels"

# Cycle 55 (ShimulCoding): PDF-style Engine Documentation Guides engine & 53/53 TypeScript unit tests
add_if_exists src/graphics/documentationGuides.ts src/graphics/graphics.test.ts
commit_if_staged "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 55: feat(docs): add PDF-style Quick Start & Advanced Techniques documentation guides engine & 53 unit tests"

# Cycle 56 (dipro20debnath): Non-modal PDF Documentation Sidebar, Quick Run modal (?), Alpona Studio Pro Header & Sync Footer
add_if_exists src/components/DocumentationSidebar.tsx src/components/ShortcutsHelpModal.tsx \
  src/components/HeaderBar.tsx src/App.tsx
commit_if_staged "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 56: feat(ui): add non-modal PDF Documentation sidebar, Quick Run modal (?), Alpona Studio Pro badge & v1.4.2 sync footer"

# Cycle 57 (ShimulCoding): 1-Click Windows launchers & complete runnable Quick Start README guides
add_if_exists RUN_STUDIO_WEB.bat RUN_CPP_DESKTOP.bat README.md cpp-alpona-studio/README.md
commit_if_staged "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 57: docs(release): add 1-click Windows launchers & complete runnable Alpona Studio Pro Quick Start READMEs"

# Cycle 58 (dipro20debnath): Sync Source Explorer & fast-forward alternating GitHub push scripts
add_if_exists src/data/cppProjectFiles.ts src/components/CppSourceView.tsx \
  cpp-alpona-studio/push_to_github.sh cpp-alpona-studio/push_to_github.ps1
commit_if_staged "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 58: chore(git): sync Source Explorer & fast-forward alternating GitHub push scripts"

echo ""
echo "Local branch main is ready with alternating commits on top of origin/main:"
git log -n 14 --pretty=format:"  %h | %an <%ae> | %s"
echo ""

if [ -n "$NO_PUSH" ]; then
  echo "Skipping git push (--no-push)."
  exit 0
fi

echo "Pushing to $REPO_URL (main) ..."
git push -u origin main
