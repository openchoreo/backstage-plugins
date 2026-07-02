import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import CloseIcon from '@material-ui/icons/Close';
import { useProjectUpdatePermission } from '@openchoreo/backstage-plugin-react';
import { useProjectEnvironmentDetailPanelStyles } from './styles';

export interface ProjectSetupDetailPaneProps {
  onConfigureDeploy: () => void;
  onClose: () => void;
}

/**
 * Right-pane body shown when the Setup tile on the canvas is selected.
 * Exposes the Configure & Deploy entry point into the project
 * configuration wizard. Gated on the project-update permission.
 */
export const ProjectSetupDetailPane = ({
  onConfigureDeploy,
  onClose,
}: ProjectSetupDetailPaneProps) => {
  const classes = useProjectEnvironmentDetailPanelStyles();
  const { canUpdate, loading, updateDeniedTooltip } =
    useProjectUpdatePermission();
  const disabled = loading || !canUpdate;

  return (
    <Box className={classes.panel}>
      <Box className={classes.setupHeader}>
        <Box className={classes.headerTopRow}>
          <Box className={classes.headerNameRow}>
            <SettingsOutlinedIcon
              className={classes.headerKindIcon}
              fontSize="small"
              aria-hidden
            />
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

      <Box className={classes.setupBody}>
        <Typography variant="body2" color="textSecondary">
          Manage project configuration and deploy a new version.
        </Typography>

        <Box mt="auto" pt={2} display="flex" justifyContent="flex-end">
          <Tooltip
            title={!canUpdate && !loading ? updateDeniedTooltip : ''}
            disableHoverListener={canUpdate || loading}
          >
            <span>
              <Button
                variant="contained"
                color="primary"
                onClick={onConfigureDeploy}
                disabled={disabled}
              >
                Configure &amp; Deploy
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
};
