import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Box, Typography, Button } from '@material-ui/core';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { useEnvironmentRouting } from '../hooks/useEnvironmentRouting';
import { ReleaseDetailsPage } from '../ReleaseDetailsPage';

/**
 * Wrapper component for ReleaseDetailsPage that handles URL-based navigation.
 * Reads envName from URL params.
 */
export const ReleaseDetailsWrapper = () => {
  const { envName } = useParams<{ envName: string }>();
  const { entity } = useEntity();
  const { displayEnvironments } = useEnvironmentsContext();
  const { navigateToList } = useEnvironmentRouting();

  // Find the environment by name
  const environment = useMemo(() => {
    if (!envName) return undefined;

    const decodedName = decodeURIComponent(envName);
    return displayEnvironments.find(
      e => e.name.toLowerCase() === decodedName.toLowerCase(),
    );
  }, [envName, displayEnvironments]);

  const handleBack = () => {
    navigateToList();
  };

  // Error state: environment not found
  if (!environment) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight={300}
        p={4}
      >
        <Typography variant="h6" gutterBottom>
          Environment Not Found
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          The environment "{envName}" could not be found.
        </Typography>
        <Button variant="outlined" onClick={handleBack}>
          Back to Environments
        </Button>
      </Box>
    );
  }

  return (
    <ReleaseDetailsPage
      environment={environment}
      entity={entity}
      onBack={handleBack}
    />
  );
};
