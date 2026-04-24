import { buildOpenChoreoTheme } from './buildOpenChoreoTheme';
import { lightTokens } from './tokens';

/**
 * Default OpenChoreo light theme. For the dark variant, see `openChoreoDarkTheme`.
 * Both are produced by the same factory — to add a new theme, define a new
 * `ThemeTokens` object in `./tokens.ts` and build it here.
 */
export const openChoreoTheme = buildOpenChoreoTheme(lightTokens);
