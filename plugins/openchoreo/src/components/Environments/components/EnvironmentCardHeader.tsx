import { Box, Typography, IconButton, Badge } from '@material-ui/core';
import SettingsIcon from '@material-ui/icons/Settings';
import Refresh from '@material-ui/icons/Refresh';
import { EnvironmentCardHeaderProps } from '../types';

/**
 * Header section of an environment card with name and action icons
 */
export const EnvironmentCardHeader = ({
  environmentName,
  hasReleaseName,
  hasOverrides,
  isRefreshing,
  onOpenOverrides,
  onRefresh,
}: EnvironmentCardHeaderProps) => {
  return (
    <>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" component="h4">
          {environmentName}
        </Typography>
        <Box display="flex" alignItems="center">
          {hasReleaseName && (
            <IconButton
              onClick={onOpenOverrides}
              size="small"
              title="Configure environment overrides"
              style={{ marginLeft: 8 }}
            >
              <Badge color="primary" variant="dot" invisible={!hasOverrides}>
                <SettingsIcon fontSize="inherit" style={{ fontSize: '18px' }} />
              </Badge>
            </IconButton>
          )}
          <IconButton
            onClick={onRefresh}
            size="small"
            disabled={isRefreshing}
            title={isRefreshing ? 'Refreshing...' : 'Refresh'}
          >
            <Refresh
              fontSize="inherit"
              style={{
                fontSize: '18px',
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
          </IconButton>
        </Box>
      </Box>
      <Box
        borderBottom={1}
        borderColor="divider"
        marginBottom={2}
        marginTop={1}
      />
    </>
  );
};
