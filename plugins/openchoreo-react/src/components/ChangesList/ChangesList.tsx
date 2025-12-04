import { type FC } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Change } from '../../utils/changeDetection';
import { ChangeDiff } from '../ChangeDiff';

const useStyles = makeStyles(theme => ({
  container: {
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    maxHeight: 300,
    overflow: 'auto',
  },
  section: {
    marginBottom: theme.spacing(2),
    '&:last-child': {
      marginBottom: 0,
    },
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing(1),
  },
  sectionContent: {
    marginLeft: theme.spacing(2),
  },
  emptyState: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
}));

/**
 * A section of grouped changes
 */
export interface ChangesSection {
  /** Title for this section */
  title: string;
  /** Changes in this section */
  changes: Change[];
}

export interface ChangesListProps {
  /** Array of changes to display (for ungrouped display) */
  changes?: Change[];
  /** Grouped sections of changes (alternative to flat changes) */
  sections?: ChangesSection[];
  /** Message to show when there are no changes */
  emptyMessage?: string;
  /** Custom container className */
  className?: string;
}

/**
 * Component for rendering a list of changes with optional grouping.
 * Can display either a flat list of changes or grouped sections.
 *
 * @example
 * ```tsx
 * // Flat list
 * <ChangesList changes={allChanges} />
 *
 * // Grouped sections
 * <ChangesList
 *   sections={[
 *     { title: 'Component Overrides', changes: componentChanges },
 *     { title: 'Workload Changes', changes: workloadChanges },
 *   ]}
 * />
 * ```
 */
export const ChangesList: FC<ChangesListProps> = ({
  changes,
  sections,
  emptyMessage = 'No changes',
  className,
}) => {
  const classes = useStyles();

  const renderChanges = (changeList: Change[]) => (
    <>
      {changeList.map((change, index) => (
        <ChangeDiff key={`${change.path}-${index}`} change={change} />
      ))}
    </>
  );

  const renderSection = (section: ChangesSection) => {
    if (section.changes.length === 0) return null;

    return (
      <Box key={section.title} className={classes.section}>
        <Typography variant="subtitle2" className={classes.sectionTitle}>
          {section.title} ({section.changes.length}{' '}
          {section.changes.length === 1 ? 'change' : 'changes'})
        </Typography>
        <Box className={classes.sectionContent}>
          {renderChanges(section.changes)}
        </Box>
      </Box>
    );
  };

  // Determine if there are any changes
  const hasChanges = sections
    ? sections.some(s => s.changes.length > 0)
    : changes && changes.length > 0;

  if (!hasChanges) {
    return (
      <Box className={`${classes.container} ${className || ''}`}>
        <Typography className={classes.emptyState}>{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <Box className={`${classes.container} ${className || ''}`}>
      {sections
        ? sections.map(renderSection)
        : changes && renderChanges(changes)}
    </Box>
  );
};
