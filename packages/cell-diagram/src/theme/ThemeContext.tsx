import { createContext, useContext } from 'react';
import { CellDiagramColors, CellDiagramThemeMode, lightColors } from './colors';

export interface CellDiagramThemeContextValue {
  mode: CellDiagramThemeMode;
  colors: CellDiagramColors;
}

/**
 * Context default — light mode with the historical palette. Components
 * rendered outside `<CellDiagramThemeProvider>` therefore behave exactly as
 * they did before dark-mode support landed.
 */
const defaultValue: CellDiagramThemeContextValue = {
  mode: 'light',
  colors: lightColors,
};

export const CellDiagramThemeContext =
  createContext<CellDiagramThemeContextValue>(defaultValue);

/** Returns the active color palette. */
export function useColors(): CellDiagramColors {
  return useContext(CellDiagramThemeContext).colors;
}

/** Returns the active mode (`'light' | 'dark'`). */
export function useThemeMode(): CellDiagramThemeMode {
  return useContext(CellDiagramThemeContext).mode;
}
