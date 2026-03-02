import React from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Typography,
} from '@material-ui/core';
import { TablePagination } from '@material-ui/core';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { useApp, useRouteRef } from '@backstage/core-plugin-api';
import {
  EntitySearchBar,
  EntityRefLink,
  entityRouteRef,
  FavoriteEntity,
  useEntityList,
} from '@backstage/plugin-catalog-react';
import { useNavigate } from 'react-router-dom';
import {
  DeletionBadge,
  isMarkedForDeletion,
} from '@openchoreo/backstage-plugin';
import { Entity } from '@backstage/catalog-model';
import { useCardListStyles } from './styles';
import {
  StarredChip,
  TypeChip,
  ProjectChip,
  ComponentChip,
  NamespaceChip,
} from './CustomPersonalFilters';

const kindPluralNames: Record<string, string> = {
  Namespace: 'Namespaces',
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

type GridTemplateKey =
  | 'gridTemplateComponent'
  | 'gridTemplateApi'
  | 'gridTemplateEnvironment'
  | 'gridTemplatePlane'
  | 'gridTemplateSimple'
  | 'gridTemplateMinimal';

function getGridTemplate(selectedKind: string | undefined): GridTemplateKey {
  const kind = selectedKind?.toLowerCase();
  if (kind === 'component') return 'gridTemplateComponent';
  if (kind === 'api') return 'gridTemplateApi';
  if (kind === 'environment' || kind === 'workflow')
    return 'gridTemplateEnvironment';
  if (kind && PLANE_KINDS.has(kind)) return 'gridTemplatePlane';
  if (kind === 'namespace' || kind === 'domain') return 'gridTemplateMinimal';
  return 'gridTemplateSimple';
}

function getHeaderColumns(selectedKind: string | undefined): string[] {
  const kind = selectedKind?.toLowerCase();
  if (kind === 'component')
    return [
      '',
      'Name',
      'Description',
      'Namespace',
      'Project',
      'Type',
      'Actions',
    ];
  if (kind === 'api')
    return [
      '',
      'Name',
      'Description',
      'Namespace',
      'Project',
      'Component',
      'Type',
      'Actions',
    ];
  if (kind === 'environment' || kind === 'workflow')
    return ['', 'Name', 'Description', 'Namespace', 'Type', 'Actions'];
  if (kind && PLANE_KINDS.has(kind))
    return ['', 'Name', 'Description', 'Namespace', 'Agent', 'Actions'];
  if (kind === 'namespace' || kind === 'domain')
    return ['', 'Name', 'Description', 'Actions'];
  return ['', 'Name', 'Description', 'Namespace', 'Actions'];
}

function EntityKindIcon({ entity }: { entity: Entity }) {
  const app = useApp();
  const kind = entity.kind?.toLowerCase();
  const Icon = app.getSystemIcon(`kind:${kind}`);
  if (!Icon) return null;
  return <Icon />;
}

function KindIcon({ kind }: { kind: string }) {
  const app = useApp();
  const Icon = app.getSystemIcon(`kind:${kind}`);
  if (!Icon) return null;
  return <Icon />;
}

interface CatalogCardListProps {
  actionButton?: React.ReactNode;
}

export const CatalogCardList = ({ actionButton }: CatalogCardListProps) => {
  const classes = useCardListStyles();
  const navigate = useNavigate();
  const entityRoute = useRouteRef(entityRouteRef);
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

  const handleRowClick = (entity: Entity) => {
    const url = entityRoute({
      kind: entity.kind.toLocaleLowerCase('en-US'),
      namespace: entity.metadata.namespace || 'default',
      name: entity.metadata.name,
    });
    navigate(url);
  };

  const kindLabel = filters.kind?.label || filters.kind?.value || 'Entity';
  const pluralLabel = kindPluralNames[kindLabel] || `${kindLabel}s`;
  const titleText = `All ${totalItems === 1 ? kindLabel : pluralLabel}${
    totalItems !== undefined ? ` (${totalItems})` : ''
  }`;

  const selectedKind = filters.kind?.value?.toLowerCase();
  const gridTemplateClass = classes[getGridTemplate(selectedKind)];
  const headerColumns = getHeaderColumns(selectedKind);

  return (
    <Box>
      <Box className={classes.searchAndTitle}>
        <Typography className={classes.titleText}>{titleText}</Typography>
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <NamespaceChip />
          <ProjectChip />
          <ComponentChip />
          <TypeChip />
          <StarredChip />
          <form onSubmit={e => e.preventDefault()}>
            <EntitySearchBar />
          </form>
          {actionButton}
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
          {/* Header row */}
          <Box className={`${classes.headerRow} ${gridTemplateClass}`}>
            {headerColumns.map((col, i) => (
              <Typography key={i} className={classes.headerCell}>
                {col}
              </Typography>
            ))}
          </Box>

          {entities.map(entity => {
            const name =
              entity.metadata.title || entity.metadata.name || 'Unnamed';
            const description = entity.metadata.description || '';
            const markedForDeletion = isMarkedForDeletion(entity);
            const namespace = entity.metadata.namespace;
            const componentType = (entity.spec as any)?.type;

            const projectName =
              entity.metadata.annotations?.['openchoreo.io/project'];
            const componentName =
              entity.metadata.annotations?.['openchoreo.io/component'];
            const agentConnected =
              entity.metadata.annotations?.['openchoreo.io/agent-connected'] ===
              'true';

            const showNamespace =
              selectedKind !== 'namespace' && selectedKind !== 'domain';
            const showProject =
              selectedKind === 'component' || selectedKind === 'api';
            const showComponent = selectedKind === 'api';
            const showType =
              selectedKind === 'component' ||
              selectedKind === 'api' ||
              selectedKind === 'environment' ||
              selectedKind === 'workflow';
            const isPlane = selectedKind && PLANE_KINDS.has(selectedKind);

            return (
              <Box
                key={`${entity.kind}:${
                  entity.metadata.namespace || 'default'
                }/${entity.metadata.name}`}
                className={`${classes.entityRow} ${gridTemplateClass}`}
                onClick={
                  !markedForDeletion ? () => handleRowClick(entity) : undefined
                }
                style={!markedForDeletion ? { cursor: 'pointer' } : undefined}
              >
                {/* Icon cell */}
                <Box className={classes.iconCell}>
                  <EntityKindIcon entity={entity} />
                </Box>

                {/* Name cell */}
                <Box className={classes.nameCell}>
                  {markedForDeletion ? (
                    <Box className={classes.deletionRow}>
                      <Typography className={classes.entityNameDisabled}>
                        {name}
                      </Typography>
                      <DeletionBadge />
                    </Box>
                  ) : (
                    <Typography className={classes.entityName}>
                      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                      <span onClick={e => e.stopPropagation()}>
                        <EntityRefLink
                          entityRef={entity}
                          defaultKind={entity.kind}
                        >
                          {name}
                        </EntityRefLink>
                      </span>
                    </Typography>
                  )}
                </Box>

                {/* Description column */}
                <Typography
                  className={`${classes.description} ${
                    classes.hiddenOnMobile
                  } ${!description ? classes.emptyValue : ''}`}
                >
                  {description || '\u2014'}
                </Typography>

                {/* Namespace column */}
                {showNamespace && (
                  <Box
                    className={`${classes.linkCell} ${classes.cellWithIcon} ${classes.hiddenOnMobile}`}
                  >
                    {namespace ? (
                      <>
                        <KindIcon kind="domain" />
                        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                        <span onClick={e => e.stopPropagation()}>
                          <EntityRefLink
                            entityRef={{
                              kind: 'domain',
                              namespace: 'default',
                              name: namespace,
                            }}
                            defaultKind="domain"
                          >
                            {namespace}
                          </EntityRefLink>
                        </span>
                      </>
                    ) : (
                      '\u2014'
                    )}
                  </Box>
                )}

                {/* Project column (component & api) */}
                {showProject && (
                  <Box
                    className={`${classes.linkCell} ${classes.cellWithIcon} ${classes.hiddenOnMobile}`}
                  >
                    {projectName ? (
                      <>
                        <KindIcon kind="system" />
                        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                        <span onClick={e => e.stopPropagation()}>
                          <EntityRefLink
                            entityRef={{
                              kind: 'system',
                              namespace: namespace || 'default',
                              name: projectName,
                            }}
                            defaultKind="system"
                          >
                            {projectName}
                          </EntityRefLink>
                        </span>
                      </>
                    ) : (
                      <span className={classes.emptyValue}>{'\u2014'}</span>
                    )}
                  </Box>
                )}

                {/* Component column (api only) */}
                {showComponent && (
                  <Box
                    className={`${classes.linkCell} ${classes.cellWithIcon} ${classes.hiddenOnMobile}`}
                  >
                    {componentName ? (
                      <>
                        <KindIcon kind="component" />
                        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                        <span onClick={e => e.stopPropagation()}>
                          <EntityRefLink
                            entityRef={{
                              kind: 'component',
                              namespace: namespace || 'default',
                              name: componentName,
                            }}
                            defaultKind="component"
                          >
                            {componentName}
                          </EntityRefLink>
                        </span>
                      </>
                    ) : (
                      <span className={classes.emptyValue}>{'\u2014'}</span>
                    )}
                  </Box>
                )}

                {/* Type column */}
                {showType && (
                  <Box className={classes.hiddenOnMobile}>
                    {componentType ? (
                      <Chip
                        label={componentType}
                        size="small"
                        variant="outlined"
                        color={
                          selectedKind === 'environment' &&
                          componentType === 'production'
                            ? 'secondary'
                            : 'default'
                        }
                        className={classes.metadataChip}
                      />
                    ) : (
                      <Typography
                        className={`${classes.columnCell} ${classes.emptyValue}`}
                      >
                        {'\u2014'}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Agent status column (planes) */}
                {isPlane && (
                  <Box
                    className={`${classes.agentStatus} ${classes.hiddenOnMobile}`}
                  >
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

                {/* Actions cell */}
                <Box
                  className={classes.actionsCell}
                  onClick={e => e.stopPropagation()}
                >
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
