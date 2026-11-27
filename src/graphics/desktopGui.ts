import type { CanvasSurfaceId, Point2D, SymmetryConfig } from './types';

export interface DesktopGuiLayout {
  windowWidth: number;
  windowHeight: number;
  topBarHeight: number;
  leftDockWidth: number;
  canvasX: number;
  canvasY: number;
  canvasSize: number;
  statusBarY: number;
}

export const DEFAULT_DESKTOP_GUI_LAYOUT: DesktopGuiLayout = {
  windowWidth: 1000,
  windowHeight: 796,
  topBarHeight: 42,
  leftDockWidth: 260,
  canvasX: 270,
  canvasY: 48,
  canvasSize: 720,
  statusBarY: 772,
};

export type DesktopButtonId =
  | 'ToolFreehand'
  | 'ToolLine'
  | 'ToolCircle'
  | 'ToolFill'
  | 'ActionUndo'
  | 'ActionRedo'
  | 'ActionClear'
  | 'ExportPng'
  | 'ExportSvg'
  | 'ExportStl'
  | 'TemplatePadmaLotus'
  | 'TemplateBoishakhiSun'
  | 'TemplateKalkaRosette'
  | 'TemplateBlankCanvas'
  | 'PigmentIvory'
  | 'PigmentCrimson'
  | 'PigmentGold'
  | 'PigmentRose'
  | 'PigmentGreen'
  | 'PigmentIndigo'
  | 'SurfaceCourtyard'
  | 'SurfaceTerracotta'
  | 'SurfaceIndigo'
  | 'Sym4'
  | 'Sym6'
  | 'Sym8'
  | 'Sym12'
  | 'SymToggleReflect'
  | 'AssistToggleSnap'
  | 'AssistToggleAxes'
  | 'ZoomOut'
  | 'ZoomReset'
  | 'ZoomIn'
  | 'ViewStudio'
  | 'ViewImageLab'
  | 'View3D'
  | 'ViewDiya';

export type DesktopButtonSection =
  | 'TopToolbar'
  | 'QuickTemplates'
  | 'Pigments'
  | 'Surfaces'
  | 'Symmetry'
  | 'Viewport'
  | 'WorkspaceViews';

export interface DesktopGuiButton {
  id: DesktopButtonId;
  section: DesktopButtonSection;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  swatchHex?: string;
}

export interface DesktopGuiHitResult {
  hitGui: boolean;
  hitCanvas: boolean;
  buttonId: DesktopButtonId | null;
  buttonLabel: string | null;
  canvasLocalPoint: Point2D;
}

export interface StudioQuickStartTemplate {
  id: 'padma-lotus' | 'boishakhi-sun' | 'kalka-rosette' | 'blank-canvas';
  title: string;
  subtitle: string;
  motifId: string | null;
  surfaceId: CanvasSurfaceId;
  symmetry: SymmetryConfig;
  defaultColor: string;
  accentHex: string;
}

export const STUDIO_QUICK_START_TEMPLATES: StudioQuickStartTemplate[] = [
  {
    id: 'padma-lotus',
    title: 'Padma Lotus Courtyard',
    subtitle: '8-fold mirror mandala · Dark Courtyard',
    motifId: 'padma-lotus',
    surfaceId: 'courtyard',
    symmetry: { sectors: 8, reflect: true },
    defaultColor: '#FAF8F2',
    accentHex: '#B91C1C',
  },
  {
    id: 'boishakhi-sun',
    title: 'Boishakhi Terracotta Sun',
    subtitle: '12-fold radiant sunburst · Red Clay',
    motifId: 'boishakhi-sun',
    surfaceId: 'terracotta',
    symmetry: { sectors: 12, reflect: true },
    defaultColor: '#F59E0B',
    accentHex: '#D97706',
  },
  {
    id: 'kalka-rosette',
    title: 'Shankha & Kalka Rosette',
    subtitle: '6-fold rotational spiral · Midnight Indigo',
    motifId: 'kalka-rosette',
    surfaceId: 'indigo',
    symmetry: { sectors: 6, reflect: false },
    defaultColor: '#FAF8F2',
    accentHex: '#2563EB',
  },
  {
    id: 'blank-canvas',
    title: 'Blank Artisan Canvas',
    subtitle: 'Fresh 8-fold symmetry stage · Start from scratch',
    motifId: null,
    surfaceId: 'courtyard',
    symmetry: { sectors: 8, reflect: true },
    defaultColor: '#FAF8F2',
    accentHex: '#18181B',
  },
];

export function buildDesktopGuiButtons(
  _layout: DesktopGuiLayout = DEFAULT_DESKTOP_GUI_LAYOUT
): DesktopGuiButton[] {
  const topY = 7;
  const topH = 28;
  return [
    // 1. Top Toolbar Buttons (10)
    { id: 'ToolFreehand', section: 'TopToolbar', label: 'Brush', x: 270, y: topY, width: 64, height: topH },
    { id: 'ToolLine', section: 'TopToolbar', label: 'Line', x: 340, y: topY, width: 58, height: topH },
    { id: 'ToolCircle', section: 'TopToolbar', label: 'Circle', x: 404, y: topY, width: 64, height: topH },
    { id: 'ToolFill', section: 'TopToolbar', label: 'Fill', x: 474, y: topY, width: 56, height: topH },
    { id: 'ActionUndo', section: 'TopToolbar', label: 'Undo', x: 548, y: topY, width: 56, height: topH },
    { id: 'ActionRedo', section: 'TopToolbar', label: 'Redo', x: 610, y: topY, width: 56, height: topH },
    { id: 'ActionClear', section: 'TopToolbar', label: 'Clear', x: 672, y: topY, width: 58, height: topH },
    { id: 'ExportPng', section: 'TopToolbar', label: 'Save PNG', x: 748, y: topY, width: 80, height: topH },
    { id: 'ExportSvg', section: 'TopToolbar', label: 'Save SVG', x: 834, y: topY, width: 78, height: topH },
    { id: 'ExportStl', section: 'TopToolbar', label: '3D STL', x: 918, y: topY, width: 72, height: topH },

    // 2. Left Studio Dock: Quick-Start Templates (4)
    { id: 'TemplatePadmaLotus', section: 'QuickTemplates', label: 'Padma Lotus', x: 14, y: 74, width: 112, height: 30 },
    { id: 'TemplateBoishakhiSun', section: 'QuickTemplates', label: 'Boishakhi Sun', x: 134, y: 74, width: 112, height: 30 },
    { id: 'TemplateKalkaRosette', section: 'QuickTemplates', label: 'Kalka Rosette', x: 14, y: 110, width: 112, height: 30 },
    { id: 'TemplateBlankCanvas', section: 'QuickTemplates', label: 'Blank Canvas', x: 134, y: 110, width: 112, height: 30 },

    // 3. Left Studio Dock: Traditional Pigment Swatches (6)
    { id: 'PigmentIvory', section: 'Pigments', label: 'Ivory', x: 14, y: 178, width: 72, height: 30, swatchHex: '#FAF8F2' },
    { id: 'PigmentCrimson', section: 'Pigments', label: 'Sindoor', x: 94, y: 178, width: 72, height: 30, swatchHex: '#DC2626' },
    { id: 'PigmentGold', section: 'Pigments', label: 'Turmeric', x: 174, y: 178, width: 72, height: 30, swatchHex: '#F59E0B' },
    { id: 'PigmentRose', section: 'Pigments', label: 'Alta', x: 14, y: 214, width: 72, height: 30, swatchHex: '#E11D48' },
    { id: 'PigmentGreen', section: 'Pigments', label: 'Pata', x: 94, y: 214, width: 72, height: 30, swatchHex: '#16A34A' },
    { id: 'PigmentIndigo', section: 'Pigments', label: 'Neel', x: 174, y: 214, width: 72, height: 30, swatchHex: '#2563EB' },

    // 4. Left Studio Dock: Surface Themes (3)
    { id: 'SurfaceCourtyard', section: 'Surfaces', label: 'Courtyard', x: 14, y: 282, width: 72, height: 30, swatchHex: '#16161B' },
    { id: 'SurfaceTerracotta', section: 'Surfaces', label: 'Red Clay', x: 94, y: 282, width: 72, height: 30, swatchHex: '#7C2D12' },
    { id: 'SurfaceIndigo', section: 'Surfaces', label: 'Midnight', x: 174, y: 282, width: 72, height: 30, swatchHex: '#172554' },

    // 5. Left Studio Dock: Symmetry & Assist (7)
    { id: 'Sym4', section: 'Symmetry', label: '4x', x: 14, y: 350, width: 52, height: 30 },
    { id: 'Sym6', section: 'Symmetry', label: '6x', x: 74, y: 350, width: 52, height: 30 },
    { id: 'Sym8', section: 'Symmetry', label: '8x', x: 134, y: 350, width: 52, height: 30 },
    { id: 'Sym12', section: 'Symmetry', label: '12x', x: 194, y: 350, width: 52, height: 30 },
    { id: 'SymToggleReflect', section: 'Symmetry', label: 'Mirror (Dn / Cn)', x: 14, y: 388, width: 232, height: 30 },
    { id: 'AssistToggleSnap', section: 'Symmetry', label: 'Magnetic Snap', x: 14, y: 426, width: 112, height: 30 },
    { id: 'AssistToggleAxes', section: 'Symmetry', label: 'Guide Axes', x: 134, y: 426, width: 112, height: 30 },

    // 6. Left Studio Dock: Viewport Zoom (3)
    { id: 'ZoomOut', section: 'Viewport', label: 'Zoom -', x: 14, y: 494, width: 72, height: 30 },
    { id: 'ZoomReset', section: 'Viewport', label: '100%', x: 94, y: 494, width: 72, height: 30 },
    { id: 'ZoomIn', section: 'Viewport', label: 'Zoom +', x: 174, y: 494, width: 72, height: 30 },

    // 7. Left Studio Dock: Live 2D / Image Lab / 3D Workspace Views (4)
    { id: 'ViewStudio', section: 'WorkspaceViews', label: '2D Studio', x: 14, y: 556, width: 112, height: 28 },
    { id: 'ViewImageLab', section: 'WorkspaceViews', label: 'Image Lab NPR', x: 134, y: 556, width: 112, height: 28 },
    { id: 'View3D', section: 'WorkspaceViews', label: '3D Courtyard', x: 14, y: 590, width: 112, height: 28 },
    { id: 'ViewDiya', section: 'WorkspaceViews', label: 'Night Diya 3D', x: 134, y: 590, width: 112, height: 28 },
  ];
}

export function isPointInsideCanvasStage(
  mouseX: number,
  mouseY: number,
  layout: DesktopGuiLayout = DEFAULT_DESKTOP_GUI_LAYOUT
): boolean {
  return (
    mouseX >= layout.canvasX &&
    mouseX < layout.canvasX + layout.canvasSize &&
    mouseY >= layout.canvasY &&
    mouseY < layout.canvasY + layout.canvasSize
  );
}

export function windowToCanvasStagePoint(
  mouseX: number,
  mouseY: number,
  layout: DesktopGuiLayout = DEFAULT_DESKTOP_GUI_LAYOUT
): Point2D {
  const lx = Math.max(0, Math.min(layout.canvasSize - 1, mouseX - layout.canvasX));
  const ly = Math.max(0, Math.min(layout.canvasSize - 1, mouseY - layout.canvasY));
  return { x: lx, y: ly };
}

export function hitTestDesktopGui(
  mouseX: number,
  mouseY: number,
  layout: DesktopGuiLayout = DEFAULT_DESKTOP_GUI_LAYOUT
): DesktopGuiHitResult {
  const buttons = buildDesktopGuiButtons(layout);
  for (const b of buttons) {
    if (
      mouseX >= b.x &&
      mouseX <= b.x + b.width &&
      mouseY >= b.y &&
      mouseY <= b.y + b.height
    ) {
      return {
        hitGui: true,
        hitCanvas: false,
        buttonId: b.id,
        buttonLabel: b.label,
        canvasLocalPoint: { x: 0, y: 0 },
      };
    }
  }

  if (isPointInsideCanvasStage(mouseX, mouseY, layout)) {
    return {
      hitGui: false,
      hitCanvas: true,
      buttonId: null,
      buttonLabel: null,
      canvasLocalPoint: windowToCanvasStagePoint(mouseX, mouseY, layout),
    };
  }

  return {
    hitGui: false,
    hitCanvas: false,
    buttonId: null,
    buttonLabel: null,
    canvasLocalPoint: { x: 0, y: 0 },
  };
}
