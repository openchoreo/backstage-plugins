import { ReactNode } from 'react';
import { Box, Chip, Typography, makeStyles } from '@material-ui/core';

// Named 'BackstageHeader' so the theme's BackstageHeader overrides
// (backgroundImage, boxShadow, minHeight, ...) merge into these class keys.
/** @public */
export const useGradientPageHeaderStyles = makeStyles(
  theme => ({
    header: {
      gridArea: 'pageHeader',
      padding: theme.spacing(2, 3),
      width: '100%',
      color: theme.page.fontColor,
      backgroundImage: theme.page.backgroundImage,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
      boxShadow: theme.shadows[4],
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(2),
      },
    },
    topRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      minHeight: 40,
      [theme.breakpoints.down('sm')]: {
        flexWrap: 'wrap',
        minHeight: 'auto',
        rowGap: theme.spacing(0.75),
      },
    },
    title: {
      color: theme.page.fontColor,
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.h5.fontWeight as number,
      wordBreak: 'break-word',
      display: 'block',
      minWidth: 0,
    },
    chip: {
      color: theme.page.fontColor,
      borderColor: `${theme.page.fontColor}80`,
      fontSize: '0.7rem',
      fontWeight: 600,
      height: 24,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
  }),
  { name: 'BackstageHeader' },
);

/** @public */
export interface GradientPageHeaderProps {
  /** Content of the flex title row (title, chips, favorite, actions). */
  titleRow: ReactNode;
  /** Content rendered below the title row (e.g. a breadcrumb). */
  children?: ReactNode;
}

/**
 * The gradient page-header bar shared by the catalog entity pages
 * (`CompactEntityHeader`) and other top-level pages, so their purple header
 * chrome stays pixel-consistent.
 *
 * @public
 */
export function GradientPageHeader({
  titleRow,
  children,
}: GradientPageHeaderProps) {
  const classes = useGradientPageHeaderStyles();
  return (
    <header className={classes.header}>
      <Box className={classes.topRow}>{titleRow}</Box>
      {children}
    </header>
  );
}

/** @public */
export function GradientPageHeaderTitle({ children }: { children: ReactNode }) {
  const classes = useGradientPageHeaderStyles();
  return (
    <Typography variant="h5" className={classes.title}>
      {children}
    </Typography>
  );
}

/** @public */
export function GradientPageHeaderKindChip({ label }: { label: string }) {
  const classes = useGradientPageHeaderStyles();
  return (
    <Chip
      label={label}
      variant="outlined"
      size="small"
      className={classes.chip}
    />
  );
}
