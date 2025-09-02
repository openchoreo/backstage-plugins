/* eslint-disable no-nested-ternary */
import { useCallback, useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Content, Page } from '@backstage/core-components';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Collapse,
  useTheme,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';


import {
  discoveryApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { fetchEnvironmentInfo } from '../../api/environments';

interface EndpointInfo {
  name: string;
  type: string;
  url: string;
  visibility: 'project' | 'organization' | 'public';
}
import { Workload } from './Workload/Workload';
import { EnvCard } from './EnvCard';
import { useTimerEffect } from '../../hooks/timerEffect';
import { Alert } from '@material-ui/lab';

const useStyles = makeStyles(theme => ({
  notificationBox: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid`,
  },
  successNotification: {
    backgroundColor: theme.palette.success.light,
    borderColor: theme.palette.success.main,
    color: theme.palette.success.dark,
  },
  errorNotification: {
    backgroundColor: theme.palette.error.light,
    borderColor: theme.palette.error.main,
    color: theme.palette.error.dark,
  },
  setupCard: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
  },


}));

interface Environment {
  name: string;
  bindingName?: string;
  deployment: {
    status: 'success' | 'failed' | 'pending' | 'not-deployed' | 'suspended';
    lastDeployed?: string;
    image?: string;
    statusMessage?: string;
  };
  endpoints: EndpointInfo[];
  promotionTargets?: {
    name: string;
    requiresApproval?: boolean;
    isManualApprovalRequired?: boolean;
  }[];
}

export const Environments = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const [environments, setEnvironmentsData] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotingTo, setPromotingTo] = useState<string | null>(null);
  const [updatingBinding, setUpdatingBinding] = useState<string | null>(null);
  const [isWorkloadEditorOpen, setIsWorkloadEditorOpen] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const discovery = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const theme = useTheme();
  const fetchEnvironmentsData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchEnvironmentInfo(entity, discovery, identityApi);
      setEnvironmentsData(data as Environment[]);
    } catch (error) {
      // TODO: Log this error
    } finally {
      setLoading(false);
    }
  }, [entity, discovery, identityApi]);

  useEffect(() => {
    fetchEnvironmentsData();
  }, [fetchEnvironmentsData]);

  const isWorkloadEditorSupported = entity.metadata.tags?.find(
    tag => tag === 'webapplication' || tag === 'service',
  );
  const isPending = environments.some(
    env => env.deployment.status === 'pending',
  );

  useTimerEffect(fetchEnvironmentsData, isWorkloadEditorOpen || !isPending ? 0 : 10000, [isPending, fetchEnvironmentsData]);

  if (loading && !isPending) {
    return (
      <Page themeId="tool">
        <Content>
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="400px"
          >
            <Typography variant="h6">Loading environments...</Typography>
          </Box>
        </Content>
      </Page>
    );
  }

  return (
    <Box height="100%" p={2}>
      <Collapse in={!!notification} mountOnEnter unmountOnExit>
        <Alert severity={notification?.type} title={notification?.type === 'success' ? '✓ ' : '✗ '} style={{ marginBottom: '10px' }}>
          {notification?.message}
        </Alert>
      </Collapse>
      <Box display="flex" flexDirection="row" gridGap={16} py={1} overflow="auto" flexGrow={1} width="100%">
        <Box minWidth={theme.spacing(40)} width={theme.spacing(40)} key="setup">
          <Card>
            {/* Make this card color different from the others */}
            <Box className={classes.setupCard}>
              <CardContent>
                <Typography variant="h6" component="h4">
                  Set up
                </Typography>

                <Box
                  borderBottom={1}
                  borderColor="divider"
                  marginBottom={2}
                  marginTop={1}
                />
                <Typography color="textSecondary">
                  View and manage deployment environments
                </Typography>
                {isWorkloadEditorSupported && !loading && (
                  <Workload
                    isOpen={isWorkloadEditorOpen}
                    onOpenChange={setIsWorkloadEditorOpen}
                    onDeployed={fetchEnvironmentsData}
                    isWorking={isPending}
                  />
                )}
              </CardContent>
            </Box>
          </Card>
        </Box>
        {environments.map(env => (
          <EnvCard
            key={env.name}
            env={env}
            entity={entity}
            discovery={discovery}
            identityApi={identityApi}
            promotingTo={promotingTo}
            setPromotingTo={setPromotingTo}
            updatingBinding={updatingBinding}
            setUpdatingBinding={setUpdatingBinding}
            setEnvironmentsData={setEnvironmentsData}
            setNotification={setNotification}
            fetchEnvironmentsData={fetchEnvironmentsData}
          />
        ))}
      </Box>
    </Box>
    //   </Content>
    // </Page>
  );
};
