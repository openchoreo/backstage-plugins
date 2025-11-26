import { Box, IconButton, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import type { ReactNode } from 'react';

const useStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    // Constrain height to prevent page-level scrolling
    // Accounts for: Backstage header (~72px) + tabs (~69px) + Content padding (48px) + buffer
    height: 'calc(100vh - 240px)',
    maxHeight: 'calc(100vh - 240px)',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  backButton: {
    marginRight: theme.spacing(1),
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
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    paddingTop: theme.spacing(2),
  },
}));

interface DetailPageLayoutProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Shared layout component for detail pages (Overrides, Release Details, Workload Config)
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

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Box className={classes.headerLeft}>
          <IconButton
            onClick={onBack}
            size="small"
            className={classes.backButton}
            title="Back to environments"
          >
            <ArrowBackIcon />
          </IconButton>
          <Box className={classes.titleContainer}>
            <Typography variant="h5" className={classes.title}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" className={classes.subtitle}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        {actions && <Box className={classes.actions}>{actions}</Box>}
      </Box>
      <Box className={classes.content}>{children}</Box>
    </Box>
  );
};
