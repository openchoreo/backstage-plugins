import { ReactNode, useMemo } from 'react';
import {
    ThemeProvider as EmotionThemeProvider,
    useTheme as useEmotionTheme,
} from '@emotion/react';
import { createTheme } from '@mui/material/styles';
import {
    CellDiagramColors,
    CellDiagramThemeMode,
    presetForMode,
} from './colors';
import {
    CellDiagramThemeContext,
    CellDiagramThemeContextValue,
} from './ThemeContext';

export interface CellDiagramThemeProviderProps {
    /** Preset to start from. Defaults to `'light'`. */
    mode?: CellDiagramThemeMode;
    /**
     * Optional per-token overrides merged on top of the preset. Use this to
     * snap the diagram to a host brand palette without giving up the preset
     * defaults for the rest of the tokens.
     */
    colors?: Partial<CellDiagramColors>;
    children: ReactNode;
}

/**
 * Default MUI v5 theme used when the diagram is rendered without a host
 * `ThemeProvider`. We compute it once at module load — its fields
 * (`palette`, `typography`, `zIndex`, etc.) are what MUI v5 components like
 * `Tooltip`, `IconButton`, and `CircularProgress` require to render.
 *
 * The MUI palette `mode` is set per-render via the provider below so MUI's
 * own light/dark defaults (e.g. `palette.action.*`) line up with the
 * diagram's `mode` prop.
 */
const muiDefaultLight = createTheme({ palette: { mode: 'light' } });
const muiDefaultDark = createTheme({ palette: { mode: 'dark' } });

/**
 * Internal provider used by `<CellDiagram>` to expose the active palette to
 * every styled component in the tree.
 *
 * Routes through:
 *   1. `CellDiagramThemeContext` — for hook consumers (`useColors`).
 *   2. Emotion's `ThemeProvider` — for `styled\`...\`` template literals
 *      that interpolate `({ theme }) => theme.colors.X`.
 *
 * **Why we merge with a MUI theme**: MUI v5 components (`Tooltip`,
 * `IconButton`, `CircularProgress`, …) read their theme from the same
 * Emotion context this provider sets. If we hand them a bare
 * `{ colors: ... }` object they crash trying to read `theme.zIndex.tooltip`
 * / `theme.typography.pxToRem` / `theme.palette.primary`. So we always
 * merge our `colors` token bag on top of either the parent theme (if a host
 * `ThemeProvider` is in scope) or MUI's default theme — preserving every
 * field MUI v5 needs while adding `colors` for our own styled components.
 */
export function CellDiagramThemeProvider({
    mode = 'light',
    colors,
    children,
}: CellDiagramThemeProviderProps) {
    const parentTheme = useEmotionTheme() as unknown as Record<string, unknown>;

    const value = useMemo<CellDiagramThemeContextValue>(() => {
        const preset = presetForMode(mode);
        const merged: CellDiagramColors = colors
            ? { ...preset, ...colors }
            : preset;
        return { mode, colors: merged };
    }, [mode, colors]);

    const emotionTheme = useMemo(() => {
        // Treat the parent theme as a base only if it looks like a MUI
        // theme (has `palette`). Otherwise fall back to a fresh MUI default
        // matching our active mode so MUI v5 components have what they
        // need.
        const hasMuiShape =
            parentTheme &&
            typeof parentTheme === 'object' &&
            'palette' in parentTheme &&
            'typography' in parentTheme;
        let base;
        if (hasMuiShape) {
            base = parentTheme;
        } else if (mode === 'dark') {
            base = muiDefaultDark;
        } else {
            base = muiDefaultLight;
        }
        return { ...base, colors: value.colors };
    }, [parentTheme, mode, value.colors]);

    return (
        <CellDiagramThemeContext.Provider value={value}>
            <EmotionThemeProvider theme={emotionTheme}>
                {children}
            </EmotionThemeProvider>
        </CellDiagramThemeContext.Provider>
    );
}
