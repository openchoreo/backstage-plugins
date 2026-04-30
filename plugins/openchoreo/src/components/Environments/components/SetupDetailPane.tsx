import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  FormControlLabel,
  Switch,
  Tooltip,
  IconButton,
} from '@material-ui/core';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import CloseIcon from '@material-ui/icons/Close';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useEnvironmentDetailPanelStyles } from '../styles';
import { LoadingSkeleton } from './LoadingSkeleton';
import { WorkloadButton } from '../Workload/WorkloadButton';
import { AutoDeployConfirmationDialog } from './AutoDeployConfirmationDialog';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useAutoDeployUpdate } from '../hooks/useAutoDeployUpdate';
import { useNotification } from '../../../hooks';

export interface SetupDetailPaneProps {
  environmentsExist: boolean;
  isWorkloadEditorSupported: boolean;
  loading: boolean;
  onConfigureWorkload: () => void;
  onClose: () => void;
}

/**
 * Right-pane body shown when the canvas Setup tile is selected. Owns the
 * Auto Deploy fetch + update flow and renders the Configure & Deploy
 * action so the canvas tile itself can stay passive.
 */
export const SetupDetailPane = ({
  environmentsExist,
  isWorkloadEditorSupported,
  loading,
  onConfigureWorkload,
  onClose,
}: SetupDetailPaneProps) => {
  const classes = useEnvironmentDetailPanelStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const notification = useNotification();
  const { updateAutoDeploy, isUpdating: autoDeployUpdating } =
    useAutoDeployUpdate(entity);

  const [autoDeploy, setAutoDeploy] = useState<boolean | undefined>(undefined);
  const [autoDeployLoaded, setAutoDeployLoaded] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAutoDeployValue, setPendingAutoDeployValue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAutoDeployLoaded(false);

    const fetchComponentData = async () => {
      try {
        const componentData = await client.getComponentDetails(entity);
        if (!cancelled && componentData?.autoDeploy !== undefined) {
          setAutoDeploy(componentData.autoDeploy);
        }
      } catch {
        return;
      }
      if (!cancelled) {
        setAutoDeployLoaded(true);
      }
    };

    fetchComponentData();
    return () => {
      cancelled = true;
    };
  }, [entity, client]);

  const handleAutoDeployChange = useCallback(
    async (newAutoDeploy: boolean) => {
      const success = await updateAutoDeploy(newAutoDeploy);
      if (success) {
        setAutoDeploy(newAutoDeploy);
        notification.showSuccess(
          `Auto deploy ${newAutoDeploy ? 'enabled' : 'disabled'} successfully`,
        );
      } else {
        notification.showError('Failed to update auto deploy setting');
      }
    },
    [updateAutoDeploy, notification],
  );

  const handleToggleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setPendingAutoDeployValue(newValue);
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    handleAutoDeployChange(pendingAutoDeployValue);
    setShowConfirmDialog(false);
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
  };

  return (
    <Box className={classes.panel}>
      <Box className={classes.header}>
        <Box className={classes.headerTopRow}>
          <Box className={classes.headerStatusRow}>
            <SettingsOutlinedIcon fontSize="small" />
            <Typography className={classes.envName}>Set up</Typography>
          </Box>
          <Box>
            <IconButton
              size="small"
              onClick={onClose}
              aria-label="Close detail panel"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>

      <Box className={classes.body}>
        {loading && !environmentsExist ? (
          <LoadingSkeleton variant="setup" />
        ) : (
          <>
            <Typography variant="body2" color="textSecondary">
              Manage component configuration and choose how new versions deploy.
            </Typography>

            <Box display="flex" alignItems="center" mt={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoDeploy ?? false}
                    onChange={handleToggleChange}
                    name="autoDeploy"
                    color="primary"
                    disabled={!autoDeployLoaded || autoDeployUpdating}
                  />
                }
                label={<Typography variant="body2">Auto Deploy</Typography>}
              />
              <Tooltip
                title="Automatically deploy the component to the first target environment when component configurations change"
                placement="bottom"
                arrow
              >
                <IconButton size="small" style={{ padding: 4, marginLeft: -8 }}>
                  <InfoOutlinedIcon style={{ fontSize: 18 }} color="primary" />
                </IconButton>
              </Tooltip>
            </Box>

            {isWorkloadEditorSupported && (
              <Box mt="auto" mb={2} display="flex" justifyContent="flex-end">
                <WorkloadButton onConfigureWorkload={onConfigureWorkload} />
              </Box>
            )}
          </>
        )}
      </Box>

      <AutoDeployConfirmationDialog
        open={showConfirmDialog}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        isEnabling={pendingAutoDeployValue}
        isUpdating={autoDeployUpdating}
      />
    </Box>
  );
};
