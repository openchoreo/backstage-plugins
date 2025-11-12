import { Typography, Grid, Card, CardContent, Chip } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  Content,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import { observabilityApiRef } from '../../api/ObservabilityApi';

const useStyles = makeStyles(theme => ({
  metricCard: {
    height: '100%',
  },
  metricValue: {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginTop: theme.spacing(1),
  },
  metricUnit: {
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1),
  },
  normalStatus: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.common.white,
  },
  warningStatus: {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.common.white,
  },
  errorStatus: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.common.white,
  },
}));

export const ObservabilityMetricsPage = () => {
  const classes = useStyles();
  const observabilityApi = useApi(observabilityApiRef);

  const { value, loading, error } = useAsync(async () => {
    return await observabilityApi.getMetrics();
  }, []);

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'normal':
        return classes.normalStatus;
      case 'warning':
        return classes.warningStatus;
      case 'error':
        return classes.errorStatus;
      default:
        return classes.normalStatus;
    }
  };

  return (
      <Content>
        {loading && <Progress />}
        {error && <ResponseErrorPanel error={error} />}
        {value && (
          <>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Last updated: {new Date(value.timestamp).toLocaleString()}
            </Typography>
            <Grid container spacing={3} style={{ marginTop: 16 }}>
              {value.metrics.map((metric, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card className={classes.metricCard}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {metric.name}
                      </Typography>
                      <Typography className={classes.metricValue}>
                        {metric.value}
                        <span className={classes.metricUnit}>{metric.unit}</span>
                      </Typography>
                      <Chip
                        label={metric.status.toUpperCase()}
                        size="small"
                        className={getStatusClass(metric.status)}
                        style={{ marginTop: 8 }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </Content>
  );
};
