import { Box, CardContent, Typography } from '@material-ui/core';
import { Card } from '@openchoreo/backstage-design-system';
import { useSetupCardStyles } from '../styles';
import { SetupCardProps } from '../types';
import { LoadingSkeleton } from './LoadingSkeleton';
import { Workload } from '../Workload/Workload';

/**
 * Setup card showing workload deployment options
 */
export const SetupCard = ({
  loading,
  environmentsExist,
  isWorkloadEditorSupported,
  onDeployed,
}: SetupCardProps) => {
  const classes = useSetupCardStyles();

  return (
    <Card interactive style={{ minHeight: '300px' }}>
      <Box className={classes.setupCard}>
        <CardContent className={classes.cardContent}>
          <Typography variant="h6" component="h4">
            Set up
          </Typography>

          <Box
            borderBottom={1}
            borderColor="divider"
            marginBottom={2}
            marginTop={1}
          />

          {loading && !environmentsExist ? (
            <LoadingSkeleton variant="setup" />
          ) : (
            <>
              <Typography color="textSecondary">
                View and manage deployment environments
              </Typography>
              {isWorkloadEditorSupported && (
                <Workload onDeployed={onDeployed} />
              )}
            </>
          )}
        </CardContent>
      </Box>
    </Card>
  );
};
