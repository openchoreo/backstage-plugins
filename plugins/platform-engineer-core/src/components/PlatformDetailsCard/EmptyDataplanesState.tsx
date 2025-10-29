import React from 'react';
import { Box, Typography, Card } from '@material-ui/core';
import StorageIcon from '@material-ui/icons/Storage';
import { useStyles } from './styles';

export const EmptyDataplanesState: React.FC = () => {
  const classes = useStyles();

  return (
    <Card className={classes.dataplaneCard} elevation={0}>
      <Box className={classes.emptyState}>
        <StorageIcon className={classes.emptyStateIcon} />
        <Typography variant="h6" className={classes.emptyStateTitle}>
          No Data Planes Available
        </Typography>
        <Typography variant="body2" color="textSecondary">
          There are no data planes configured for your OpenChoreo platform yet.
        </Typography>
      </Box>
    </Card>
  );
};

