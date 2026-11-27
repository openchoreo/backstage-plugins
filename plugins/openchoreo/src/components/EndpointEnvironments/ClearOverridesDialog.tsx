import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

/** The same danger button as a component's Delete Overrides dialog. */
const useStyles = makeStyles(theme => ({
  clearButton: {
    color: theme.palette.error.dark,
    borderColor: theme.palette.error.dark,
    '&:hover': {
      borderColor: theme.palette.error.dark,
      backgroundColor: `${theme.palette.error.dark}0A`,
    },
  },
}));

/**
 * Asks before Clear Overrides drops an environment's own values, listing
 * what goes, as a component's Delete Overrides dialog does.
 */
export const ClearOverridesDialog = ({
  open,
  envLabel,
  configFields,
  trafficBackends,
  clearing,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  envLabel: string;
  /** Endpoint type override fields stored now; 0 when there are none. */
  configFields: number;
  /** Backends with own traffic values stored now; 0 when there are none. */
  trafficBackends: number;
  clearing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const classes = useStyles();
  const items = [
    configFields > 0 &&
      `Endpoint type overrides (${configFields} ${
        configFields === 1 ? 'field' : 'fields'
      })`,
    trafficBackends > 0 &&
      `Traffic overrides (${trafficBackends} ${
        trafficBackends === 1 ? 'backend' : 'backends'
      })`,
  ].filter((i): i is string => Boolean(i));

  return (
    <Dialog
      open={open}
      onClose={() => !clearing && onCancel()}
      maxWidth="sm"
      fullWidth
      aria-labelledby="clear-overrides-dialog-title"
    >
      <DialogTitle disableTypography id="clear-overrides-dialog-title">
        <Typography variant="h4">Clear Overrides?</Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom>
          Clear the following overrides for <strong>{envLabel}</strong>?
        </Typography>
        <Box component="ul" mt={1} mb={1}>
          {items.map(item => (
            <Typography key={item} component="li" variant="body2">
              {item}
            </Typography>
          ))}
        </Box>
        <Typography variant="body2" color="textSecondary">
          {envLabel} will follow the release&apos;s settings and traffic, and
          this triggers a redeployment.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={clearing} variant="contained">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="outlined"
          disabled={clearing}
          className={classes.clearButton}
        >
          {clearing ? 'Clearing...' : 'Confirm Clear'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
