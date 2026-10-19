import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import EditIcon from '@material-ui/icons/Edit';
import { Link } from '@backstage/core-components';
import type { Entity } from '@backstage/catalog-model';
import YAML from 'yaml';
import { Skeleton, YamlViewer } from '@openchoreo/backstage-design-system';
import type { ReleaseLineOverrides } from '@openchoreo/backstage-plugin-common';
import { componentEntityPath } from './releaseLineUtils';
import { useReleaseLineDefinitionStyles } from './styles';

export interface InheritedPropertiesPanelProps {
  componentName: string;
  componentEntity?: Entity;
  inherited?: ReleaseLineOverrides;
  loading: boolean;
  error?: Error | null;
}

/**
 * The component properties a release line inherits, read-only. They are
 * edited on the component's Definition page.
 */
export function InheritedPropertiesPanel({
  componentName,
  componentEntity,
  inherited,
  loading,
  error,
}: InheritedPropertiesPanelProps) {
  const classes = useReleaseLineDefinitionStyles();

  let body;
  if (loading) {
    body = <Skeleton variant="rect" height={420} />;
  } else if (error || !inherited) {
    body = (
      <Typography variant="body2" color="error">
        Failed to load the component's properties
        {error ? `: ${error.message}` : ''}
      </Typography>
    );
  } else {
    body = (
      <Box className={classes.readOnlyContainer}>
        <YamlViewer
          value={
            Object.keys(inherited).length > 0
              ? YAML.stringify(inherited, { indent: 2, lineWidth: 0 })
              : '# The component sets no overridable properties\n'
          }
          maxHeight="none"
        />
      </Box>
    );
  }

  return (
    <Box className={classes.panel}>
      <Box className={classes.panelHeader}>
        <Box>
          <Typography className={classes.panelTitle}>
            Inherited from {componentName} (read-only)
          </Typography>
          <Typography variant="caption" className={classes.panelCaption}>
            Edit these on the component's Definition page.
          </Typography>
        </Box>
        {componentEntity && (
          <Link
            to={componentEntityPath(componentEntity, 'definition')}
            underline="none"
          >
            <Button size="small" variant="outlined" startIcon={<EditIcon />}>
              Edit on component
            </Button>
          </Link>
        )}
      </Box>
      {body}
    </Box>
  );
}
