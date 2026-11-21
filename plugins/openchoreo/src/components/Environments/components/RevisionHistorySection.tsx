import { createContext, type ReactNode, useContext, useMemo } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core';
import CodeOutlinedIcon from '@material-ui/icons/CodeOutlined';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import HistoryIcon from '@material-ui/icons/History';
import { Skeleton } from '@openchoreo/backstage-design-system';
import {
  useReleaseBindingDeleteRevisionPermission,
  useReleaseBindingRollbackPermission,
  useReleaseBindingUpdatePermission,
} from '@openchoreo/backstage-plugin-react';
import type {
  BindingRevision,
  ComponentRelease,
} from '@openchoreo/backstage-plugin-common';
import { useEnvironmentDetailPanelStyles } from '../styles';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { isActive, revisionName, revisionNumber } from '../utils/revisionUtils';
import { getErrorMessage } from '../../../utils/errorUtils';
import {
  type BindingRevisionHistory,
  useBindingRevisionHistory,
} from './useBindingRevisionHistory';
import type { Environment } from '../hooks';

/** Annotation on a revision naming the revision active before it. */
const PREVIOUS_REVISION_ANNOTATION = 'openchoreo.dev/previous-revision';

const RevisionHistoryContext = createContext<BindingRevisionHistory | null>(
  null,
);

export interface RevisionHistoryProviderProps {
  environment: Environment;
  /** The component's releases, to tell which revisions can be restored. */
  releases: ComponentRelease[];
  /** False while the releases are loading or failed to load. */
  releasesKnown: boolean;
  children: ReactNode;
}

const BoundRevisionHistoryProvider = ({
  environment,
  releases,
  releasesKnown,
  children,
}: RevisionHistoryProviderProps) => {
  const { refetch: refetchEnvironments } = useEnvironmentsContext();
  const envResourceName = environment.resourceName ?? environment.name;
  const { canRollback, deniedTooltip } =
    useReleaseBindingRollbackPermission(envResourceName);
  const { canDeleteRevision, deniedTooltip: deleteDeniedTooltip } =
    useReleaseBindingDeleteRevisionPermission(envResourceName);
  const { canUpdate, deniedTooltip: updateDeniedTooltip } =
    useReleaseBindingUpdatePermission(envResourceName);

  const releaseNames = useMemo(
    () =>
      releasesKnown
        ? new Set(
            releases.map(r => r.metadata?.name).filter((n): n is string => !!n),
          )
        : null,
    [releases, releasesKnown],
  );

  const history = useBindingRevisionHistory({
    kind: 'component',
    environmentName: environment.name,
    envResourceName,
    bindingName: environment.bindingName!,
    releaseNames,
    canRollback,
    deniedTooltip,
    canDeleteRevision,
    deleteDeniedTooltip,
    canUpdateBinding: canUpdate,
    updateDeniedTooltip,
    onRolledBack: () => refetchEnvironments(),
  });

  return (
    <RevisionHistoryContext.Provider value={history}>
      {children}
      {history.dialogs}
    </RevisionHistoryContext.Provider>
  );
};

/**
 * Provides the revision history of the environment's release binding in the
 * Component deploy view to RevisionInfoRow and RollbackAction, and renders
 * the Revision Browser, rollback and delete dialogs they open. An environment
 * without a binding has no history: children render without it.
 */
export const RevisionHistoryProvider = (props: RevisionHistoryProviderProps) =>
  props.environment.bindingName ? (
    // Keyed by binding so another environment starts from fresh dialogs.
    <BoundRevisionHistoryProvider
      key={props.environment.bindingName}
      {...props}
    />
  ) : (
    <>{props.children}</>
  );

/**
 * The revision to offer first when rolling back: the one active before the
 * current revision (the undo target), else the newest inactive one.
 */
const rollbackCandidate = (
  revisions: BindingRevision[],
  active: BindingRevision | undefined,
): BindingRevision | undefined => {
  const previous = Number(
    active?.metadata.annotations?.[PREVIOUS_REVISION_ANNOTATION],
  );
  return (
    revisions.find(r => !isActive(r) && revisionNumber(r) === previous) ??
    revisions.find(r => !isActive(r))
  );
};

/**
 * The binding's active revision, shown beside the release like the release
 * name: view its manifest (with the Revision Browser one click away), or
 * copy its name.
 */
export const RevisionInfoRow = () => {
  const classes = useEnvironmentDetailPanelStyles();
  const history = useContext(RevisionHistoryContext);
  if (!history) return null;
  const { active, loading, error, isRefetching, openManifest } = history;

  const value = (() => {
    if (loading) {
      return <Skeleton variant="text" width={120} />;
    }
    if (error) {
      return (
        <Tooltip title={getErrorMessage(error)}>
          <Typography variant="caption" color="error">
            Could not load revisions
          </Typography>
        </Tooltip>
      );
    }
    if (!active) {
      return (
        <Typography
          variant="caption"
          color="textSecondary"
          style={{ fontStyle: 'italic' }}
        >
          No revisions recorded yet.
        </Typography>
      );
    }
    const name = revisionName(active);
    return (
      <>
        <Tooltip title={name}>
          <Typography
            variant="caption"
            className={classes.releaseName}
            data-testid="active-revision-name"
          >
            {name}
          </Typography>
        </Tooltip>
        <Tooltip title="View revision">
          <IconButton
            size="small"
            aria-label="View revision"
            onClick={openManifest}
          >
            <CodeOutlinedIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Copy revision name">
          <IconButton
            size="small"
            aria-label="Copy revision name"
            onClick={() => navigator.clipboard?.writeText(name)}
          >
            <FileCopyOutlinedIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </>
    );
  })();

  return (
    <Box className={classes.releaseNameRow} data-testid="revision-info-row">
      <Typography variant="caption" className={classes.releaseNameLabel}>
        Revision
      </Typography>
      {value}
      {isRefetching && (
        <CircularProgress size={10} aria-label="Refreshing revisions" />
      )}
    </Box>
  );
};

/**
 * Opens the Revision Browser to pick a revision to roll back to, starting on
 * the revision deployed now, so the user sees what is running before choosing
 * where to go. The browser's own Roll back button runs the dry-run
 * confirmation; this one is disabled while there is nothing to roll back to or
 * the user may not roll back.
 */
export const RollbackAction = () => {
  const history = useContext(RevisionHistoryContext);
  if (!history) return null;
  const { revisions, active, loading, error, canRollback } = history;
  const candidate = rollbackCandidate(revisions, active);

  // Reasons that apply to every revision disable the button; reasons for one
  // revision (its release was deleted) are shown in the browser instead.
  const disabledReason = (() => {
    if (!canRollback) return history.rollbackDeniedTooltip;
    if (loading) return 'Loading revisions…';
    if (error) return `Could not load revisions: ${getErrorMessage(error)}`;
    if (!candidate) return 'There is no earlier revision to roll back to.';
    return null;
  })();

  return (
    <Tooltip title={disabledReason ?? 'Pick a revision to roll back to'}>
      <span>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<HistoryIcon fontSize="small" />}
          disabled={!!disabledReason}
          onClick={() => history.openBrowser(active?.metadata.name)}
          style={{ textTransform: 'none' }}
        >
          Roll back
        </Button>
      </span>
    </Tooltip>
  );
};
