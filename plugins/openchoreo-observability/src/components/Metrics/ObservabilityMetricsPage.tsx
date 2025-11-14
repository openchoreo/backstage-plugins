import { Grid, Card, CardContent, CardHeader, Divider } from '@material-ui/core';
import {
  Content,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import { observabilityApiRef } from '../../api/ObservabilityApi';
import { MetricsFilters } from './MetricsFilters';
import { MetricGraphByComponent } from './MetricGraphByComponent';
import { MetricsActions } from './MetricsActions';

export const ObservabilityMetricsPage = () => {
  const observabilityApi = useApi(observabilityApiRef);

  const { value, loading, error } = useAsync(async () => {
    return await observabilityApi.getMetrics();
  }, []);

  return (
      <Content>
        {loading && <Progress />}
        {error && <ResponseErrorPanel error={error} />}
        {value && (
          <>
            <MetricsFilters/>
            <MetricsActions/>
            <Grid container spacing={4} style={{ marginTop: 16}}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="CPU Usage"/>
                  <Divider />
                  <CardContent>
                    <MetricGraphByComponent />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Memory Usage" />
                  <Divider />
                  <CardContent>
                    <MetricGraphByComponent />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
      </Content>
  );
};
