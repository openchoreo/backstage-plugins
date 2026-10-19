import { useMemo, useState } from 'react';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import RefreshIcon from '@material-ui/icons/Refresh';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Skeleton } from '@openchoreo/backstage-design-system';
import { useDeleteEntityDialog } from '../DeleteEntity';
import { useProjectContentsCardStyles } from '../Projects/ProjectContentsCard/styles';
import { CreateReleaseLineButton } from './CreateReleaseLineButton';
import { CreateReleaseLineDialog } from './CreateReleaseLineDialog';
import { ReleaseLineSearchField } from './ReleaseLineSearchField';
import { ReleaseLinesTable } from './ReleaseLinesTable';
import { useReleaseLines } from './useReleaseLines';

/**
 * The release lines of a component with release lines enabled, in the same
 * card and table as the project's contents, with a button that creates one.
 * Shown on the component's Overview.
 */
export function ReleaseLinesCard() {
  const classes = useProjectContentsCardStyles();
  const { entity } = useEntity();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const {
    releaseLines,
    loading,
    isRefetching,
    error,
    refetch,
    createReleaseLine,
    creating,
  } = useReleaseLines(entity);

  const { requestDelete, DeleteDialog } = useDeleteEntityDialog({
    onDeleted: () => refetch(),
  });
  const openDialog = () => setDialogOpen(true);

  const filteredReleaseLines = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? releaseLines.filter(line => line.name.toLowerCase().includes(term))
      : releaseLines;
  }, [releaseLines, search]);

  let body;
  if (loading) {
    body = (
      <Box className={classes.skeletonBody}>
        <Skeleton variant="rect" width="100%" height={160} />
      </Box>
    );
  } else if (error) {
    body = (
      <Box className={classes.emptyState}>
        <Typography variant="body2" color="error">
          Failed to load release lines: {error.message}
        </Typography>
      </Box>
    );
  } else if (releaseLines.length === 0) {
    body = (
      <Box className={classes.emptyState}>
        <Box className={classes.emptyText}>
          <Typography variant="h5" className={classes.emptyTitle}>
            No release lines yet
          </Typography>
          <Typography variant="body2" className={classes.emptySubtitle}>
            This component deploys only through release lines. Create one to
            build and deploy it.
          </Typography>
        </Box>
        <CreateReleaseLineButton onClick={openDialog} />
      </Box>
    );
  } else {
    body = (
      <ReleaseLinesTable
        // A new search term returns to the first page.
        key={search}
        component={entity}
        releaseLines={filteredReleaseLines}
        onDelete={requestDelete}
      />
    );
  }

  return (
    <Box className={classes.cardWrapper} position="relative">
      <Box className={classes.header}>
        <Box className={classes.titleGroup}>
          <Typography variant="h5">Release Lines</Typography>
          {!loading && !error && (
            <span className={classes.countBadge}>{releaseLines.length}</span>
          )}
          <Tooltip title={isRefetching ? 'Refreshing…' : 'Refresh'}>
            <span>
              <IconButton
                className={classes.refreshButton}
                size="small"
                aria-label="Refresh release lines"
                onClick={() => refetch()}
                disabled={loading || isRefetching}
              >
                <RefreshIcon
                  className={`${classes.refreshIcon} ${
                    isRefetching ? classes.spinning : ''
                  }`}
                />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        {releaseLines.length > 0 && (
          <Box className={classes.headerActions}>
            <ReleaseLineSearchField value={search} onChange={setSearch} />
            <CreateReleaseLineButton onClick={openDialog} />
          </Box>
        )}
      </Box>
      {body}
      <DeleteDialog />
      <CreateReleaseLineDialog
        open={dialogOpen}
        componentName={entity.metadata.title ?? entity.metadata.name}
        creating={creating}
        onClose={() => setDialogOpen(false)}
        onCreate={async (name, description) => {
          await createReleaseLine(name, undefined, description);
        }}
      />
    </Box>
  );
}
