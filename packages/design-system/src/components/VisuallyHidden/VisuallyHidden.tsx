import { ElementType, ReactNode } from 'react';
import { makeStyles } from '@material-ui/core/styles';

const useVisuallyHiddenStyles = makeStyles({
  root: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
});

export interface VisuallyHiddenProps {
  /** Content to render off-screen but expose to assistive technology. */
  children: ReactNode;
  /** Render-as element. Defaults to `span`. Use `h1`/`h2`/... for headings. */
  as?: ElementType;
}

/**
 * Renders content visually-hidden but available to assistive tech. Used for
 * skip-link targets, page-level headings hidden behind a visual header, and
 * loading-state labels announced via `role="status"`.
 */
export function VisuallyHidden({
  children,
  as: Tag = 'span',
}: VisuallyHiddenProps) {
  const classes = useVisuallyHiddenStyles();
  return <Tag className={classes.root}>{children}</Tag>;
}

/**
 * JSS hook variant for cases where the consumer needs to compose the
 * visually-hidden block with other styles (e.g., a `:focus` override that
 * reveals the element when focused).
 */
export { useVisuallyHiddenStyles };
