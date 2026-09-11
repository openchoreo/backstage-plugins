import { useEntity } from '@backstage/plugin-catalog-react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import { YamlEditor } from '@openchoreo/backstage-plugin-react';
import type { ApiEntity } from '@backstage/catalog-model';

// Mirrors ResourceDefinitionTab styling. Read-only OpenAPI YAML from spec.
const useStyles = makeStyles(theme => ({
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    marginBottom: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editorContainer: {
    flex: 1,
    minHeight: 500,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
}));

export function ApiOpenApiDefinitionTab() {
  const classes = useStyles();
  const { entity } = useEntity<ApiEntity>();
  const definition =
    typeof entity.spec?.definition === 'string' ? entity.spec.definition : '';

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Typography variant="h6">
          API Definition: {entity.metadata.name}
        </Typography>
      </Box>
      <Box className={classes.editorContainer}>
        <YamlEditor content={definition} onChange={() => {}} readOnly />
      </Box>
    </Box>
  );
}
