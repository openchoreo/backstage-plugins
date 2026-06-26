import { CellDiagramColors } from './colors';

/**
 * Module augmentation so `styled\`color: ${({ theme }) => theme.colors.X}\``
 * is strongly typed inside the cell-diagram package.
 *
 * Note: this augments the `Theme` interface globally for the package, but
 * because we wrap the diagram in our own Emotion `<ThemeProvider>` the
 * augmentation is only meaningful inside cell-diagram's own styled
 * components. Consumer apps with their own Emotion theme are unaffected at
 * runtime — they still get whatever theme they passed; this just satisfies
 * TypeScript at build time.
 */
declare module '@emotion/react' {
    export interface Theme {
        colors: CellDiagramColors;
    }
}
