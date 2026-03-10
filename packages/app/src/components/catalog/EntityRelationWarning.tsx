import { useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import {
  CatalogApi,
  catalogApiRef,
  useEntity,
} from '@backstage/plugin-catalog-react';
import Alert from '@material-ui/lab/Alert';
import useAsync from 'react-use/esm/useAsync';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Collapse from '@material-ui/core/Collapse';
import { ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';

const PLATFORM_KINDS = new Set([
  'buildplane',
  'clusterbuildplane',
  'componenttype',
  'clustercomponenttype',
  'traittype',
  'clustertraittype',
  'workflow',
  'componentworkflow',
  'observabilityplane',
  'clusterobservabilityplane',
  'dataplane',
  'clusterdataplane',
  'deploymentpipeline',
  'environment',
]);

async function getRelationWarnings(entity: Entity, catalogApi: CatalogApi) {
  const entityRefRelations = entity.relations?.map(
    relation => relation.targetRef,
  );
  if (
    !entityRefRelations ||
    entityRefRelations?.length < 1 ||
    entityRefRelations.length > 1000
  ) {
    return [];
  }

  const relatedEntities = await catalogApi.getEntitiesByRefs({
    entityRefs: entityRefRelations,
    fields: ['kind', 'metadata.name', 'metadata.namespace'],
  });

  return entityRefRelations.filter(
    (_, index) => relatedEntities.items[index] === undefined,
  );
}

/**
 * Displays a collapsible warning alert if the entity has relations to other
 * entities that could not be found in the catalog. Platform-level entity
 * kinds are filtered out since users typically can't see them due to permissions.
 */
export function EntityRelationWarning() {
  const { entity } = useEntity();
  const catalogApi = useApi(catalogApiRef);
  const [expanded, setExpanded] = useState(false);
  const { loading, error, value } = useAsync(async () => {
    return getRelationWarnings(entity, catalogApi);
  }, [entity, catalogApi]);

  if (error) {
    return (
      <Box mb={1}>
        <ResponseErrorPanel error={error} />
      </Box>
    );
  }

  if (loading || !value || value.length === 0) {
    return null;
  }

  const userFacingRefs = value.filter(ref => {
    const kind = ref.split(':')[0].toLowerCase();
    return !PLATFORM_KINDS.has(kind);
  });

  if (userFacingRefs.length === 0) {
    return null;
  }

  return (
    <Alert severity="warning">
      Some related entities could not be found in the catalog. This may be
      because they don't exist or you may not have permission to view them.{' '}
      <Button size="small" onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Hide' : 'Show'} details
      </Button>
      <Collapse in={expanded}>{userFacingRefs.join(', ')}</Collapse>
    </Alert>
  );
}
