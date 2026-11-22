import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Switch,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { useEntity } from '@backstage/plugin-catalog-react';
import { AutoDeployConfirmationDialog } from './AutoDeployConfirmationDialog';
import { useAutoDeployUpdate } from '../hooks/useAutoDeployUpdate';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { isForbiddenError, getErrorMessage } from '../../../utils/errorUtils';

export interface RollbackAutoDeployToggleProps {
  /** Called after the auto deploy setting was saved, with its new value. */
  onChanged: (autoDeploy: boolean) => void;
}

/**
 * The Set up pane's Auto Deploy switch, shown in the rollback dialog when
 * auto deploy blocks the rollback, so it can be turned off without leaving
 * the dialog. Only the first environment of the deployment pipeline is ever
 * blocked this way, so this only appears there.
 *
 * It behaves as the Set up pane's switch does: the change is confirmed in
 * the same dialog, applied optimistically, and snapped back if saving fails.
 */
export const RollbackAutoDeployToggle = ({
  onChanged,
}: RollbackAutoDeployToggleProps) => {
  const { entity } = useEntity();
  const {
    autoDeploy,
    autoDeployLoading,
    setAutoDeployOptimistic,
    refetchAutoDeploy,
  } = useEnvironmentsContext();
  const { updateAutoDeploy, isUpdating } = useAutoDeployUpdate(entity);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingValue, setPendingValue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const checked = useRef(false);

  // The switch is shown because the server refused the rollback with auto
  // deploy on. The cached setting may predate a change made elsewhere, so
  // read it again rather than show a switch that contradicts the refusal.
  // The switch stays disabled until the read settles, so the read cannot
  // land after a change made here and overwrite it.
  useEffect(() => {
    let live = true;
    Promise.resolve(refetchAutoDeploy()).finally(() => {
      if (live) setRefreshing(false);
    });
    return () => {
      live = false;
    };
    // Once per appearance; refetchAutoDeploy's identity is not a reason to
    // read the setting again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the read settles, and only then: when it finds auto deploy already
  // off (turned off elsewhere after the refusal), retry the rollback preview
  // as a change made here would. Later changes made here report themselves.
  useEffect(() => {
    if (refreshing || checked.current) return;
    checked.current = true;
    if (autoDeploy === false) onChanged(false);
  }, [refreshing, autoDeploy, onChanged]);

  const handleConfirm = useCallback(async () => {
    const next = pendingValue;
    const previous = autoDeploy;
    setShowConfirm(false);
    setError(null);
    setAutoDeployOptimistic(next);
    try {
      await updateAutoDeploy(next);
      onChanged(next);
    } catch (err) {
      setAutoDeployOptimistic(previous);
      setError(
        isForbiddenError(err)
          ? 'You do not have permission to change auto deploy.'
          : `Failed to update auto deploy setting: ${getErrorMessage(err)}`,
      );
    }
  }, [
    pendingValue,
    autoDeploy,
    setAutoDeployOptimistic,
    updateAutoDeploy,
    onChanged,
  ]);

  return (
    <Box mt={1} data-testid="rollback-auto-deploy">
      <Box display="flex" alignItems="center">
        <FormControlLabel
          control={
            <Switch
              checked={autoDeploy ?? false}
              onChange={event => {
                setPendingValue(event.target.checked);
                setShowConfirm(true);
              }}
              name="autoDeploy"
              color="primary"
              disabled={autoDeployLoading || refreshing || isUpdating}
            />
          }
          label={<Typography variant="body2">Auto Deploy</Typography>}
        />
        <Tooltip
          title="Enabling auto deploy will automatically deploy the component to the lowest environment when component configurations change."
          placement="bottom"
          arrow
        >
          <IconButton size="small" style={{ padding: 4, marginLeft: -8 }}>
            <InfoOutlinedIcon style={{ fontSize: 18 }} color="primary" />
          </IconButton>
        </Tooltip>
        {isUpdating && (
          <Box
            display="flex"
            alignItems="center"
            gridGap={4}
            ml={1}
            aria-live="polite"
          >
            <CircularProgress size={12} />
            <Typography variant="caption" color="textSecondary">
              Saving…
            </Typography>
          </Box>
        )}
      </Box>
      {error && (
        <Box mt={1}>
          <Alert severity="error" data-testid="rollback-auto-deploy-error">
            {error}
          </Alert>
        </Box>
      )}
      <AutoDeployConfirmationDialog
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        isEnabling={pendingValue}
        isUpdating={isUpdating}
      />
    </Box>
  );
};
