import { useState } from 'react';
import {
  Box,
  CardContent,
  Typography,
  FormControlLabel,
  Switch,
  Tooltip,
  IconButton,
} from '@material-ui/core';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { Card } from '@openchoreo/backstage-design-system';
import { useSetupCardStyles } from '../styles';
import { SetupCardProps } from '../types';
import { LoadingSkeleton } from './LoadingSkeleton';
import { WorkloadButton } from '../Workload/WorkloadButton';
import { AutoDeployConfirmationDialog } from './AutoDeployConfirmationDialog';

/**
 * Setup card showing workload deployment options and auto deploy toggle
 */
export const SetupCard = ({
  loading,
  environmentsExist,
  isWorkloadEditorSupported,
  onConfigureWorkload,
  autoDeploy,
  onAutoDeployChange,
  autoDeployUpdating,
}: SetupCardProps) => {
  const classes = useSetupCardStyles();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAutoDeployValue, setPendingAutoDeployValue] = useState(false);

  const handleToggleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setPendingAutoDeployValue(newValue);
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    onAutoDeployChange(pendingAutoDeployValue);
    setShowConfirmDialog(false);
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
  };

  return (
    <>
      <Card style={{ height: '100%', minHeight: '300px', width: '100%' }}>
        <Box className={classes.setupCard}>
          <CardContent className={classes.cardContent}>
            <Typography variant="h6" component="h4">
              Set up
            </Typography>

            <Box
              borderBottom={1}
              borderColor="divider"
              marginBottom={2}
              marginTop={1}
            />

            {loading && !environmentsExist ? (
              <LoadingSkeleton variant="setup" />
            ) : (
              <>
                <Typography color="textSecondary">
                  View and manage deployment environments
                </Typography>

                <Box marginTop={2}>
                  <Box display="flex" alignItems="center">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoDeploy ?? false}
                          onChange={handleToggleChange}
                          name="autoDeploy"
                          color="primary"
                          disabled={
                            autoDeployUpdating || autoDeploy === undefined
                          }
                        />
                      }
                      label={
                        <Typography variant="body2">Auto Deploy</Typography>
                      }
                    />
                    <Tooltip
                      title="Automatically deploy the component to the default environment when component configurations change"
                      placement="top"
                      arrow
                    >
                      <IconButton
                        size="small"
                        style={{ padding: 4, marginLeft: -8 }}
                      >
                        <InfoOutlinedIcon
                          style={{ fontSize: 18 }}
                          color="primary"
                        />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {isWorkloadEditorSupported && (
                  <WorkloadButton onConfigureWorkload={onConfigureWorkload} />
                )}
              </>
            )}
          </CardContent>
        </Box>
      </Card>

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
