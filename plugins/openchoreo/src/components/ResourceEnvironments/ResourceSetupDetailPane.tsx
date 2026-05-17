import { Box, Button, IconButton, Typography } from '@material-ui/core';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import CloseIcon from '@material-ui/icons/Close';
import { useResourceEnvironmentDetailPanelStyles } from './styles';

export interface ResourceSetupDetailPaneProps {
  onConfigureDeploy: () => void;
  onClose: () => void;
}

/**
 * Right-pane body shown when the Setup tile on the canvas is selected.
 * Exposes the Configure & Deploy entry point into the Resource
 * configuration wizard.
 */
export const ResourceSetupDetailPane = ({
  onConfigureDeploy,
  onClose,
}: ResourceSetupDetailPaneProps) => {
  const classes = useResourceEnvironmentDetailPanelStyles();

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
          Manage resource configuration and deploy a new version.
        </Typography>

        <Box mt="auto" pt={2} display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            color="primary"
            onClick={onConfigureDeploy}
          >
            Configure &amp; Deploy
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
