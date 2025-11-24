import { ReactNode } from 'react';
import { Box, Typography } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { useStyles } from './styles';
import ErrorIcon from '@material-ui/icons/Error';

interface SummaryWidgetWrapperProps {
  icon: ReactNode;
  title: string;
  metrics: {
    label: string;
    value: number;
  }[];
  loading?: boolean;
  errorMessage?: string;
}

export const SummaryWidgetWrapper = ({
  icon,
  title,
  metrics,
  loading = false,
  errorMessage,
}: SummaryWidgetWrapperProps) => {
  const classes = useStyles();

  const renderContent = () => {
    if (loading) {
      // Show 3 skeleton loaders when loading
      return (
        <>
          <Skeleton variant="rect" height={20} className={classes.skeleton} />
          <Skeleton variant="rect" height={20} className={classes.skeleton} />
          <Skeleton variant="rect" height={20} className={classes.skeleton} />
        </>
      );
    }

    if (errorMessage) {
      // Show error message if present
      return (
        <Box className={classes.errorContainer}>
          <ErrorIcon fontSize="small" color="error" />
          <Typography variant="body2" color="error">
            {errorMessage}
          </Typography>
        </Box>
      );
    }

    // Show metrics when not loading and no error
    return metrics.map(metric => (
      <Box key={metric.label} className={classes.metricRow}>
        <Typography variant="body1">{metric.label}</Typography>
        <Typography variant="h4">{metric.value}</Typography>
      </Box>
    ));
  };

  return (
    <Box className={classes.widget}>
      <Box className={classes.widgetHeader}>
        {icon}
        <Typography variant="h4">{title}</Typography>
      </Box>
      {renderContent()}
    </Box>
  );
};
