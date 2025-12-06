import { CardContent } from '@material-ui/core';
import { Card } from '@openchoreo/backstage-design-system';
import { useEnvironmentCardStyles } from '../styles';
import { EnvironmentCardProps } from '../types';
import { EnvironmentCardHeader } from './EnvironmentCardHeader';
import { EnvironmentCardContent } from './EnvironmentCardContent';
import { EnvironmentActions } from './EnvironmentActions';
import { LoadingSkeleton } from './LoadingSkeleton';

/**
 * Individual environment card displaying deployment status and actions
 */
export const EnvironmentCard = ({
  environmentName,
  resourceName,
  bindingName,
  hasComponentTypeOverrides,
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
}: EnvironmentCardProps) => {
  const classes = useEnvironmentCardStyles();

  return (
    <Card interactive style={{ minHeight: '300px' }}>
      <CardContent className={classes.cardContent}>
        <EnvironmentCardHeader
          environmentName={environmentName}
          hasReleaseName={!!deployment.releaseName}
          hasOverrides={!!hasComponentTypeOverrides}
          isRefreshing={isRefreshing}
          onOpenOverrides={onOpenOverrides}
          onRefresh={onRefresh}
        />

        {isRefreshing ? (
          <LoadingSkeleton variant="card" />
        ) : (
          <>
            <EnvironmentCardContent
              environmentName={environmentName}
              resourceName={resourceName}
              status={deployment.status}
              lastDeployed={deployment.lastDeployed}
              image={deployment.image}
              releaseName={deployment.releaseName}
              endpoints={endpoints}
              onOpenReleaseDetails={onOpenReleaseDetails}
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
        )}
      </CardContent>
    </Card>
  );
};
