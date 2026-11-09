import { makeStyles, type Theme } from '@material-ui/core/styles';

/**
 * Neither Material UI nor Backstage's theme has a monospace font slot, so
 * code shares this stack, sized from the theme's own body text.
 */
export const CODE_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** Inline code and fact values, and code blocks on the theme's code surface. */
export const useCodeStyles = makeStyles((theme: Theme) => ({
  code: {
    fontFamily: CODE_FONT_FAMILY,
    fontSize: theme.typography.body2.fontSize,
  },
  codeBlock: {
    fontFamily: CODE_FONT_FAMILY,
    fontSize: theme.typography.body2.fontSize,
    backgroundColor:
      theme.palette.code?.background ?? theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(0.5, 1),
  },
}));
