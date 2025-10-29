import React from 'react';
import { Box, Typography } from '@material-ui/core';
import StorageIcon from '@material-ui/icons/Storage';
import CloudIcon from '@material-ui/icons/Cloud';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { DataPlaneWithEnvironments } from '../../types';
import { useStyles } from './styles';
import { EmptyDataplanesState } from './EmptyDataplanesState';
import { EnvironmentsGrid } from './EnvironmentsGrid';

interface PlatformDetailsCardProps {
  dataplanesWithEnvironments: DataPlaneWithEnvironments[];
  expandedDataplanes: Set<string>;
  onToggleDataplaneExpansion: (dataplaneName: string) => void;
}

export const PlatformDetailsCard: React.FC<PlatformDetailsCardProps> = ({
  dataplanesWithEnvironments,
  expandedDataplanes,
  onToggleDataplaneExpansion,
}) => {
  const classes = useStyles();

  return (
    <Box className={classes.dataplaneDetailsSection}>
      <Typography className={classes.dataplaneDetailTitle}>
        <AccountTreeIcon />
        Platform Details
      </Typography>

      {dataplanesWithEnvironments.length === 0 ? (
        <EmptyDataplanesState />
      ) : (
        dataplanesWithEnvironments.map(dataplane => {
          const isExpanded = expandedDataplanes.has(dataplane.name);

          return (
            <Box key={dataplane.name} className={classes.dataplaneCard}>
              {/* Dataplane Header */}
              <Box
                className={classes.dataplaneHeader}
                onClick={() => onToggleDataplaneExpansion(dataplane.name)}
              >
                <Box className={classes.dataplaneTitle}>
                  <StorageIcon className={classes.dataplaneIcon} />
                  <Box>
                    <Typography variant="h6">
                      {dataplane.displayName || dataplane.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {dataplane.environments.length} environments •{' '}
                      {dataplane.organization}
                    </Typography>
                  </Box>
                </Box>
                <Box display="flex" alignItems="center" gridGap={8}>
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Box>
              </Box>

              {/* Expandable Environments Section */}
              {isExpanded && (
                <Box className={classes.environmentsSection}>
                  {dataplane.description && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      className={classes.dataplaneDescription}
                    >
                      {dataplane.description}
                    </Typography>
                  )}

                  <Typography className={classes.sectionTitle}>
                    <CloudIcon className={classes.sectionTitleIcon} />
                    Environments ({dataplane.environments.length})
                  </Typography>

                  {dataplane.environments.length === 0 ? (
                    <Box className={classes.emptyState}>
                      <CloudIcon className={classes.emptyEnvironmentsIcon} />
                      <Typography variant="body2">
                        No environments found for this dataplane
                      </Typography>
                    </Box>
                  ) : (
                    <EnvironmentsGrid environments={dataplane.environments} />
                  )}
                </Box>
              )}
            </Box>
          );
        })
      )}
    </Box>
  );
};
