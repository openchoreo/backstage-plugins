import { Box, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Link } from '@backstage/core-components';
import { Card } from '@openchoreo/backstage-design-system';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { useNotificationChannelOverviewStyles } from './styles';

interface SecretKeyRef {
  name: string;
  key?: string;
}

interface NotificationChannelSpec {
  environment: string;
  isEnvDefault?: boolean;
  type: 'email' | 'webhook';
  emailConfig?: {
    from: string;
    to: string[];
    smtp: {
      host: string;
      port: number;
      auth?: {
        username?: { secretKeyRef?: SecretKeyRef };
        password?: { secretKeyRef?: SecretKeyRef };
      };
    };
    template?: {
      contentType?: 'text/plain' | 'text/html';
    };
  };
  webhookConfig?: {
    url: string;
    headers?: Record<
      string,
      { value?: string; valueFrom?: { secretKeyRef?: SecretKeyRef } }
    >;
  };
}

interface ChannelCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

/** Reason the controller reports when a channel still copies values from Kubernetes Secrets. */
const DEPRECATED_KUBERNETES_SECRET_REASON = 'DeprecatedKubernetesSecret';

function formatSecretKeyRef(ref: SecretKeyRef): string {
  return ref.key ? `${ref.name} / ${ref.key}` : ref.name;
}

export const NotificationChannelConfigCard = () => {
  const classes = useNotificationChannelOverviewStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const spec = entity.spec as unknown as NotificationChannelSpec | undefined;
  const namespace = entity.metadata.namespace || 'default';
  const name = entity.metadata.name;

  // The catalog entity carries only the spec; read the channel's conditions from the live resource.
  const { data: conditions } = useOpenChoreoQuery<ChannelCondition[]>(
    ['notification-channel-conditions', namespace, name],
    async () => {
      const resource = await client.getResourceDefinition(
        'observabilityalertsnotificationchannels',
        namespace,
        name,
      );
      const status = resource.status as
        | { conditions?: ChannelCondition[] }
        | undefined;
      return status?.conditions ?? [];
    },
  );

  if (!spec) {
    return null;
  }

  const ready = conditions?.find(c => c.type === 'Ready');
  const secretsReady = conditions?.find(c => c.type === 'SecretsReady');

  const environmentLink = spec.environment
    ? `/catalog/${namespace}/environment/${spec.environment}`
    : undefined;

  const smtpAuth = spec.emailConfig?.smtp?.auth;
  const smtpUsernameRef = smtpAuth?.username?.secretKeyRef;
  const smtpPasswordRef = smtpAuth?.password?.secretKeyRef;

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Notification Channel Configuration</Typography>
        <Box display="flex" alignItems="center">
          <span className={classes.typeBadge}>{spec.type}</span>
          {spec.isEnvDefault && (
            <span className={classes.defaultBadge}>Environment Default</span>
          )}
        </Box>
      </Box>

      {ready && ready.status !== 'True' && (
        <Box mb={2}>
          <Alert severity="error">
            {ready.reason ? `${ready.reason}: ` : ''}
            {ready.message}
          </Alert>
        </Box>
      )}
      {secretsReady?.reason === DEPRECATED_KUBERNETES_SECRET_REASON && (
        <Box mb={2}>
          <Alert severity="warning">
            This channel reads its secret values from Kubernetes Secrets, which
            is deprecated. Create SecretReferences with the same names that
            target the environment's observability plane.
          </Alert>
        </Box>
      )}

      {ready && (
        <Box className={classes.infoRow}>
          <Typography className={classes.infoLabel}>Status</Typography>
          <Typography className={classes.infoValue}>
            {ready.status === 'True' ? 'Ready' : 'Not Ready'}
            {secretsReady?.reason ? ` (${secretsReady.reason})` : ''}
          </Typography>
        </Box>
      )}

      <Box className={classes.infoRow}>
        <Typography className={classes.infoLabel}>Environment</Typography>
        {environmentLink ? (
          <Link to={environmentLink}>{spec.environment}</Link>
        ) : (
          <Typography className={classes.infoValue}>
            {spec.environment}
          </Typography>
        )}
      </Box>

      {spec.type === 'email' && spec.emailConfig && (
        <>
          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>From</Typography>
            <Typography className={classes.infoValue}>
              {spec.emailConfig.from}
            </Typography>
          </Box>
          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>To</Typography>
            <Typography className={classes.infoValue}>
              {spec.emailConfig.to?.join(', ')}
            </Typography>
          </Box>
          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>SMTP Server</Typography>
            <Typography className={classes.infoValue}>
              {spec.emailConfig.smtp?.host}:{spec.emailConfig.smtp?.port}
            </Typography>
          </Box>
          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>Content Type</Typography>
            <Typography className={classes.infoValue}>
              {spec.emailConfig.template?.contentType ?? 'text/plain'}
            </Typography>
          </Box>
          {smtpUsernameRef && (
            <Box className={classes.infoRow}>
              <Typography className={classes.infoLabel}>
                SMTP Username
              </Typography>
              <span className={classes.headerSourceBadge}>
                {`secret: ${formatSecretKeyRef(smtpUsernameRef)}`}
              </span>
            </Box>
          )}
          {smtpPasswordRef && (
            <Box className={classes.infoRow}>
              <Typography className={classes.infoLabel}>
                SMTP Password
              </Typography>
              <span className={classes.headerSourceBadge}>
                {`secret: ${formatSecretKeyRef(smtpPasswordRef)}`}
              </span>
            </Box>
          )}
        </>
      )}

      {spec.type === 'webhook' && spec.webhookConfig && (
        <>
          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>URL</Typography>
            <Typography className={classes.infoValue}>
              {spec.webhookConfig.url}
            </Typography>
          </Box>
          {spec.webhookConfig.headers &&
            Object.keys(spec.webhookConfig.headers).length > 0 && (
              <Box className={classes.infoRow}>
                <Typography className={classes.infoLabel}>Headers</Typography>
                <ul className={classes.headerList}>
                  {Object.entries(spec.webhookConfig.headers).map(
                    ([headerName, header]) => (
                      <li key={headerName} className={classes.headerItem}>
                        <Typography className={classes.infoValue}>
                          {headerName}
                        </Typography>
                        <span className={classes.headerSourceBadge}>
                          {header.valueFrom?.secretKeyRef
                            ? `secret: ${formatSecretKeyRef(
                                header.valueFrom.secretKeyRef,
                              )}`
                            : 'inline'}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </Box>
            )}
        </>
      )}
    </Card>
  );
};
