import { useEffect, useState, useCallback } from 'react';
import type { FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Box,
  IconButton,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { fetchEnvironmentRelease } from '../../api/environments';
import { ReleaseDataRenderer } from './ReleaseDataRenderer';

const useStyles = makeStyles(theme => ({
  dialogTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: theme.spacing(1),
  },
  closeButton: {
    marginLeft: theme.spacing(2),
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  },
  errorContainer: {
    padding: theme.spacing(3),
    backgroundColor: theme.palette.error.light,
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.error.dark,
  },
  errorTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  dialogContent: {
    padding: theme.spacing(3),
  },
}));

interface ReleaseDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  environmentName: string;
  environmentDisplayName?: string;
  entity: Entity;
}

export const ReleaseDetailsDialog: FC<ReleaseDetailsDialogProps> = ({
  open,
  onClose,
  environmentName,
  environmentDisplayName,
  entity,
}) => {
  const classes = useStyles();
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [releaseData, setReleaseData] = useState<any>(null);

  const loadReleaseData = useCallback(async () => {
    if (!open || !environmentName) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchEnvironmentRelease(
        entity,
        discovery,
        identity,
        environmentName,
      );
      setReleaseData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load release details');
    } finally {
      setLoading(false);
    }
  }, [open, environmentName, entity, discovery, identity]);

  useEffect(() => {
    if (open) {
      loadReleaseData();
    } else {
      setReleaseData(null);
      setError(null);
    }
  }, [open, loadReleaseData]);

  const handleClose = () => {
    onClose();
  };

  const handleRetry = () => {
    loadReleaseData();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      aria-labelledby="release-details-dialog-title"
    >
      <DialogTitle id="release-details-dialog-title">
        <Box className={classes.dialogTitle}>
          <Typography variant="h5">
            Release Details - {environmentDisplayName || environmentName}
          </Typography>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            className={classes.closeButton}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers className={classes.dialogContent}>
        {loading && (
          <Box className={classes.loadingContainer}>
            <CircularProgress />
            <Typography variant="body2" color="textSecondary">
              Loading release details...
            </Typography>
          </Box>
        )}

        {error && !loading && (
          <Box className={classes.errorContainer}>
            <Typography className={classes.errorTitle}>
              Error Loading Release
            </Typography>
            <Typography variant="body2">{error}</Typography>
          </Box>
        )}

        {!loading && !error && releaseData && (
          <ReleaseDataRenderer releaseData={releaseData} />
        )}

        {!loading && !error && !releaseData && (
          <Box className={classes.loadingContainer}>
            <Typography variant="body2" color="textSecondary">
              No release data available for this environment
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {error && (
          <Button onClick={handleRetry} color="primary">
            Retry
          </Button>
        )}
        <Button onClick={handleClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
