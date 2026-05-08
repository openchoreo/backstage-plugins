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
import clsx from 'clsx';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useSetupCardStyles, useSetupCardCompactStyles } from '../styles';
import { SetupCardProps } from '../types';
import { LoadingSkeleton } from './LoadingSkeleton';
import { WorkloadButton } from '../Workload/WorkloadButton';
import { AutoDeployConfirmationDialog } from './AutoDeployConfirmationDialog';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useAutoDeployUpdate } from '../hooks/useAutoDeployUpdate';
import { useNotification } from '../../../hooks';

const CompactSetupTile = ({
  loading,
  environmentsExist,
  selected,
}: SetupCardProps) => {
  const classes = useSetupCardCompactStyles();
  return (
    <Box
      className={clsx(classes.setupCard, {
        [classes.cardSelected]: selected,
      })}
    >
      <Box className={classes.titleRow}>
        <SettingsOutlinedIcon className={classes.titleIcon} />
        <Typography className={classes.title}>Set up</Typography>
      </Box>
      {loading && !environmentsExist ? (
        <LoadingSkeleton variant="setup" />
      ) : (
        <Typography className={classes.hint}>
          Auto Deploy & component configuration
        </Typography>
      )}
    </Box>
  );
};

const FullSetupCard = ({
  loading,
  environmentsExist,
  isWorkloadEditorSupported,
  onConfigureWorkload,
}: SetupCardProps) => {
  const fullStyles = useSetupCardStyles();
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

  const autoDeploySwitch = (
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
  );

  const autoDeployTooltip = (
    <Tooltip
      title="Automatically deploy the component to the first target environment when component configurations change"
      placement="bottom"
      arrow
    >
      <IconButton size="small" style={{ padding: 4, marginLeft: -8 }}>
        <InfoOutlinedIcon style={{ fontSize: 18 }} color="primary" />
      </IconButton>
    </Tooltip>
  );

  return (
    <>
      <Box
        className={fullStyles.setupCard}
        style={{ height: '100%', minHeight: '300px', width: '100%' }}
      >
        <Box className={fullStyles.cardContent}>
          <Box className={fullStyles.titleRow}>
            <SettingsOutlinedIcon className={fullStyles.titleIcon} />
            <Typography className={fullStyles.title}>Set up</Typography>
          </Box>

          {loading && !environmentsExist ? (
            <LoadingSkeleton variant="setup" />
          ) : (
            <>
              <Typography variant="body2" color="textSecondary">
                Manage deployment configuration and settings
              </Typography>

              <Box marginTop={2}>
                <Box display="flex" alignItems="center" justifyContent="center">
                  {autoDeploySwitch}
                  {autoDeployTooltip}
                </Box>
              </Box>

              {isWorkloadEditorSupported && (
                <WorkloadButton onConfigureWorkload={onConfigureWorkload} />
              )}
            </>
          )}
        </Box>
      </Box>

      <AutoDeployConfirmationDialog
        open={showConfirmDialog}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        isEnabling={pendingAutoDeployValue}
        isUpdating={autoDeployUpdating}
      />
    </>
  );
};

/**
 * Setup card showing workload deployment options and auto deploy toggle.
 *
 * Compact mode renders a passive tile for the deploy minimap canvas — the
 * Auto Deploy switch and Configure & Deploy button live in the right-pane
 * SetupDetailPane when the user clicks the tile, so the canvas stays
 * action-free.
 */
export const SetupCard = (props: SetupCardProps) => {
  if (props.compact) {
    return <CompactSetupTile {...props} />;
  }
  return <FullSetupCard {...props} />;
};
