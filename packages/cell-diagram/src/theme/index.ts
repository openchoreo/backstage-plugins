/*
 * Copyright (c) 2025, WSO2 LLC. (http://www.wso2.com) All Rights Reserved.
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

export { lightColors, darkColors, presetForMode } from './colors';
export type { CellDiagramColors, CellDiagramThemeMode } from './colors';
export {
    CellDiagramThemeContext,
    useColors,
    useThemeMode,
} from './ThemeContext';
export type { CellDiagramThemeContextValue } from './ThemeContext';
export { CellDiagramThemeProvider } from './CellDiagramThemeProvider';
export type { CellDiagramThemeProviderProps } from './CellDiagramThemeProvider';
