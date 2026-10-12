import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  EmptyState,
  InfoCard,
  Link,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { Box, Chip, Grid, Typography, makeStyles } from '@material-ui/core';
import useAsyncRetry from 'react-use/esm/useAsyncRetry';
import {
  EnvironmentImageSecurity,
  ImageSecurityStatus,
  Vulnerability,
  imageSecurityApiRef,
} from '../api/ImageSecurityApi';

const useStyles = makeStyles(theme => ({
  ok: { backgroundColor: theme.palette.success.main, color: '#fff' },
  findings: { backgroundColor: theme.palette.error.main, color: '#fff' },
  unverified: { backgroundColor: theme.palette.warning.main, color: '#fff' },
  neutral: {},
  mono: { fontFamily: 'monospace', wordBreak: 'break-all' },
  counts: { display: 'flex', gap: theme.spacing(1), flexWrap: 'wrap' },
}));

const STATUS_LABEL: Record<ImageSecurityStatus, string> = {
  ok: 'No fixable vulnerabilities',
  findings: 'Fixable vulnerabilities',
  unverified: 'Signature not verified',
  'not-scanned': 'Not scanned',
  error: 'Could not be checked',
};

function StatusChip({ status }: { status: ImageSecurityStatus }) {
  const classes = useStyles();
  const className =
    status === 'ok' || status === 'findings' || status === 'unverified'
      ? classes[status]
      : classes.neutral;
  return (
    <Chip size="small" label={STATUS_LABEL[status]} className={className} />
  );
}

const columns: TableColumn<Vulnerability>[] = [
  { title: 'Severity', field: 'severity', width: '10%' },
  {
    title: 'Vulnerability',
    field: 'id',
    render: v => (v.url ? <Link to={v.url}>{v.id}</Link> : <span>{v.id}</span>),
  },
  { title: 'Package', field: 'packageName' },
  { title: 'Installed', field: 'installedVersion' },
  { title: 'Fixed in', field: 'fixedVersion' },
  { title: 'Found in', field: 'target' },
];

function EnvironmentCard({ env }: { env: EnvironmentImageSecurity }) {
  const classes = useStyles();
  const report = env.report;

  return (
    <InfoCard
      title={env.environment}
      action={<StatusChip status={env.status} />}
    >
      {env.image && (
        <Typography variant="body2" className={classes.mono}>
          {env.image}
        </Typography>
      )}
      {env.digest && (
        <Typography
          variant="caption"
          color="textSecondary"
          className={classes.mono}
        >
          {env.digest}
        </Typography>
      )}
      {env.message && (
        <Box mt={1}>
          <Typography variant="body2" color="textSecondary">
            {env.message}
          </Typography>
        </Box>
      )}
      {report && (
        <Box mt={2}>
          <Typography variant="body2" color="textSecondary">
            Scanned{' '}
            {report.scannedAt
              ? new Date(report.scannedAt).toLocaleString()
              : '—'}
            {report.scanner ? ` with ${report.scanner}` : ''}
            {report.verified ? ', signature verified' : ''}
          </Typography>
          {env.status === 'unverified' && (
            <Typography variant="body2" color="error">
              The scan result is shown for information only: its signature did
              not match the platform's signing key.
            </Typography>
          )}
          {report.vulnerabilities.length > 0 && (
            <Box mt={2}>
              <Table<Vulnerability>
                options={{
                  paging: report.vulnerabilities.length > 10,
                  search: true,
                  padding: 'dense',
                }}
                columns={columns}
                data={report.vulnerabilities}
                title={
                  <span className={classes.counts}>
                    {Object.entries(report.counts).map(([severity, count]) => (
                      <Chip
                        key={severity}
                        size="small"
                        label={`${count} ${severity}`}
                      />
                    ))}
                  </span>
                }
              />
            </Box>
          )}
        </Box>
      )}
    </InfoCard>
  );
}

/**
 * Vulnerability status of the image each environment runs, read from the
 * signed scan attached at build time. Only fixable findings are listed:
 * a vulnerability without a released fix leaves nothing to act on.
 */
export function ImageSecurityContent() {
  const { entity } = useEntity();
  const api = useApi(imageSecurityApiRef);
  const { value, loading, error } = useAsyncRetry(
    () => api.getComponentImageSecurity(entity),
    [api, entity],
  );

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;
  if (!value || value.environments.length === 0) {
    return (
      <EmptyState
        missing="data"
        title="Not deployed yet"
        description="Image security is shown once the component is deployed to an environment."
      />
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="body2" color="textSecondary">
          Fixable {value.severities.join(' and ')} vulnerabilities in the image
          each environment runs.
        </Typography>
      </Grid>
      {value.environments.map(env => (
        <Grid item xs={12} key={env.environment}>
          <EnvironmentCard env={env} />
        </Grid>
      ))}
    </Grid>
  );
}
