import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  ErrorState,
  ForbiddenState,
  LoadingState,
  NotificationBanner,
  useComponentUpdatePermission,
} from '@openchoreo/backstage-plugin-react';
import { isForbiddenError } from '../../utils/errorUtils';
import { InheritedPropertiesPanel } from './InheritedPropertiesPanel';
import { ReleaseLineYamlPanel } from './ReleaseLineYamlPanel';
import { useReleaseLineDefinition } from './useReleaseLineDefinition';
import { useReleaseLineDefinitionStyles } from './styles';

/**
 * Definition tab of a release line: the properties the line overrides,
 * editable, next to the properties it inherits from its component, read-only.
 */
export function ReleaseLineDefinitionTab() {
  const classes = useReleaseLineDefinitionStyles();
  const { entity } = useEntity();
  const { canUpdateComponent, loading: permissionLoading } =
    useComponentUpdatePermission();
  const {
    releaseLineName,
    componentName,
    componentEntity,
    releaseLine,
    editable,
    inherited,
    loading,
    inheritedLoading,
    error,
    inheritedError,
    refresh,
    save,
    isSaving,
  } = useReleaseLineDefinition(entity);

  if (permissionLoading || loading) {
    return <LoadingState message="Loading release line..." />;
  }

  if (error || !releaseLine || !editable) {
    if (isForbiddenError(error)) {
      return (
        <ForbiddenState
          message="You do not have permission to view this release line."
          onRetry={refresh}
          variant="fullpage"
        />
      );
    }
    return (
      <ErrorState
        title="Failed to load release line"
        message={error?.message ?? 'The release line could not be retrieved.'}
        onRetry={refresh}
      />
    );
  }

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Typography variant="h6">
          Release Line Definition: {releaseLineName}
        </Typography>
      </Box>
      {!canUpdateComponent && (
        <NotificationBanner
          variant="info"
          showIcon
          message="You have read-only access to this release line. Contact your administrator for edit permissions."
        />
      )}
      <Grid container spacing={3} alignItems="stretch">
        <Grid item md={6} xs={12}>
          <ReleaseLineYamlPanel
            releaseLine={releaseLine}
            content={editable}
            readOnly={!canUpdateComponent}
            isSaving={isSaving}
            onSave={save}
          />
        </Grid>
        <Grid item md={6} xs={12}>
          <InheritedPropertiesPanel
            componentName={componentName}
            componentEntity={componentEntity}
            inherited={inherited}
            loading={inheritedLoading}
            error={inheritedError}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
