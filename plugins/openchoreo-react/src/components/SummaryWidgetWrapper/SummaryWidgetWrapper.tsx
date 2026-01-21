import { ReactNode } from 'react';
import { Box, Typography } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { Link } from '@backstage/core-components';
import { useStyles } from './styles';
import ErrorIcon from '@material-ui/icons/Error';
import clsx from 'clsx';

interface Metric {
  label: string;
  value: number;
  link?: string; // Optional link to navigate when clicking on the metric
}

interface SummaryWidgetWrapperProps {
  icon: ReactNode;
  title: string;
  titleLink?: string; // Optional link for the widget title
  metrics: Metric[];
  loading?: boolean;
  errorMessage?: string;
}

export const SummaryWidgetWrapper = ({
  icon,
  title,
  titleLink,
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
    return metrics.map(metric => {
      const content = (
        <Box
          key={metric.label}
          className={clsx(
            classes.metricRow,
            metric.link && classes.metricRowClickable,
          )}
          style={metric.link ? { cursor: 'pointer' } : undefined}
        >
          <Typography variant="body1">{metric.label}</Typography>
          <Typography variant="h4">{metric.value}</Typography>
        </Box>
      );

      if (metric.link) {
        return (
          <Link
            key={metric.label}
            to={metric.link}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            {content}
          </Link>
        );
      }

      return content;
    });
  };

  const titleContent = (
    <Box className={classes.widgetHeader}>
      {icon}
      <Typography variant="h4">{title}</Typography>
    </Box>
  );

  return (
    <Box className={classes.widget}>
      {titleLink ? (
        <Link
          to={titleLink}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          {titleContent}
        </Link>
      ) : (
        titleContent
      )}
      {renderContent()}
    </Box>
  );
};
