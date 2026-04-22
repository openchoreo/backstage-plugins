import {
  createUnifiedTheme,
  createBaseThemeOptions,
  UnifiedTheme,
} from '@backstage/theme';
import { alpha } from '@material-ui/core/styles';
import { ThemeTokens } from './tokens';

const fontFamily = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  '"Noto Sans"',
  'Helvetica',
  'Arial',
  'sans-serif',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
].join(', ');

/** Replacement for theme.spacing() from mui — mirrors Backstage convention. */
const spacing = (...args: number[]) => args.map(v => `${v * 8}px`).join(' ');

/**
 * Builds a unified Backstage/MUI theme from a token set.
 *
 * IMPORTANT: the light path is intentionally byte-identical to the original
 * hand-written `openChoreoTheme.ts`. Do not introduce new palette slots (like
 * MuiCard backgroundColor, explicit text/background/divider entries, or
 * tweaked alpha values) into the light branch — those regressed surfaces like
 * the page-header title color and the card backgrounds in a previous port.
 *
 * Dark-only adjustments live behind `t.mode === 'dark'` gates and/or the
 * token lookups that evaluate to the original literals for light.
 */
export function buildOpenChoreoTheme(t: ThemeTokens): UnifiedTheme {
  const isDark = t.mode === 'dark';

  const baseThemeOptions = createBaseThemeOptions({
    fontFamily,
    palette: {
      // IMPORTANT: do NOT spread `palettes.light` / `palettes.dark` from
      // `@backstage/theme` here. Those sets declare `background.default: #F8F8F8`
      // (light) which gets picked up by Backstage's default `MuiTableRow`
      // override and paints odd body rows grey. The original theme never
      // spread those palettes; MUI's own defaults (white page bg, etc.) are
      // what we want for light mode.
      type: t.mode,
      primary: t.primary,
      secondary: t.secondary,
      info: t.info,
      error: t.error,
      warning: t.warning,
      success: t.success,
      grey: t.grey,
      common: t.common,
      // Only override MUI text/background/divider in dark mode. Light mode
      // leaves these as MUI defaults (matches original).
      ...(isDark
        ? {
            text: {
              primary: t.text.primary,
              secondary: t.text.secondary,
              disabled: t.text.disabled,
            },
            background: {
              default: t.surface.default,
              paper: t.surface.paper,
            },
            divider: t.border.default,
          }
        : {}),
      // Backstage-specific palette additions (the original file set all of
      // these; keep them for both modes).
      status: {
        ok: t.status.ok,
        warning: t.status.warning,
        error: t.status.error,
        pending: t.status.pending,
        running: t.status.running,
        aborted: t.status.aborted,
      },
      border: t.border.default,
      textContrast: t.text.primary,
      textVerySubtle: t.text.verySubtle,
      textSubtle: t.text.secondary,
      highlight: t.primary.main,
      errorBackground: t.statusBackground.error,
      warningBackground: t.statusBackground.warning,
      infoBackground: t.statusBackground.info,
      errorText: t.error.dark,
      infoText: t.info.main,
      warningText: t.warning.dark,
      linkHover: t.text.linkHover,
      link: t.text.link,
      gold: t.status.gold,
      navigation: {
        background: t.navigation.background,
        indicator: t.navigation.indicator,
        color: t.navigation.color,
        selectedColor: t.navigation.selectedColor,
        navItem: {
          hoverBackground: t.navigation.navItemHoverBackground,
        },
        submenu: {
          background: t.navigation.submenuBackground,
        },
      },
      tabbar: {
        indicator: t.primary.main,
      },
      bursts: {
        fontColor: t.bursts.fontColor,
        slackChannelText: t.bursts.slackChannelText,
        backgroundColor: {
          default: t.bursts.backgroundColor,
        },
        gradient: {
          linear: t.bursts.gradient,
        },
      },
      pinSidebarButton: {
        icon: t.pinSidebarButton.icon,
        background: t.pinSidebarButton.background,
      },
      banner: {
        info: t.banner.info,
        error: t.banner.error,
        text: t.banner.text,
        link: t.banner.link,
        closeButtonColor: t.banner.closeButtonColor,
        warning: t.banner.warning,
      },
      code: {
        background: t.editor.background,
      },
    },
    typography: {
      fontFamily,
      htmlFontSize: 15,
      h1: { fontSize: 38, fontWeight: 700, marginBottom: 0 },
      h2: { fontSize: 28, fontWeight: 700, marginBottom: 0 },
      h3: { fontSize: 20, fontWeight: 600, marginBottom: 0 },
      h4: { fontSize: 16, fontWeight: 600, marginBottom: 0 },
      h5: { fontSize: 14, fontWeight: 600, marginBottom: 0 },
      h6: { fontSize: 13, fontWeight: 600, marginBottom: 0 },
    },
  });

  return createUnifiedTheme({
    ...baseThemeOptions,
    components: {
      BackstageHeader: {
        styleOverrides: {
          header: {
            backgroundColor: t.primary.main,
            backgroundImage: t.gradient.header,
            minHeight: spacing(6),
            // Original: `0 1px 3px 0 rgba(0, 0, 0, 0.05)` — 3px blur.
            boxShadow: t.shadow.smBlur,
            rowGap: spacing(2),
            columnGap: spacing(2),
          },
          // Original did not set a `color` here — Backstage's default
          // page-theme color (white on the primary gradient) applies. Do not
          // re-introduce a `color` property in light mode; doing so in the
          // previous port flipped the title to black.
          title: {
            fontSize: 22,
            fontWeight: 600,
          },
        },
      },
      BackstageItemCardHeader: {
        styleOverrides: {
          root: {
            backgroundColor: t.primary.main,
            backgroundImage: `${t.gradient.cardHeader}!important`,
          },
        },
      },
      BackstageSidebarItem: {
        styleOverrides: {
          root: {
            paddingTop: 6,
            paddingBottom: 6,
          },
          label: {
            fontWeight: 500,
            fontSize: 14,
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          'body, html': {
            fontFamily: `${fontFamily} !important`,
          },
          'nav[aria-label="sidebar nav"] hr': {
            opacity: 0.2,
          },
          'g[data-testid="node"] rect': {
            '&.primary': {
              fill: `${t.primary.dark} !important`,
              stroke: `${t.primary.dark} !important`,
              strokeWidth: '2px !important',
            },
            '&.secondary': {
              fill: `${t.secondary.dark} !important`,
              stroke: `${t.secondary.dark} !important`,
              strokeWidth: '2px !important',
            },
          },
          // Original used `alpha(common.black, 0.1)` with black = `#111827`.
          // Keep the 0.1 opacity exactly (the previous port silently lowered
          // it to 0.08).
          '.MuiTab-root:hover': {
            backgroundColor: `${alpha(t.common.black, 0.1)} !important`,
            color: `${t.common.black} !important`,
            textDecoration: 'none !important',
          },
          'a[role="tab"]:hover': {
            backgroundColor: `${alpha(t.common.black, 0.1)} !important`,
            color: `${t.common.black} !important`,
            textDecoration: 'none !important',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            borderRadius: 8,
            padding: '8px 16px',
            transition: 'all 0.2s ease-in-out',
          },
          contained: {
            boxShadow: t.shadow.sm,
            '&:hover': {
              boxShadow: t.shadow.lg,
            },
          },
          outlined: {
            borderWidth: '1.5px',
            '&:hover': {
              borderWidth: '1.5px',
            },
          },
        },
      },
      MuiTypography: {
        styleOverrides: {
          // Original bound body1/body2 text color to `colors.secondary.dark`
          // (`#374151`). We keep that exact color for light via `t.grey[700]`,
          // and use the dark token in dark mode for readability.
          body1: {
            fontSize: 14,
            fontWeight: 'normal',
            fontStretch: 'normal',
            fontStyle: 'normal',
            lineHeight: 1.6,
            letterSpacing: 'normal',
            color: isDark ? t.text.primary : t.secondary.dark,
          },
          body2: {
            fontSize: 13,
            fontWeight: 'normal',
            fontStretch: 'normal',
            fontStyle: 'normal',
            lineHeight: 1.5,
            letterSpacing: 'normal',
            color: isDark ? t.text.secondary : t.secondary.dark,
          },
        },
      },
      BackstageTableHeader: {
        styleOverrides: {
          header: {
            textTransform: 'none',
            // Original pinned this to `#6b7280!important`. In light,
            // `t.secondary.main` resolves to the same value; in dark we let
            // `t.text.secondary` take over.
            color: `${isDark ? t.text.secondary : t.secondary.main}!important`,
            fontWeight: 500,
            fontSize: 13,
            borderTop: 'none',
            paddingTop: '12px',
            paddingBottom: '12px',
          },
        },
      },
      BackstageInfoCard: {
        styleOverrides: {
          headerTitle: {
            fontWeight: 600,
          },
        },
      },
      BackstageSelectInputBase: {
        styleOverrides: {
          input: {
            borderColor: t.grey[200],
            borderRadius: 8,
            transition: 'border-color 0.2s ease-in-out',
            '&:focus': {
              borderRadius: 8,
            },
          },
        },
      },
      BackstageMetadataTableTitleCell: {
        styleOverrides: {
          root: {
            width: '1%',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: '12px 20px !important',
            // Original: `1px solid #f3f4f6` (grey[100]).
            borderBottom: `1px solid ${t.grey[100]}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          // Do NOT add `backgroundColor` here — the original didn't, and
          // forcing it to `#ffffff` in a previous port overrode Backstage's
          // paper background on light surfaces that relied on the default.
          root: {
            borderRadius: 12,
            border: `1px solid ${t.grey[100]}`,
            // Two-stop soft card shadow — matches the original byte-for-byte.
            boxShadow: t.shadow.card,
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: '24px',
            '&:last-child': {
              paddingBottom: '24px',
            },
          },
        },
      },
      MuiCardHeader: {
        styleOverrides: {
          root: {
            padding: '20px 24px',
          },
          title: {
            fontSize: 16,
            fontWeight: 600,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
        },
        styleOverrides: {
          root: {
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: `${t.primary.light} !important`,
            },
          },
        },
      },
      MuiSelect: {
        defaultProps: {
          variant: 'outlined',
        },
        styleOverrides: {
          select: {
            fontSize: 14,
          },
        },
      },
      MuiInput: {
        styleOverrides: {
          root: {
            // Original: `colors.secondary.light` (`#fafbfc`).
            backgroundColor: isDark ? t.surface.paper : t.secondary.light,
            border: `1px solid ${t.grey[300]}`,
            transition: 'all 0.3s',
            borderRadius: 8,
            padding: '2px 4px',
            color: 'inherit',
            fontSize: 14,
            '&:before': { display: 'none' },
            '&:after': { display: 'none' },
            '&:hover:not(.Mui-disabled):before': { display: 'none' },
            '&:hover:not(.Mui-focused)': {
              borderColor: t.primary.light,
            },
            '&.Mui-focused': {
              borderColor: t.primary.main,
              borderWidth: 2,
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            // Original: hardcoded `#ffffff`. In light we need the paper
            // surface; in dark we use the dark paper.
            backgroundColor: isDark ? t.surface.paper : t.common.white,
            fontSize: 14,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: t.grey[300],
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: t.primary.main,
              borderWidth: '2px',
            },
          },
          notchedOutline: {
            borderColor: t.grey[200],
            borderRadius: 8,
            transition: 'border-color 0.2s ease-in-out',
          },
          input: {
            fontSize: 14,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          // Default (uncolored) chip — set bg/text explicitly per mode so
          // chips without a color variant stay legible in dark. MUI v4's
          // built-in default assumes `palette.type === 'light'` and paints
          // near-white bg + black text, which is unreadable in dark mode.
          root: {
            borderRadius: '16px',
            fontWeight: 500,
            height: 'auto',
            padding: '4px 0',
            marginTop: '4px',
            marginBottom: '4px',
            marginRight: '4px',
            ...(isDark
              ? {
                  backgroundColor: t.surface.raised,
                  color: t.text.primary,
                }
              : {}),
          },
          // Outlined chip — MUI v4 sets `color: rgba(0,0,0,0.87)` on the
          // base which is invisible against dark surfaces. Force the
          // outlined label/border to follow the current text/divider tokens.
          outlined: isDark
            ? {
                color: t.text.primary,
                borderColor: t.border.default,
              }
            : {},
          // Original used hex + alpha suffix notation (`#f0f1fb25`,
          // `#f0f1fb50`). MUI's `alpha()` uses an `rgba()` form — keep the
          // original suffix notation in light to match byte-for-byte; use
          // the MUI helper in dark where the visual effect is what matters.
          colorPrimary: isDark
            ? {
                backgroundColor: alpha(t.primary.main, 0.15),
                color: t.primary.main,
                border: `1px solid ${alpha(t.primary.main, 0.3)}`,
              }
            : {
                backgroundColor: `${t.primary.light}25`,
                color: t.primary.dark,
                border: `1px solid ${t.primary.light}50`,
              },
          colorSecondary: {
            // Original: `colors.secondary.light` (`#fafbfc`).
            backgroundColor: isDark ? t.surface.hover : t.secondary.light,
            color: isDark ? t.text.secondary : t.secondary.dark,
          },
        },
      },
      // `@material-ui/lab`'s `Alert` falls back to `darken(palette.X.main, 0.6)`
      // for its standard-variant backgrounds in dark mode, which lands at a
      // near-black that reads as a failed banner rather than a severity tint.
      // Use the dedicated `X.light` container tones from the dark palette —
      // they're M3-style "error-container / warning-container / ..." tints
      // and give the banner real shape without being eye-searing.
      //
      // Light mode is intentionally untouched so the existing output stays
      // byte-identical (lab's light defaults already look right).
      MuiAlert: isDark
        ? {
            styleOverrides: {
              standardError: {
                backgroundColor: t.error.light,
                color: t.error.main,
                '& .MuiAlert-icon': { color: t.error.main },
              },
              standardWarning: {
                backgroundColor: t.warning.light,
                color: t.warning.main,
                '& .MuiAlert-icon': { color: t.warning.main },
              },
              standardInfo: {
                backgroundColor: t.info.light,
                color: t.info.main,
                '& .MuiAlert-icon': { color: t.info.main },
              },
              standardSuccess: {
                backgroundColor: t.success.light,
                color: t.success.main,
                '& .MuiAlert-icon': { color: t.success.main },
              },
            },
          }
        : {},
      MuiIconButton: {
        styleOverrides: {
          root: {
            padding: 8,
            fontSize: 'inherit',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              // Original: `colors.grey[50]` (`#f9fafb`). In dark mode the
              // grey scale is inverted so `grey[50]` is a dark tone — use
              // `surface.hover` in dark and preserve the literal in light.
              backgroundColor: isDark ? t.surface.hover : t.grey[50],
            },
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: 14,
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: { fontSize: 14 },
          input: { fontSize: 14 },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: { fontSize: 14 },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: { fontSize: 14 },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          root: {
            '& .MuiTypography-root': { fontSize: '14px !important' },
            '& a': { fontSize: '14px !important' },
            '& .MuiLink-root': { fontSize: '14px !important' },
          },
          primary: {
            fontSize: '14px !important',
            '& .MuiTypography-root': { fontSize: '14px !important' },
            '& a': { fontSize: '14px !important' },
            '& .MuiLink-root': { fontSize: '14px !important' },
          },
          secondary: { fontSize: '14px !important' },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: { fontSize: '14px !important' },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          option: { fontSize: 14 },
          input: { fontSize: 14 },
          tag: { fontSize: 14 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: spacing(6.25),
            padding: `${spacing(1.5, 2)} !important`,
            transition: 'background-color 0.2s',
            '@media (min-width: 960px)': {
              minWidth: 'auto',
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: spacing(6.25),
          },
        },
      },
      // Scaffolder stepper form width constraint.
      // Cast needed because the BackstageTemplateStepper type augmentation
      // lives in @backstage/plugin-scaffolder-react/alpha, which the
      // design-system package does not depend on.
      ...({
        BackstageTemplateStepper: {
          styleOverrides: {
            formWrapper: {
              maxWidth: 900,
              marginLeft: 'auto',
              marginRight: 'auto',
            },
            footer: {
              maxWidth: 900,
              marginLeft: 'auto',
              marginRight: 'auto',
            },
          },
        },
      } as any),
    },
  });
}
