/**
 * Theme tokens — the single source of truth for every color in the app.
 *
 * Adding a new theme = add a third exported `ThemeTokens` object here and a
 * matching entry in `packages/app/src/themes.ts`. No component code should be
 * touched. If a component needs a color that isn't already a slot in this
 * file, widen `ThemeTokens` — don't inline a literal.
 */

export type ColorScale = {
  light: string;
  main: string;
  dark: string;
};

export type EntityKindPalette = {
  accent: string;
  tint: string;
};

export type ThemeTokens = {
  /** Drives `palette.type` in MUI v4 and gates dark-only CSS hooks. */
  mode: 'light' | 'dark';

  // ---- MUI palette inputs ----------------------------------------------------
  primary: ColorScale;
  secondary: ColorScale;
  info: ColorScale;
  error: ColorScale;
  warning: ColorScale;
  success: ColorScale;
  grey: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  indigo: {
    50: string;
    100: string;
    200: string;
  };
  common: {
    black: string;
    white: string;
  };

  // ---- Semantic surfaces -----------------------------------------------------
  surface: {
    /** Page / app background. */
    default: string;
    /** Card / input / paper surface. */
    paper: string;
    /** Menus, popovers, floating toolbars. */
    raised: string;
    /** Hover state background for interactive rows/items. */
    hover: string;
    /** Disabled surface background. */
    disabled: string;
    /** Surface color that inverts against the base (used for tooltips). */
    inverted: string;
  };

  // ---- Borders / dividers (3 strengths) -------------------------------------
  border: {
    default: string;
    subtle: string;
    strong: string;
  };

  // ---- Text hierarchy --------------------------------------------------------
  text: {
    primary: string;
    secondary: string;
    subtle: string;
    verySubtle: string;
    disabled: string;
    inverted: string;
    link: string;
    linkHover: string;
  };

  // ---- Status colors ---------------------------------------------------------
  status: {
    ok: string;
    warning: string;
    error: string;
    info: string;
    pending: string;
    running: string;
    aborted: string;
    /** Gold accent (in-editor hints, deletion markers). */
    gold: string;
  };

  /** Tinted status backgrounds (banners, alerts, info boxes). */
  statusBackground: {
    error: string;
    warning: string;
    info: string;
    success: string;
  };

  // ---- Shadows (full boxShadow strings) --------------------------------------
  shadow: {
    /** 1px x-offset, 2px blur — button containedboxShadow. */
    sm: string;
    /** 1px x-offset, 3px blur — header underline / single-stop card shadow. */
    smBlur: string;
    /** Two-stop soft card shadow used by MuiCard in the original theme. */
    card: string;
    /** Mid elevation — card/toolbar panels. */
    md: string;
    /** High elevation — button hover, popovers. */
    lg: string;
    /** Highest elevation — modals. */
    xl: string;
  };

  // ---- Scrim / translucent overlays -----------------------------------------
  /** Pre-composed opacity tiers so callers never write rgba() themselves. */
  scrim: {
    subtle: string;
    low: string;
    med: string;
    high: string;
    solid: string;
  };

  // ---- Brand gradients -------------------------------------------------------
  gradient: {
    header: string;
    cardHeader: string;
    burst: string;
  };

  // ---- Code / editor ---------------------------------------------------------
  editor: {
    background: string;
    errorPanelBackground: string;
    /** Which bundled CodeMirror theme string to use. */
    codeMirrorTheme: 'light' | 'dark';
  };

  // ---- Entity-kind palette for platform overview graph ----------------------
  /** Keyed by lowercased entity kind. */
  entityKind: Record<string, EntityKindPalette>;
  entityKindDefault: EntityKindPalette;

  // ---- Graph-specific tokens -------------------------------------------------
  graph: {
    edge: string;
    /** radial-gradient expression for dotted background. */
    canvasDotPattern: string;
    /** radial-gradient expression for minimap dotted overlay (tighter density). */
    minimapDotPattern: string;
    /** Minimap outer mask background. */
    minimapMask: string;
    /** Minimap viewport tint (primary-based). */
    minimapViewportTint: string;
    /** Minimap viewport border. */
    minimapViewportBorder: string;
    /** Three rgba stops for skeleton loading shimmer. */
    skeletonStops: [string, string, string];
    /** SVG flood color for inner node shadow. */
    nodeShadowInner: string;
    /** SVG flood color for outer node shadow. */
    nodeShadowOuter: string;
    /** Label pill fill for SVG node labels. */
    labelPillFill: string;
  };

  // ---- Navigation ------------------------------------------------------------
  navigation: {
    background: string;
    indicator: string;
    color: string;
    selectedColor: string;
    navItemHoverBackground: string;
    submenuBackground: string;
  };

  // ---- Bursts / pinSidebarButton / banner / tabbar / code palette -----------
  // (These flow into Backstage's palette extensions.)
  banner: {
    info: string;
    error: string;
    text: string;
    link: string;
    closeButtonColor: string;
    warning: string;
  };
  bursts: {
    fontColor: string;
    slackChannelText: string;
    backgroundColor: string;
    gradient: string;
  };
  pinSidebarButton: {
    icon: string;
    background: string;
  };

  // ---- Deletion warning (graph nodes marked for deletion) -------------------
  deletionWarning: string;
};

// ---------------------------------------------------------------------------
// Light tokens — ported from the original openChoreoTheme.ts
// ---------------------------------------------------------------------------

const lightPrimary: ColorScale = {
  light: '#f0f1fb',
  main: '#6c7fd8',
  dark: '#5568c4',
};
const lightSecondary: ColorScale = {
  light: '#fafbfc',
  main: '#6b7280',
  dark: '#374151',
};
const lightInfo: ColorScale = {
  light: '#dbeafe',
  main: '#3b82f6',
  dark: '#1d4ed8',
};
const lightError: ColorScale = {
  light: '#fef2f2',
  main: '#ef4444',
  dark: '#dc2626',
};
const lightWarning: ColorScale = {
  light: '#fff5eb',
  main: '#f59e0b',
  dark: '#d97706',
};
const lightSuccess: ColorScale = {
  light: '#f0fdf4',
  main: '#10b981',
  dark: '#059669',
};

export const lightTokens: ThemeTokens = {
  mode: 'light',

  primary: lightPrimary,
  secondary: lightSecondary,
  info: lightInfo,
  error: lightError,
  warning: lightWarning,
  success: lightSuccess,
  grey: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  indigo: {
    50: '#f5f7ff',
    100: '#eef2ff',
    200: '#e0e7ff',
  },
  common: {
    black: '#111827',
    white: '#ffffff',
  },

  surface: {
    default: '#ffffff',
    paper: '#ffffff',
    raised: '#ffffff',
    hover: '#f9fafb',
    disabled: '#f3f4f6',
    inverted: '#111827',
  },

  border: {
    default: '#e5e7eb',
    subtle: '#f3f4f6',
    strong: '#d1d5db',
  },

  text: {
    primary: '#111827',
    secondary: '#4b5563',
    subtle: '#6b7280',
    verySubtle: '#9ca3af',
    disabled: '#9ca3af',
    inverted: '#ffffff',
    link: '#6c7fd8',
    linkHover: '#5568c4',
  },

  status: {
    ok: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#6c7fd8',
    pending: '#6b7280',
    running: '#6c7fd8',
    aborted: '#374151',
    gold: '#f3ba37',
  },

  statusBackground: {
    error: '#fef2f2',
    warning: '#fffbeb',
    info: '#eef2ff',
    success: '#f0fdf4',
  },

  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    smBlur: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
    card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
    md: '0 2px 8px 0 rgba(0, 0, 0, 0.08)',
    lg: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    xl: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },

  scrim: {
    subtle: 'rgba(0, 0, 0, 0.03)',
    low: 'rgba(0, 0, 0, 0.08)',
    med: 'rgba(0, 0, 0, 0.18)',
    high: 'rgba(0, 0, 0, 0.45)',
    solid: 'rgba(0, 0, 0, 0.75)',
  },

  gradient: {
    header: 'linear-gradient(90deg, #6c7fd8 0%, #7c8ee0 100%)',
    cardHeader: 'linear-gradient(135deg, #6c7fd8 0%, #7c8ee0 100%)',
    burst: 'linear-gradient(135deg, #6c7fd8 0%, #a8b5ff 100%)',
  },

  editor: {
    background: '#fafbfc',
    errorPanelBackground: '#f5f5f5',
    codeMirrorTheme: 'light',
  },

  entityKind: {
    system: { accent: '#6c7fd8', tint: '#eef0fa' },
    component: { accent: '#64748b', tint: '#f1f5f9' },
    api: { accent: '#6c7fd8', tint: '#eef0fa' },
    group: { accent: '#6b7280', tint: '#f3f4f6' },
    user: { accent: '#6b7280', tint: '#f3f4f6' },
    resource: { accent: '#6b7280', tint: '#f3f4f6' },
    domain: { accent: '#6c7fd8', tint: '#eef0fa' },
    environment: { accent: '#10b981', tint: '#ecfdf5' },
    dataplane: { accent: '#6b7280', tint: '#f3f4f6' },
    deploymentpipeline: { accent: '#f59e0b', tint: '#fffbeb' },
    observabilityplane: { accent: '#8b5cf6', tint: '#f3f0ff' },
    workflowplane: { accent: '#3b82f6', tint: '#eff6ff' },
    componenttype: { accent: '#f59e0b', tint: '#fffbeb' },
    traittype: { accent: '#10b981', tint: '#ecfdf5' },
    clustercomponenttype: { accent: '#f59e0b', tint: '#fffbeb' },
    clustertraittype: { accent: '#10b981', tint: '#ecfdf5' },
    clusterdataplane: { accent: '#6b7280', tint: '#f3f4f6' },
    clusterobservabilityplane: { accent: '#8b5cf6', tint: '#f3f0ff' },
    clusterworkflowplane: { accent: '#3b82f6', tint: '#eff6ff' },
    workflow: { accent: '#8b5cf6', tint: '#f3f0ff' },
    clusterworkflow: { accent: '#8b5cf6', tint: '#f3f0ff' },
    componentworkflow: { accent: '#3b82f6', tint: '#eff6ff' },
  },
  entityKindDefault: { accent: '#6b7280', tint: '#f3f4f6' },

  graph: {
    edge: '#6c7fd8',
    canvasDotPattern:
      'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)',
    minimapDotPattern:
      'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
    minimapMask: 'rgba(255, 255, 255, 0.75)',
    minimapViewportTint: 'rgba(108, 127, 216, 0.10)',
    minimapViewportBorder: 'rgba(108, 127, 216, 0.45)',
    skeletonStops: [
      'rgba(0, 0, 0, 0.08)',
      'rgba(0, 0, 0, 0.14)',
      'rgba(0, 0, 0, 0.18)',
    ],
    nodeShadowInner: 'rgba(0, 0, 0, 0.10)',
    nodeShadowOuter: 'rgba(0, 0, 0, 0.18)',
    labelPillFill: 'rgba(255, 255, 255, 0.75)',
  },

  navigation: {
    background: '#ffffff',
    indicator: '#6c7fd8',
    color: '#111827',
    selectedColor: '#6c7fd8',
    navItemHoverBackground: '#f9fafb',
    submenuBackground: '#fafbfc',
  },

  banner: {
    info: '#6c7fd8',
    error: '#ef4444',
    text: '#111827',
    link: '#6c7fd8',
    closeButtonColor: '#6b7280',
    warning: '#f59e0b',
  },
  bursts: {
    fontColor: '#111827',
    slackChannelText: '#6b7280',
    backgroundColor: '#fafbfc',
    gradient: 'linear-gradient(135deg, #6c7fd8 0%, #a8b5ff 100%)',
  },
  pinSidebarButton: {
    icon: '#6b7280',
    background: '#fafbfc',
  },

  deletionWarning: '#f59e0b',
};

// ---------------------------------------------------------------------------
// Dark tokens
// ---------------------------------------------------------------------------
// Hues (primary/secondary/info/error/warning/success) are lightened slightly
// for readability against dark surfaces, but brand identity is preserved.

const darkPrimary: ColorScale = {
  light: '#a8b5ff',
  main: '#8fa0ea',
  dark: '#6c7fd8',
};
const darkSecondary: ColorScale = {
  light: '#2a2f3a',
  main: '#9ca3af',
  dark: '#d1d5db',
};
const darkInfo: ColorScale = {
  light: '#1e3a8a',
  main: '#60a5fa',
  dark: '#93c5fd',
};
const darkError: ColorScale = {
  light: '#4c1d1d',
  main: '#f87171',
  dark: '#ef4444',
};
const darkWarning: ColorScale = {
  light: '#3a2a10',
  main: '#fbbf24',
  dark: '#f59e0b',
};
const darkSuccess: ColorScale = {
  light: '#12301f',
  main: '#34d399',
  dark: '#10b981',
};

export const darkTokens: ThemeTokens = {
  mode: 'dark',

  primary: darkPrimary,
  secondary: darkSecondary,
  info: darkInfo,
  error: darkError,
  warning: darkWarning,
  success: darkSuccess,
  grey: {
    50: '#1a1d26',
    100: '#242836',
    200: '#2a2f3a',
    300: '#3a414f',
    400: '#6b7280',
    500: '#9ca3af',
    600: '#d1d5db',
    700: '#e5e7eb',
    800: '#f3f4f6',
    900: '#f9fafb',
  },
  indigo: {
    50: '#1a1d2e',
    100: '#1e2244',
    200: '#2a2f5a',
  },
  common: {
    black: '#f9fafb',
    white: '#0f1117',
  },

  surface: {
    default: '#0f1117',
    paper: '#1a1d26',
    raised: '#242836',
    hover: '#1f2330',
    disabled: '#242836',
    inverted: '#f3f4f6',
  },

  border: {
    default: '#2a2f3a',
    subtle: '#242836',
    strong: '#3a414f',
  },

  text: {
    primary: '#e5e7eb',
    secondary: '#9ca3af',
    subtle: '#9ca3af',
    verySubtle: '#6b7280',
    disabled: '#4b5563',
    inverted: '#0f1117',
    link: '#8fa0ea',
    linkHover: '#a8b5ff',
  },

  status: {
    ok: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#8fa0ea',
    pending: '#9ca3af',
    running: '#8fa0ea',
    aborted: '#6b7280',
    gold: '#f3ba37',
  },

  statusBackground: {
    error: '#2a1515',
    warning: '#2a2010',
    info: '#1a1d2e',
    success: '#12301f',
  },

  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
    smBlur: '0 1px 3px 0 rgba(0, 0, 0, 0.4)',
    card: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 2px 8px 0 rgba(0, 0, 0, 0.45)',
    lg: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.4)',
    xl: '0 10px 15px -3px rgba(0, 0, 0, 0.55), 0 4px 6px -2px rgba(0, 0, 0, 0.4)',
  },

  scrim: {
    subtle: 'rgba(255, 255, 255, 0.05)',
    low: 'rgba(255, 255, 255, 0.08)',
    med: 'rgba(255, 255, 255, 0.14)',
    high: 'rgba(255, 255, 255, 0.28)',
    solid: 'rgba(0, 0, 0, 0.75)',
  },

  gradient: {
    header: 'linear-gradient(90deg, #2a2f5a 0%, #3a3f6e 100%)',
    cardHeader: 'linear-gradient(135deg, #2a2f5a 0%, #3a3f6e 100%)',
    burst: 'linear-gradient(135deg, #2a2f5a 0%, #6c7fd8 100%)',
  },

  editor: {
    background: '#1a1d26',
    errorPanelBackground: '#2d2d2d',
    codeMirrorTheme: 'dark',
  },

  entityKind: {
    system: { accent: '#8fa0ea', tint: '#1a1d2e' },
    component: { accent: '#94a3b8', tint: '#1e2330' },
    api: { accent: '#8fa0ea', tint: '#1a1d2e' },
    group: { accent: '#9ca3af', tint: '#1f2128' },
    user: { accent: '#9ca3af', tint: '#1f2128' },
    resource: { accent: '#9ca3af', tint: '#1f2128' },
    domain: { accent: '#8fa0ea', tint: '#1a1d2e' },
    environment: { accent: '#34d399', tint: '#162a22' },
    dataplane: { accent: '#9ca3af', tint: '#1f2128' },
    deploymentpipeline: { accent: '#fbbf24', tint: '#2a2010' },
    observabilityplane: { accent: '#a78bfa', tint: '#1e1a2e' },
    workflowplane: { accent: '#60a5fa', tint: '#151c2e' },
    componenttype: { accent: '#fbbf24', tint: '#2a2010' },
    traittype: { accent: '#34d399', tint: '#162a22' },
    clustercomponenttype: { accent: '#fbbf24', tint: '#2a2010' },
    clustertraittype: { accent: '#34d399', tint: '#162a22' },
    clusterdataplane: { accent: '#9ca3af', tint: '#1f2128' },
    clusterobservabilityplane: { accent: '#a78bfa', tint: '#1e1a2e' },
    clusterworkflowplane: { accent: '#60a5fa', tint: '#151c2e' },
    workflow: { accent: '#a78bfa', tint: '#1e1a2e' },
    clusterworkflow: { accent: '#a78bfa', tint: '#1e1a2e' },
    componentworkflow: { accent: '#60a5fa', tint: '#151c2e' },
  },
  entityKindDefault: { accent: '#9ca3af', tint: '#1f2128' },

  graph: {
    edge: '#8fa0ea',
    canvasDotPattern:
      'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
    minimapDotPattern:
      'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
    minimapMask: 'rgba(30, 30, 30, 0.75)',
    minimapViewportTint: 'rgba(143, 160, 234, 0.10)',
    minimapViewportBorder: 'rgba(143, 160, 234, 0.50)',
    skeletonStops: [
      'rgba(255, 255, 255, 0.14)',
      'rgba(255, 255, 255, 0.22)',
      'rgba(255, 255, 255, 0.28)',
    ],
    nodeShadowInner: 'rgba(0, 0, 0, 0.35)',
    nodeShadowOuter: 'rgba(0, 0, 0, 0.55)',
    labelPillFill: 'rgba(30, 30, 30, 0.65)',
  },

  navigation: {
    background: '#14171f',
    indicator: '#8fa0ea',
    color: '#d1d5db',
    selectedColor: '#a8b5ff',
    navItemHoverBackground: '#1f2330',
    submenuBackground: '#0f1117',
  },

  banner: {
    info: '#8fa0ea',
    error: '#f87171',
    text: '#e5e7eb',
    link: '#a8b5ff',
    closeButtonColor: '#9ca3af',
    warning: '#fbbf24',
  },
  bursts: {
    fontColor: '#e5e7eb',
    slackChannelText: '#9ca3af',
    backgroundColor: '#1a1d26',
    gradient: 'linear-gradient(135deg, #2a2f5a 0%, #6c7fd8 100%)',
  },
  pinSidebarButton: {
    icon: '#9ca3af',
    background: '#1a1d26',
  },

  deletionWarning: '#fbbf24',
};
