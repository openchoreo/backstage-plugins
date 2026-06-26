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

import { createContext, useContext } from 'react';
import {
    CellDiagramColors,
    CellDiagramThemeMode,
    lightColors,
} from './colors';

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
