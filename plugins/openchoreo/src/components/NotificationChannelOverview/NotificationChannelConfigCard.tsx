import { Box, Typography } from '@material-ui/core';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Link } from '@backstage/core-components';
import { Card } from '@openchoreo/backstage-design-system';
import { useNotificationChannelOverviewStyles } from './styles';

interface NotificationChannelSpec {
  environment: string;
  isEnvDefault?: boolean;
  type: 'email' | 'webhook';
  emailConfig?: {
    from: string;
    to: string[];
    smtp: { host: string; port: number };
  };
  webhookConfig?: {
    url: string;
    headers?: Record<
      string,
      { value?: string; valueFrom?: { secretKeyRef?: { name: string } } }
    >;
  };
}

export const NotificationChannelConfigCard = () => {
  const classes = useNotificationChannelOverviewStyles();
  const { entity } = useEntity();
  const spec = entity.spec as unknown as NotificationChannelSpec | undefined;
  const namespace = entity.metadata.namespace || 'default';

  if (!spec) {
    return null;
  }

  const environmentLink = spec.environment
    ? `/catalog/${namespace}/environment/${spec.environment}`
    : undefined;

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
                    ([name, header]) => (
                      <li key={name} className={classes.headerItem}>
                        <Typography className={classes.infoValue}>
                          {name}
                        </Typography>
                        <span className={classes.headerSourceBadge}>
                          {header.valueFrom?.secretKeyRef
                            ? `secret: ${header.valueFrom.secretKeyRef.name}`
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
