# Fast-Forward Multi-Cycle Git Commit & Push Script (Alpona Studio Pro v1.4.2 - PowerShell)
# Repository: https://github.com/ShimulCoding/Alphona (preserves Cycles 1..46 on GitHub)
# Appends Cycles 47..58 with alternating authors:
#   Odd Cycles  (47, 49, 51, 53, 55, 57): ShimulCoding <shimulc17@gmail.com>
#   Even Cycles (48, 50, 52, 54, 56, 58): dipro20debnath <diprodebnath200@gmail.com>
#
# Run from the project root directory in Windows PowerShell:
#   powershell -ExecutionPolicy Bypass -File cpp-alpona-studio\push_to_github.ps1

param(
  [string]$RepoUrl = "https://github.com/ShimulCoding/Alphona.git",
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"
$ShimulName  = "ShimulCoding"
$ShimulEmail = "shimulc17@gmail.com"
$DiproName   = "dipro20debnath"
$DiproEmail  = "diprodebnath200@gmail.com"

if (-not (Test-Path ".git")) {
  git init -b main
}

git config user.name $ShimulName
git config user.email $ShimulEmail

$existingRemote = git remote 2>$null
if ($existingRemote -contains "origin") {
  git remote set-url origin $RepoUrl
} else {
  git remote add origin $RepoUrl
}

# Anchor local history onto GitHub origin/main (Cycle 46) without modifying working tree files
$hasHead = $true
try {
  git rev-parse --verify HEAD 2>$null | Out-Null
} catch {
  $hasHead = $false
}
if (-not $hasHead) {
  Write-Host "Fetching existing history from $RepoUrl ..."
  git fetch origin main
  git branch -f main origin/main
  git symbolic-ref HEAD refs/heads/main
  git reset --mixed -q origin/main
}

function Add-IfExists {
  param([string[]]$Paths)
  foreach ($p in $Paths) {
    if (Test-Path $p) {
      git add $p
    }
  }
}

function Commit-IfStaged {
  param(
    [string]$Name,
    [string]$Email,
    [string]$Message
  )
  git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    $env:GIT_AUTHOR_NAME     = $Name
    $env:GIT_AUTHOR_EMAIL    = $Email
    $env:GIT_COMMITTER_NAME  = $Name
    $env:GIT_COMMITTER_EMAIL = $Email
    git commit -m $Message
  }
}

# Cycle 47 (ShimulCoding)
Add-IfExists @("src/graphics/viewContinuity.ts", "src/index.css")
Commit-IfStaged $ShimulName $ShimulEmail "Cycle 47: feat(continuity): add spatial view continuity engine & CSS stage transitions"

# Cycle 48 (dipro20debnath)
Add-IfExists @("src/components/AlponaCanvas.tsx", "src/components/ImageLabView.tsx", "src/components/Projection3DView.tsx")
Commit-IfStaged $DiproName $DiproEmail "Cycle 48: feat(views): integrate canvas continuity surfaces across Studio, Image Lab & 3D View"

# Cycle 49 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/include/desktop_gui.h", "cpp-alpona-studio/src/desktop_gui.cpp",
  "cpp-alpona-studio/src/main.cpp", "cpp-alpona-studio/AlponaStudio.cbp", "cpp-alpona-studio/Makefile"
)
Commit-IfStaged $ShimulName $ShimulEmail "Cycle 49: feat(cpp-desktop): build 37-button multi-view C++11 OpenGL desktop GUI (2D, NPR, 3D, Diya & PRO header)"

# Cycle 50 (dipro20debnath)
Add-IfExists @("src/graphics/desktopGui.ts", "src/graphics/splashTransition.ts")
Commit-IfStaged $DiproName $DiproEmail "Cycle 50: feat(engine): add Desktop GUI parity, Quick-Start Studio templates & startup splash transition engine"

# Cycle 51 (ShimulCoding)
Add-IfExists @("index.html", "src/components/StudioSplashOverlay.tsx")
Commit-IfStaged $ShimulName $ShimulEmail "Cycle 51: feat(splash): add zero-flash pre-hydration Alpona Studio splash shell & animated Padma Lotus overlay"

# Cycle 52 (dipro20debnath)
Add-IfExists @(
  "src/graphics/draftStorage.ts", "src/graphics/exportCard.ts", "src/graphics/svgExport.ts",
  "src/graphics/stlStampExporter.ts", "src/graphics/naturalMedia.ts"
)
Commit-IfStaged $DiproName $DiproEmail "Cycle 52: feat(storage): add pulsing Local Storage sync indicator state & Alpona Studio v1.4.2 export metadata"

# Cycle 53 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/src/cli_pipeline.cpp", "cpp-alpona-studio/src/stl_stamp.cpp",
  "cpp-alpona-studio/tests/test_graphics.cpp"
)
Commit-IfStaged $ShimulName $ShimulEmail "Cycle 53: refactor(cpp): standardize commercial Core Subsystems I-VI across AlponaCLI, STL & 43 unit tests"

# Cycle 54 (dipro20debnath)
Add-IfExists @(
  "src/components/AlgorithmsView.tsx", "src/components/ControlDeck.tsx",
  "src/components/DiyaLightingPanel.tsx", "src/components/FloorPrintView.tsx",
  "src/components/FriezeBorderPanel.tsx", "src/components/PhotoUnwarperPanel.tsx",
  "src/components/PixelStepperCard.tsx", "src/components/StencilBridgerPanel.tsx"
)
Commit-IfStaged $DiproName $DiproEmail "Cycle 54: refactor(ui): standardize commercial Core Subsystems I-VI terminology across all studio panels"

# Cycle 55 (ShimulCoding)
Add-IfExists @("src/graphics/documentationGuides.ts", "src/graphics/graphics.test.ts")
Commit-IfStaged $ShimulName $ShimulEmail "Cycle 55: feat(docs): add PDF-style Quick Start & Advanced Techniques documentation guides engine & 53 unit tests"

# Cycle 56 (dipro20debnath)
Add-IfExists @(
  "src/components/DocumentationSidebar.tsx", "src/components/ShortcutsHelpModal.tsx",
  "src/components/HeaderBar.tsx", "src/App.tsx"
)
Commit-IfStaged $DiproName $DiproEmail "Cycle 56: feat(ui): add non-modal PDF Documentation sidebar, Quick Run modal (?), Alpona Studio Pro badge & v1.4.2 sync footer"

# Cycle 57 (ShimulCoding)
Add-IfExists @("RUN_STUDIO_WEB.bat", "RUN_CPP_DESKTOP.bat", "README.md", "cpp-alpona-studio/README.md")
Commit-IfStaged $ShimulName $ShimulEmail "Cycle 57: docs(release): add 1-click Windows launchers & complete runnable Alpona Studio Pro Quick Start READMEs"

# Cycle 58 (dipro20debnath)
Add-IfExists @(
  "src/data/cppProjectFiles.ts", "src/components/CppSourceView.tsx",
  "cpp-alpona-studio/push_to_github.sh", "cpp-alpona-studio/push_to_github.ps1"
)
Commit-IfStaged $DiproName $DiproEmail "Cycle 58: chore(git): sync Source Explorer & fast-forward alternating GitHub push scripts"

if ($NoPush) {
  Write-Host "Created alternating commits on top of origin/main (skipping push due to -NoPush)."
  exit 0
}

Write-Host "Pushing alternating commits to $RepoUrl (main) ..."
git push -u origin main
