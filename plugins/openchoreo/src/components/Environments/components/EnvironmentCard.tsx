import { Box, CardContent, Typography } from '@material-ui/core';
import LockIcon from '@material-ui/icons/LockOutlined';
import { Card } from '@openchoreo/backstage-design-system';
import { useEnvironmentCardStyles } from '../styles';
import { EnvironmentCardProps } from '../types';
import { EnvironmentCardHeader } from './EnvironmentCardHeader';
import { EnvironmentCardContent } from './EnvironmentCardContent';
import { EnvironmentActions } from './EnvironmentActions';
import { LoadingSkeleton } from './LoadingSkeleton';

const LimitedAccessMessage = () => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    flex={1}
    py={4}
  >
    <LockIcon style={{ fontSize: 36, color: '#999', marginBottom: 8 }} />
    <Typography variant="body2" color="textSecondary" align="center">
      Deployment details are not available.
    </Typography>
    <Typography variant="caption" color="textSecondary" align="center">
      You do not have permission to view release bindings.
    </Typography>
  </Box>
);

/**
 * Individual environment card displaying deployment status and actions
 */
export const EnvironmentCard = ({
  environmentName,
  bindingName,
  hasComponentTypeOverrides,
  canViewBindings,
  bindingsPermissionLoading,
  deployment,
  endpoints,
  promotionTargets,
  isRefreshing,
  isAlreadyPromoted,
  actionTrackers,
  onRefresh,
  onOpenOverrides,
  onOpenReleaseDetails,
  onPromote,
  onSuspend,
  activeIncidentCount,
}: EnvironmentCardProps) => {
  const classes = useEnvironmentCardStyles();

  const renderCardBody = () => {
    if (isRefreshing) {
      return <LoadingSkeleton variant="card" />;
    }
    if (canViewBindings === false && !bindingsPermissionLoading) {
      return <LimitedAccessMessage />;
    }
    return (
      <>
        <EnvironmentCardContent
          status={deployment.status}
          lastDeployed={deployment.lastDeployed}
          image={deployment.image}
          releaseName={deployment.releaseName}
          endpoints={endpoints}
          onOpenReleaseDetails={onOpenReleaseDetails}
          activeIncidentCount={activeIncidentCount}
          environmentName={environmentName}
        />

        <EnvironmentActions
          environmentName={environmentName}
          bindingName={bindingName}
          deploymentStatus={deployment.status}
          promotionTargets={promotionTargets}
          isAlreadyPromoted={isAlreadyPromoted}
          promotionTracker={actionTrackers.promotionTracker}
          suspendTracker={actionTrackers.suspendTracker}
          onPromote={onPromote}
          onSuspend={onSuspend}
        />
      </>
    );
  };

  return (
    <Card style={{ height: '100%', minHeight: '300px', width: '100%' }}>
      <CardContent className={classes.cardContent}>
        <EnvironmentCardHeader
          environmentName={environmentName}
          hasReleaseName={!!deployment.releaseName}
          hasOverrides={!!hasComponentTypeOverrides}
          isRefreshing={isRefreshing}
          onOpenOverrides={onOpenOverrides}
          onRefresh={onRefresh}
        />
        {renderCardBody()}
      </CardContent>
    </Card>
  );
};
