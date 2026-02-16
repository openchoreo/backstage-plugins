import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Typography,
} from '@material-ui/core';
import { TablePagination } from '@material-ui/core';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { useApp, useRouteRef } from '@backstage/core-plugin-api';
import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { Link } from 'react-router-dom';
import {
  EntitySearchBar,
  EntityRefLink,
  FavoriteEntity,
  useEntityList,
} from '@backstage/plugin-catalog-react';
import {
  DeletionBadge,
  isMarkedForDeletion,
} from '@openchoreo/backstage-plugin';
import { Entity } from '@backstage/catalog-model';
import { useCardListStyles } from './styles';
import { StarredChip, TypeChip, ProjectChip } from './CustomPersonalFilters';

const kindPluralNames: Record<string, string> = {
  Project: 'Projects',
  Component: 'Components',
  API: 'APIs',
  User: 'Users',
  Group: 'Groups',
  Resource: 'Resources',
  Location: 'Locations',
  Template: 'Templates',
  Dataplane: 'Dataplanes',
  'Build Plane': 'Build Planes',
  'Observability Plane': 'Observability Planes',
  Environment: 'Environments',
  'Deployment Pipeline': 'Deployment Pipelines',
  'Component Type': 'Component Types',
  'Trait Type': 'Trait Types',
  Workflow: 'Workflows',
  'Component Workflow': 'Component Workflows',
};

const PLANE_KINDS = new Set(['dataplane', 'buildplane', 'observabilityplane']);

function EntityKindIcon({ entity }: { entity: Entity }) {
  const app = useApp();
  const kind = entity.kind?.toLowerCase();
  const Icon = app.getSystemIcon(`kind:${kind}`);
  if (!Icon) return null;
  return <Icon />;
}

export const CatalogCardList = () => {
  const classes = useCardListStyles();
  const createComponentLink = useRouteRef(scaffolderPlugin.routes.root);
  const {
    entities,
    totalItems,
    loading,
    filters,
    limit,
    offset,
    setLimit,
    setOffset,
  } = useEntityList();

  const kindLabel = filters.kind?.label || filters.kind?.value || 'Entity';
  const pluralLabel = kindPluralNames[kindLabel] || `${kindLabel}s`;
  const titleText = `All ${totalItems === 1 ? kindLabel : pluralLabel}${
    totalItems !== undefined ? ` (${totalItems})` : ''
  }`;

  return (
    <Box>
      <Box className={classes.searchAndTitle}>
        <Typography className={classes.titleText}>{titleText}</Typography>
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <ProjectChip />
          <TypeChip />
          <StarredChip />
          <form onSubmit={e => e.preventDefault()}>
            <EntitySearchBar />
          </form>
          <Button
            variant="contained"
            color="primary"
            component={Link}
            to={createComponentLink()}
            size="small"
          >
            Create
          </Button>
        </Box>
      </Box>

      {loading && (
        <Box className={classes.loadingContainer}>
          <CircularProgress />
        </Box>
      )}
      {!loading && entities.length === 0 && (
        <Box className={classes.emptyState}>No entities found</Box>
      )}
      {!loading && entities.length > 0 && (
        <Box className={classes.listContainer}>
          {entities.map(entity => {
            const name =
              entity.metadata.title || entity.metadata.name || 'Unnamed';
            const description = entity.metadata.description || '';
            const markedForDeletion = isMarkedForDeletion(entity);
            const namespace = entity.metadata.namespace;
            const selectedKind = filters.kind?.value?.toLowerCase();
            const componentType = (entity.spec as any)?.type;

            const projectName =
              entity.metadata.annotations?.['openchoreo.io/project'];
            const agentConnected =
              entity.metadata.annotations?.['openchoreo.io/agent-connected'] ===
              'true';

            return (
              <Box
                key={`${entity.kind}:${
                  entity.metadata.namespace || 'default'
                }/${entity.metadata.name}`}
                className={classes.entityCard}
              >
                <Box className={classes.iconContainer}>
                  <EntityKindIcon entity={entity} />
                </Box>
                <Box className={classes.contentContainer}>
                  {markedForDeletion ? (
                    <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                      <Typography className={classes.entityNameDisabled}>
                        {name}
                      </Typography>
                      {namespace && namespace !== 'default' && (
                        <Chip
                          label={`ns: ${namespace}`}
                          size="small"
                          variant="outlined"
                          className={classes.metadataChip}
                        />
                      )}
                      {selectedKind === 'component' && projectName && (
                        <Chip
                          label={`project: ${projectName}`}
                          size="small"
                          variant="outlined"
                          color="primary"
                          className={classes.metadataChip}
                        />
                      )}
                      <DeletionBadge />
                    </Box>
                  ) : (
                    <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                      <Typography className={classes.entityName}>
                        <EntityRefLink
                          entityRef={entity}
                          defaultKind={entity.kind}
                        >
                          {name}
                        </EntityRefLink>
                      </Typography>
                      {namespace && namespace !== 'default' && (
                        <Chip
                          label={`ns: ${namespace}`}
                          size="small"
                          variant="outlined"
                          className={classes.metadataChip}
                        />
                      )}
                      {selectedKind === 'component' && projectName && (
                        <Chip
                          label={`project: ${projectName}`}
                          size="small"
                          variant="outlined"
                          color="primary"
                          className={classes.metadataChip}
                        />
                      )}
                    </Box>
                  )}
                  {description && (
                    <Typography className={classes.description}>
                      {description}
                    </Typography>
                  )}
                </Box>
                {selectedKind === 'component' && componentType && (
                  <Box className={classes.typeContainer}>
                    <Chip
                      label={componentType}
                      size="small"
                      variant="outlined"
                      color="default"
                      className={classes.metadataChip}
                    />
                  </Box>
                )}
                {selectedKind === 'environment' && componentType && (
                  <Box className={classes.typeContainer}>
                    <Chip
                      label={componentType}
                      size="small"
                      variant="outlined"
                      color={
                        componentType === 'production' ? 'secondary' : 'default'
                      }
                      className={classes.metadataChip}
                    />
                  </Box>
                )}
                {selectedKind && PLANE_KINDS.has(selectedKind) && (
                  <Box className={classes.agentStatus}>
                    <Box
                      className={`${classes.agentDot} ${
                        agentConnected
                          ? classes.agentConnected
                          : classes.agentDisconnected
                      }`}
                    />
                    {agentConnected ? 'Connected' : 'Disconnected'}
                  </Box>
                )}
                <Box className={classes.actionsContainer}>
                  <FavoriteEntity entity={entity} />
                  {!markedForDeletion && (
                    <EntityRefLink entityRef={entity} defaultKind={entity.kind}>
                      <IconButton size="small">
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </EntityRefLink>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {!loading && totalItems !== undefined && totalItems > 0 && (
        <Box className={classes.paginationContainer}>
          <TablePagination
            count={totalItems}
            page={
              offset !== undefined && limit > 0 ? Math.floor(offset / limit) : 0
            }
            onPageChange={(_event, newPage) => {
              setOffset?.(newPage * limit);
            }}
            rowsPerPage={limit}
            onRowsPerPageChange={event => {
              setLimit(parseInt(event.target.value, 10));
              setOffset?.(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Box>
      )}
    </Box>
  );
};
