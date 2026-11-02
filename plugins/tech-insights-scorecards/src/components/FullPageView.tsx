import { useEffect, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import { CODE_FONT_FAMILY } from './codeStyles';

const useStyles = makeStyles(theme => ({
  header: {
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  backControl: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    marginRight: theme.spacing(1),
  },
  kbd: {
    minWidth: 22,
    padding: '0 4px',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 3,
    color: theme.palette.text.secondary,
    fontFamily: CODE_FONT_FAMILY,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: 1.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    fontWeight: 600,
  },
}));

const OVERLAY_SELECTOR =
  '[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"], [aria-modal="true"], dialog[open]';

interface FullPageViewProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack: () => void;
  children: ReactNode;
}

/**
 * A view that replaces the page body, with a back arrow and Esc to return.
 * Esc is ignored while typing in a field or inside an open overlay, so
 * closing a dropdown or dialog doesn't also leave the view.
 */
export function FullPageView({
  title,
  subtitle,
  onBack,
  children,
}: FullPageViewProps) {
  const classes = useStyles();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if ((e.target as HTMLElement | null)?.closest?.(OVERLAY_SELECTOR)) return;
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest?.(OVERLAY_SELECTOR)) return;
      if (
        active &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) ||
          active.isContentEditable)
      ) {
        return;
      }
      onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  return (
    <Box>
      <Box className={classes.header}>
        <Box className={classes.backControl}>
          <IconButton onClick={onBack} size="small" title="Back (Esc)">
            <ArrowBackIcon />
          </IconButton>
          <kbd className={classes.kbd} aria-label="Press Escape to go back">
            Esc
          </kbd>
        </Box>
        <Box>
          <Typography variant="h5" className={classes.title}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="textSecondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {children}
    </Box>
  );
}
