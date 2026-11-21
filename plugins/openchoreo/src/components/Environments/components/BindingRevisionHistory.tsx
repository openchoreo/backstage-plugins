import {
  Box,
  Button,
  CircularProgress,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Skeleton } from '@openchoreo/backstage-design-system';
import { isActive, revisionNumber } from '../utils/revisionUtils';
import { getErrorMessage } from '../../../utils/errorUtils';
import { RevisionSelect } from './RevisionSelect';
import {
  type UseBindingRevisionHistoryOptions,
  useBindingRevisionHistory,
} from './useBindingRevisionHistory';

// Laid out like the Deploy panel (DeployReleasePanel): title, one-line
// caption, the picker, and the action right-aligned underneath.
const useStyles = makeStyles(theme => ({
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
  },
}));

export interface BindingRevisionHistoryProps
  extends UseBindingRevisionHistoryOptions {
  /** Section class of the panel the history sits in. */
  className?: string;
}

/**
 * The revision history of an environment's binding, as a section of its own
 * (the Resource deploy view). Only the active revision shows, in a picker
 * built like the Deploy panel's release picker; the dropdown lists the other
 * revisions. Picking one enables rolling back to it after a dry-run
 * confirmation, and the Revision Browser compares any two revisions and
 * deletes inactive ones.
 */
export const BindingRevisionHistory = ({
  className,
  ...options
}: BindingRevisionHistoryProps) => {
  const classes = useStyles();
  const {
    revisions,
    loading,
    error,
    isRefetching,
    selectedName,
    setSelectedName,
    selected,
    rollbackBlockedReason,
    openBrowser,
    openConfirm,
    dialogs,
  } = useBindingRevisionHistory(options);
  const blocked = rollbackBlockedReason(selected);

  return (
    <Box
      className={`${className ?? ''} ${classes.panel}`}
      data-testid="revision-history"
    >
      <Box className={classes.titleRow}>
        <Typography variant="subtitle2">Revisions</Typography>
        {isRefetching && (
          <CircularProgress size={12} aria-label="Refreshing revisions" />
        )}
      </Box>
      <Typography variant="caption" color="textSecondary">
        Pick a revision to roll {options.environmentName} back to.
      </Typography>

      {loading && <Skeleton variant="rect" height={40} />}

      {!loading && error && (
        <Typography variant="body2" color="error">
          Could not load revisions: {getErrorMessage(error)}
        </Typography>
      )}

      {!loading && !error && revisions.length === 0 && (
        <Typography
          variant="body2"
          color="textSecondary"
          style={{ fontStyle: 'italic' }}
        >
          No revisions recorded yet.
        </Typography>
      )}

      {!loading && !error && revisions.length > 0 && (
        <>
          <RevisionSelect
            revisions={revisions}
            selectedRevisionName={selectedName}
            onSelectedRevisionChange={setSelectedName}
            releaseNames={options.releaseNames}
            onOpenRevisionBrowser={() => openBrowser()}
          />

          <Box className={classes.actionsRow}>
            <Tooltip title={blocked ?? ''}>
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  disabled={!!blocked}
                  onClick={() => selected && openConfirm(selected)}
                >
                  {selected && !isActive(selected)
                    ? `Roll back to r${revisionNumber(selected)}`
                    : 'Roll back'}
                </Button>
              </span>
            </Tooltip>
          </Box>
        </>
      )}

      {dialogs}
    </Box>
  );
};
