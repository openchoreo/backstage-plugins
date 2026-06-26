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

/**
 * The full color vocabulary the cell diagram paints with.
 *
 * The shape mirrors a Material You-style token system. `lightColors` is the
 * historical default and matches the original `Colors` enum byte-for-byte;
 * `darkColors` is the dark-mode counterpart. Host applications can also
 * override individual tokens by passing a `colors` prop to `<CellDiagram>`.
 */
export type CellDiagramColors = {
    PRIMARY: string;
    ON_PRIMARY: string;
    PRIMARY_CONTAINER: string;
    /** Hover accent for primary-tinted clickable surfaces (e.g. project node title). */
    PRIMARY_HOVER: string;

    SECONDARY: string;
    ON_SECONDARY: string;
    SECONDARY_CONTAINER: string;

    SURFACE_BRIGHT: string;
    SURFACE: string;
    SURFACE_DIM: string;
    SURFACE_CONTAINER: string;
    ON_SURFACE: string;
    ON_SURFACE_VARIANT: string;

    OUTLINE: string;
    OUTLINE_VARIANT: string;

    ERROR: string;
};

/** Default light palette — byte-identical to the original `Colors` enum. */
export const lightColors: Readonly<CellDiagramColors> = Object.freeze({
    PRIMARY: '#5567D5',
    ON_PRIMARY: '#FFF',
    PRIMARY_CONTAINER: '#F0F1FB',
    PRIMARY_HOVER: '#2c09ed',

    SECONDARY: '#ffaf4d',
    ON_SECONDARY: '#FFF',
    SECONDARY_CONTAINER: '#fffaf2',

    SURFACE_BRIGHT: '#FFF',
    SURFACE: '#F7F8FB',
    SURFACE_DIM: '#CBCEDB',
    SURFACE_CONTAINER: '#cfd1f3',
    ON_SURFACE: '#000',
    ON_SURFACE_VARIANT: '#40404B',

    OUTLINE: '#393939',
    OUTLINE_VARIANT: '#808080',

    ERROR: '#ED2633',
});

/**
 * Dark palette, built against Material 3 dark-surface elevation tokens.
 *
 * M3 stacks dark surfaces by layering white at fixed opacities on top of
 * a neutral base. We use a cool neutral base (`#12131A`) and pre-compute
 * elevated surfaces so they read as distinct depth planes:
 *   - SURFACE_BRIGHT (canvas):      base + 0%   → deepest
 *   - SURFACE_DIM    (ports/dots):  base + 8%   → mid, still on canvas
 *   - SURFACE        (node fill):   base + 14%  → elevated (M3 level 5)
 *   - SURFACE_CONTAINER (markers):  base + 11%  → slightly below nodes
 *
 * Brand accents (PRIMARY, SECONDARY, ERROR) stay identical to the light
 * palette so link strokes and status indicators remain recognizable.
 * `ON_SURFACE` hits ~90% white for high-emphasis text; `ON_SURFACE_VARIANT`
 * sits at ~75% for medium-emphasis (labels, secondary chrome).
 */
export const darkColors: Readonly<CellDiagramColors> = Object.freeze({
    // Primary lifted one tone for dark surfaces per M3 guidance — the
    // light-mode `#5567D5` reads as harsh "brand on light" when placed
    // on a dark canvas. `#8FA0EA` still reads as the same hue family
    // but meets WCAG AA against `SURFACE_BRIGHT`.
    PRIMARY: '#8FA0EA',
    ON_PRIMARY: '#1A1F3A',
    PRIMARY_CONTAINER: '#3A4272',
    PRIMARY_HOVER: '#B3BFF0',

    SECONDARY: '#FFC27A',
    ON_SECONDARY: '#2B1C05',
    SECONDARY_CONTAINER: '#4A3518',

    SURFACE_BRIGHT: '#12131A',
    SURFACE: '#2F313C',
    SURFACE_DIM: '#24252F',
    SURFACE_CONTAINER: '#3A3C48',
    ON_SURFACE: '#E8E8EE',
    ON_SURFACE_VARIANT: '#D4D5DE',

    // Container chrome (cell boundary, default link strokes, port rims)
    // recedes in dark mode so components remain the focal point. Text
    // labels previously used this token too — they now read from
    // `ON_SURFACE_VARIANT` so chrome can dim without dimming labels.
    OUTLINE: '#6A6B76',
    OUTLINE_VARIANT: '#45464F',

    ERROR: '#F27580',
});

export type CellDiagramThemeMode = 'light' | 'dark';

/** Resolves the preset palette for a mode. */
export function presetForMode(mode: CellDiagramThemeMode): Readonly<CellDiagramColors> {
    return mode === 'dark' ? darkColors : lightColors;
}
