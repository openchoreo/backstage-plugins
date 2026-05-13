import { Box, IconButton, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import { useEffect, type ReactNode } from 'react';

const useStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    // Match the deploy list view's height contract so the inner page never
    // pushes Backstage's <Page> into external scroll. 200px accounts for the
    // entity header (~104px) + tab strip (~50px) + <Content> 24px top + 24px
    // bottom + a small bottom buffer. `min-height` covers tiny viewports.
    height: 'calc(100vh - 200px)',
    minHeight: 480,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
  backControl: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    marginRight: theme.spacing(1),
  },
  kbdChip: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 14,
    padding: '0 4px',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 3,
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.secondary,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: 9,
    lineHeight: 1,
    fontWeight: 500,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  titleContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontWeight: 600,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(2),
  },
}));

export interface DetailPageLayoutProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Shared layout component for detail pages (Overrides, Release Details, Workload Config, Workflow Config)
 * Provides consistent header with back button, title, and optional actions
 */
export const DetailPageLayout = ({
  title,
  subtitle,
  onBack,
  actions,
  children,
}: DetailPageLayoutProps) => {
  const classes = useStyles();

  // Esc closes the page via the same path as the back arrow, so the
  // unsaved-changes dialog (when present) still fires. Skip when the user
  // is typing in a field — Esc-while-typing is a common reflex.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = document.activeElement as HTMLElement | null;
      if (!target) {
        onBack();
        return;
      }
      const tag = target.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable;
      if (isEditable) return;
      onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Box className={classes.headerLeft}>
          <Box className={classes.backControl}>
            <IconButton onClick={onBack} size="small" title="Back (Esc)">
              <ArrowBackIcon />
            </IconButton>
            <kbd
              className={classes.kbdChip}
              aria-label="Press Escape to go back"
            >
              Esc
            </kbd>
          </Box>
          <Box className={classes.titleContainer}>
            <Typography variant="h5" className={classes.title}>
              {title}
            </Typography>
            {subtitle && (
              <Box className={classes.subtitle}>
                {typeof subtitle === 'string' ? (
                  <Typography variant="body2" color="textSecondary">
                    {subtitle}
                  </Typography>
                ) : (
                  subtitle
                )}
              </Box>
            )}
          </Box>
        </Box>
        {actions && <Box className={classes.actions}>{actions}</Box>}
      </Box>
      <Box className={classes.content}>{children}</Box>
    </Box>
  );
};
