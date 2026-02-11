import { createUnifiedTheme, createBaseThemeOptions } from '@backstage/theme';

// Color constants for reuse - Modern & Minimal palette
const colors = {
  primary: {
    light: '#f0f1fb',
    main: '#6c7fd8', // Softer, less saturated blue
    dark: '#5568c4',
  },
  secondary: {
    light: '#fafbfc', // Lighter, more subtle background
    main: '#6b7280', // Darker gray for better contrast
    dark: '#374151', // Darker for better readability
  },
  error: {
    light: '#fef2f2',
    main: '#ef4444',
    dark: '#dc2626',
  },
  warning: {
    light: '#fff5eb',
    main: '#f59e0b',
    dark: '#d97706',
  },
  success: {
    light: '#f0fdf4',
    main: '#10b981',
    dark: '#059669',
  },
  grey: {
    50: '#f9fafb', // Added for very light backgrounds
    100: '#f3f4f6', // Lighter borders
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
  },
  indigo: {
    50: '#f5f7ff',
    100: '#eef2ff',
    200: '#e0e7ff',
  },
  common: {
    black: '#111827', // Darker for better contrast
    white: '#ffffff',
  },
};

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

export const openChoreoTheme = createUnifiedTheme({
  ...createBaseThemeOptions({
    fontFamily,
    palette: {
      ...colors,
      // Backstage-specific palette additions
      status: {
        ok: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        pending: '#6b7280',
        running: '#6c7fd8',
        aborted: '#374151',
      },
      border: '#e5e7eb', // Lighter, more subtle
      textContrast: '#111827', // Darker for better contrast
      textVerySubtle: '#9ca3af', // Improved contrast
      textSubtle: '#4b5563', // Darker for readability
      highlight: '#6c7fd8',
      errorBackground: '#fef2f2',
      warningBackground: '#fffbeb',
      infoBackground: '#eef2ff',
      errorText: '#dc2626',
      infoText: '#6c7fd8',
      warningText: '#d97706',
      linkHover: '#5568c4',
      link: '#6c7fd8',
      gold: '#f59e0b',
      navigation: {
        background: '#ffffff',
        indicator: '#6c7fd8',
        color: '#111827',
        selectedColor: '#6c7fd8',
        navItem: {
          hoverBackground: '#f9fafb', // Lighter hover state
        },
        submenu: {
          background: '#fafbfc',
        },
      },
      tabbar: {
        indicator: '#6c7fd8',
      },
      bursts: {
        fontColor: '#111827',
        slackChannelText: '#6b7280',
        backgroundColor: {
          default: '#fafbfc',
        },
        gradient: {
          linear: 'linear-gradient(135deg, #6c7fd8 0%, #a8b5ff 100%)',
        },
      },
      pinSidebarButton: {
        icon: '#6b7280',
        background: '#fafbfc',
      },
      banner: {
        info: '#6c7fd8',
        error: '#ef4444',
        text: '#111827',
        link: '#6c7fd8',
        closeButtonColor: '#6b7280',
        warning: '#f59e0b',
      },
      code: {
        background: '#fafbfc',
      },
    },
    typography: {
      fontFamily,
      htmlFontSize: 15,
      h1: {
        fontSize: 38, // Slightly smaller for better proportions
        fontWeight: 700,
        marginBottom: 0,
      },
      h2: {
        fontSize: 28,
        fontWeight: 700,
        marginBottom: 0,
      },
      h3: {
        fontSize: 20, // More refined scale
        fontWeight: 600,
        marginBottom: 0,
      },
      h4: {
        fontSize: 16,
        fontWeight: 600,
        marginBottom: 0,
      },
      h5: {
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 0,
      },
      h6: {
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 0,
      },
    },
  }),
  components: {
    BackstageHeader: {
      styleOverrides: {
        header: {
          backgroundColor: colors.primary.main,
          backgroundImage: 'linear-gradient(90deg, #6c7fd8 0%, #7c8ee0 100%)', // Subtle gradient
          height: 72, // Reduced from 98px for modern look
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', // Subtle shadow
        },
        title: {
          fontSize: 22, // Slightly smaller, more proportional
          fontWeight: 600,
        },
      },
    },
    BackstageItemCardHeader: {
      styleOverrides: {
        root: {
          backgroundColor: colors.primary.main,
          backgroundImage:
            'linear-gradient(135deg, #6c7fd8 0%, #7c8ee0 100%)!important',
        },
      },
    },
    BackstageSidebarItem: {
      styleOverrides: {
        root: {
          paddingTop: 6, // More vertical spacing
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
        // Sidebar divider opacity - use aria-label selector to work in both dev and production
        'nav[aria-label="sidebar nav"] hr': {
          opacity: 0.2,
        },
        // SVG elements in the entity relations diagram
        'g[data-testid="node"] rect': {
          '&.primary': {
            fill: `${colors.primary.dark} !important`,
            stroke: `${colors.primary.dark} !important`,
            strokeWidth: '2px !important',
          },
          '&.secondary': {
            fill: `${colors.secondary.dark} !important`,
            stroke: `${colors.secondary.dark} !important`,
            strokeWidth: '2px !important',
          },
        },
        'g[data-testid="node"] text': {
          fill: `${colors.common.white} !important`,
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
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          '&:hover': {
            boxShadow:
              '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
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
        body1: {
          fontSize: 14,
          fontWeight: 'normal',
          fontStretch: 'normal',
          fontStyle: 'normal',
          lineHeight: 1.6, // Improved readability
          letterSpacing: 'normal',
          color: colors.secondary.dark, // Better contrast
        },
        body2: {
          fontSize: 13,
          fontWeight: 'normal',
          fontStretch: 'normal',
          fontStyle: 'normal',
          lineHeight: 1.5, // Improved readability
          letterSpacing: 'normal',
          color: colors.secondary.dark,
        },
      },
    },
    BackstageTableHeader: {
      styleOverrides: {
        header: {
          textTransform: 'none',
          color: '#6b7280!important', // Better contrast
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
          borderColor: colors.grey[200],
          borderRadius: 8,
          transition: 'border-color 0.2s ease-in-out',
          '&:focus': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '12px 20px !important', // More generous padding
          borderBottom: '1px solid #f3f4f6', // Lighter borders
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12, // More rounded for modern look
          border: '1px solid #f3f4f6', // Subtle border
          boxShadow:
            '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)', // Softer shadow
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '24px', // More generous internal padding
          '&:last-child': {
            paddingBottom: '24px', // Override Material-UI default
          },
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          padding: '20px 24px', // Consistent with card content
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
            borderColor: `${colors.primary.light} !important`,
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
          backgroundColor: colors.secondary.light,
          border: `1px solid ${colors.grey[300]}`,
          transition: 'all 0.3s',
          borderRadius: 8,
          padding: '2px 4px',
          color: 'inherit',
          fontSize: 14,
          '&:before': {
            display: 'none',
          },
          '&:after': {
            display: 'none',
          },
          '&:hover:not(.Mui-disabled):before': {
            display: 'none',
          },
          '&:hover:not(.Mui-focused)': {
            borderColor: colors.primary.light,
          },
          '&.Mui-focused': {
            borderColor: colors.primary.main,
            borderWidth: 2,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          fontSize: 14,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.grey[300],
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.primary.main,
            borderWidth: '2px',
          },
        },
        notchedOutline: {
          borderColor: colors.grey[200],
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
        root: {
          borderRadius: '16px', // More rounded
          fontWeight: 500,
          height: 'auto',
          padding: '4px 0',
          marginTop: '4px',
          marginBottom: '4px',
          marginRight: '4px',
        },
        colorPrimary: {
          backgroundColor: `${colors.primary.light}25`, // Translucent background
          color: colors.primary.dark,
          border: `1px solid ${colors.primary.light}50`,
        },
        colorSecondary: {
          backgroundColor: `${colors.secondary.light}`,
          color: colors.secondary.dark,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: 8, // More generous padding
          fontSize: 'inherit',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: colors.grey[50],
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
        root: {
          fontSize: 14,
        },
        input: {
          fontSize: 14,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: 14,
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          fontSize: 14,
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        root: {
          '& .MuiTypography-root': {
            fontSize: '14px !important',
          },
          '& a': {
            fontSize: '14px !important',
          },
          '& .MuiLink-root': {
            fontSize: '14px !important',
          },
        },
        primary: {
          fontSize: '14px !important',
          '& .MuiTypography-root': {
            fontSize: '14px !important',
          },
          '& a': {
            fontSize: '14px !important',
          },
          '& .MuiLink-root': {
            fontSize: '14px !important',
          },
        },
        secondary: {
          fontSize: '14px !important',
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          fontSize: '14px !important',
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        option: {
          fontSize: 14,
        },
        input: {
          fontSize: 14,
        },
        tag: {
          fontSize: 14,
        },
      },
    },
  },
});
