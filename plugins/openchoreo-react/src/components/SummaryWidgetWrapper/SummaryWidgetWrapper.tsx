import { ReactNode } from 'react';
import { Skeleton } from '@openchoreo/backstage-design-system';
import { Box, Typography } from '@material-ui/core';
import { InfoCard, Link } from '@backstage/core-components';
import { RefreshOverlay } from '@openchoreo/backstage-design-system';
import { useStyles } from './styles';
import ErrorIcon from '@material-ui/icons/Error';
import clsx from 'clsx';

interface Metric {
  label: string;
  value: number;
  link?: string; // Optional link to navigate when clicking on the metric
  highlight?: boolean; // Renders as a prominent hero number
  icon?: ReactNode;
}

interface SummaryWidgetWrapperProps {
  icon: ReactNode;
  title: string;
  titleLink?: string; // Optional link for the widget title
  metrics: Metric[];
  loading?: boolean;
  /**
   * A background refresh is in flight while the metrics are already on screen.
   * Shows a subtle corner indicator without blanking the widget. Ignored
   * during the first load (that's what `loading` is for).
   */
  refreshing?: boolean;
  errorMessage?: string;
  variant?: 'default' | 'cards';
}

export const SummaryWidgetWrapper = ({
  icon,
  title,
  titleLink,
  metrics,
  loading = false,
  refreshing = false,
  errorMessage,
  variant = 'default',
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

    // Card grid variant
    if (variant === 'cards') {
      return (
        <Box className={classes.cardGrid}>
          {metrics.map(metric => {
            const card = (
              <Box
                key={metric.label}
                className={clsx(
                  classes.metricCard,
                  metric.link && classes.metricCardClickable,
                )}
              >
                {metric.icon && (
                  <Box className={classes.metricCardIcon}>{metric.icon}</Box>
                )}
                <Typography className={classes.metricCardValue}>
                  {metric.value}
                </Typography>
                <Typography className={classes.metricCardLabel}>
                  {metric.label}
                </Typography>
              </Box>
            );
            return metric.link ? (
              <Link
                key={metric.label}
                to={metric.link}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {card}
              </Link>
            ) : (
              card
            );
          })}
        </Box>
      );
    }

    // Split metrics into highlighted (hero) and regular
    const heroMetrics = metrics.filter(m => m.highlight);
    const regularMetrics = metrics.filter(m => !m.highlight);

    return (
      <>
        {heroMetrics.map(metric => {
          const heroContent = (
            <Box
              key={metric.label}
              className={clsx(
                classes.heroMetric,
                metric.link && classes.heroMetricClickable,
              )}
            >
              <Typography className={classes.heroValue}>
                {metric.value}
              </Typography>
              <Typography className={classes.heroLabel}>
                {metric.label}
              </Typography>
            </Box>
          );

          if (metric.link) {
            return (
              <Link
                key={metric.label}
                to={metric.link}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {heroContent}
              </Link>
            );
          }
          return heroContent;
        })}
        {regularMetrics.map(metric => {
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
        })}
      </>
    );
  };

  return (
    <Box position="relative">
      {/* Only a background refresh (content already shown) — never the first
          load or error state, which own the whole card. */}
      <RefreshOverlay active={refreshing && !loading && !errorMessage} />
      <InfoCard
        className={classes.card}
        title={
          <Box display="flex" alignItems="center" style={{ gap: 12 }}>
            {icon}
            {title}
          </Box>
        }
        deepLink={
          titleLink ? { title: `View ${title}`, link: titleLink } : undefined
        }
      >
        {renderContent()}
      </InfoCard>
    </Box>
  );
};
