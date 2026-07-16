import { type ReactNode, useMemo } from 'react';
import { Box, Chip, IconButton, Tooltip, Typography } from '@material-ui/core';
import { PageLoader, Spinner } from '@openchoreo/backstage-design-system';
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
import {
  queryClient,
  useUserScopedKey,
} from '@openchoreo/backstage-plugin-react';
import { useIsFetching } from '@tanstack/react-query';
import type { QueryEntitiesResponse } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';
import { useCardListStyles } from './styles';
import { pickCatalogSeed, type CatalogSeedEntry } from './catalogSeed';
import { deriveCatalogLoadState } from './catalogLoadState';
import { useSelectedKind } from './SelectedKindContext';
import { kindDisplayNames } from '../../utils/kindUtils';
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
  'Workflow Plane': 'Workflow Planes',
  'Observability Plane': 'Observability Planes',
  Environment: 'Environments',
  'Deployment Pipeline': 'Deployment Pipelines',
  'Component Type': 'Component Types',
  'Trait Type': 'Trait Types',
  Workflow: 'Workflows',
  'Component Workflow': 'Component Workflows',
};

const PLANE_KINDS = new Set([
  'dataplane',
  'workflowplane',
  'observabilityplane',
  'clusterdataplane',
  'clusterworkflowplane',
  'clusterobservabilityplane',
]);

type GridTemplateKey =
  | 'gridTemplateComponent'
  | 'gridTemplateApi'
  | 'gridTemplateEnvironment'
  | 'gridTemplatePlane'
  | 'gridTemplateSimple'
  | 'gridTemplateMinimal';

function getGridTemplate(selectedKind: string | undefined): GridTemplateKey {
  const kind = selectedKind?.toLowerCase();
  if (kind === 'component' || kind === 'resource')
    return 'gridTemplateComponent';
  if (kind === 'api') return 'gridTemplateApi';
  if (
    kind === 'environment' ||
    kind === 'workflow' ||
    kind === 'clusterworkflow'
  )
    return 'gridTemplateEnvironment';
  if (kind && PLANE_KINDS.has(kind)) return 'gridTemplatePlane';
  if (kind === 'namespace' || kind === 'domain') return 'gridTemplateMinimal';
  return 'gridTemplateSimple';
}

function getHeaderColumns(selectedKind: string | undefined): string[] {
  const kind = selectedKind?.toLowerCase();
  if (kind === 'component' || kind === 'resource')
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
  if (
    kind === 'environment' ||
    kind === 'workflow' ||
    kind === 'clusterworkflow'
  )
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
  actionButton?: ReactNode;
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
    queryParameters,
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

  // The authoritative selected kind. `filters.kind` (applied filter) and the URL
  // both LAG during an in-app kind switch: the provider only sets `appliedFilters`
  // and rewrites the URL AFTER the new kind's fetch resolves. So on a switch, both
  // still read the OLD kind for the whole loading window — which would leave the
  // old kind's title/columns on screen (and defeat the kind-switch cold-load
  // detection). The `ChoreoEntityKindPicker` publishes the newly picked kind to
  // `SelectedKindContext` synchronously on selection, so prefer that; fall back to
  // `filters.kind`/the URL for the initial mount and deep-links (before any in-app
  // selection), where the context is still empty.
  const { selectedKind: contextKind } = useSelectedKind();
  const urlKind = (
    [queryParameters?.kind].flat()[0] as string | undefined
  )?.toLowerCase();
  const selectedKind =
    contextKind ?? filters.kind?.value?.toLowerCase() ?? urlKind;
  const gridTemplateClass = classes[getGridTemplate(selectedKind)];
  const headerColumns = getHeaderColumns(selectedKind);

  // Whether the held live entities are the currently selected kind. During a
  // kind SWITCH `useEntityList` keeps the previous kind's `entities` while the
  // new kind refetches, so they'd be the wrong kind for the selected view.
  // Detect that so we neither render them (they'd misalign under the new
  // headers) nor let them block a cached seed for the new kind.
  const heldKindMatches =
    entities.length === 0 ||
    !selectedKind ||
    !entities[0].kind ||
    entities[0].kind.toLowerCase() === selectedKind;

  // On a fresh mount (navigating back to /catalog) `useEntityList` starts with
  // empty `entities` and re-runs its own async fetch, so it can't paint from
  // cache synchronously — that's the skeleton flash. Seed the first render from
  // the warm `queryEntities` response our CachingCatalogApi already stored,
  // read straight out of the shared queryClient. This is READ-ONLY (a miss just
  // falls back to the loader) and scoped to the signed-in user via
  // useUserScopedKey, so it can't cross-serve. Selection rules (unfiltered
  // first page only, kind-only request, recency-ranked) live in the tested pure
  // helper `pickCatalogSeed`; here we just gather the cache entries and criteria.
  //
  // `project`/`component` are custom OpenChoreo filters registered via
  // `updateFilters` (typed as `any` at their call sites), so they aren't on the
  // `DefaultEntityFilters` shape — read them through a widened view.
  const activeFilters = filters as Record<string, unknown>;
  const hasNarrowingFilter = Boolean(
    activeFilters.namespace ||
      activeFilters.project ||
      activeFilters.component ||
      activeFilters.type ||
      activeFilters.user ||
      activeFilters.text,
  );

  const scopeKey = useUserScopedKey();
  const seed = useMemo<QueryEntitiesResponse | undefined>(() => {
    const prefix = scopeKey(['catalog', 'queryEntities']);
    const entries: CatalogSeedEntry[] = queryClient
      .getQueryCache()
      .findAll({ queryKey: prefix })
      .map(q => ({
        request: q.queryKey[4] as CatalogSeedEntry['request'],
        data: q.state.data as QueryEntitiesResponse | undefined,
        updatedAt: q.state.dataUpdatedAt,
      }));
    return pickCatalogSeed(entries, {
      selectedKind,
      hasNarrowingFilter,
      offset,
      // Only entities of the SELECTED kind count as "live" — during a kind
      // switch the held entities are the previous kind, so they must not block
      // a cached seed for the new kind (which lets a cached B paint instantly
      // instead of flashing the loader).
      hasLiveEntities: entities.length > 0 && heldKindMatches,
    });
  }, [
    scopeKey,
    selectedKind,
    hasNarrowingFilter,
    offset,
    entities.length,
    heldKindMatches,
  ]);

  // Rows to render: the live list when it's the selected kind, else the cached
  // seed. On a kind switch the held entities are the wrong kind, so the seed
  // (kind-matched) wins — a cached new kind paints immediately; an uncached one
  // has no seed, leaving nothing to show so the cold-load loader takes over.
  const displayEntities =
    entities.length > 0 && heldKindMatches ? entities : seed?.items ?? [];
  // Prefer the live count; fall back to the seed's while it loads.
  const displayTotal = totalItems ?? seed?.totalItems;

  // Derive the display label from the authoritative `selectedKind` first (via the
  // same `kindDisplayNames` map the picker uses, e.g. domain→Namespace), so the
  // title reflects the newly picked kind immediately on a switch instead of the
  // lagging `filters.kind?.label`. Fall back to the applied filter's label, then a
  // capitalized kind, then the generic "Entity".
  const capitalizedKind = selectedKind
    ? selectedKind.charAt(0).toUpperCase() + selectedKind.slice(1)
    : undefined;
  const kindLabel =
    (selectedKind && kindDisplayNames[selectedKind]) ||
    filters.kind?.label ||
    filters.kind?.value ||
    capitalizedKind ||
    'Entity';
  const pluralLabel = kindPluralNames[kindLabel] || `${kindLabel}s`;
  const titleText = `All ${displayTotal === 1 ? kindLabel : pluralLabel}${
    displayTotal !== undefined ? ` (${displayTotal})` : ''
  }`;

  // The real background-revalidation signal comes from the shared queryClient,
  // not `useEntityList().loading`: our CachingCatalogApi serves the cached page
  // instantly and revalidates behind it, so `loading` flips false the moment the
  // cached read resolves (tens of ms) while the network refetch runs on for the
  // whole round-trip. `useIsFetching` on the catalog `queryEntities` key tracks
  // that actual in-flight fetch, so the overlay stays up until it settles.
  const queryFetching =
    useIsFetching(
      { queryKey: scopeKey(['catalog', 'queryEntities']) },
      queryClient,
    ) > 0;

  // Cold load (nothing safe to show → PageLoader) vs. background refresh (rows
  // on screen while the query revalidates → quiet inline spinner). A kind SWITCH
  // counts as cold — the column set follows `selectedKind`, so held old-kind
  // rows would misalign under new headers. Logic lives in the tested pure helper.
  const { firstLoad, backgroundRefreshing } = deriveCatalogLoadState({
    loading,
    queryFetching,
    entities,
    displayEntities,
    selectedKind,
  });

  return (
    <Box>
      <Box className={classes.searchAndTitle}>
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <Typography className={classes.titleText}>{titleText}</Typography>
          {/* Quiet inline spinner next to the count while a background
              revalidation runs behind the cached/held rows. role="status" +
              aria-label so assistive tech announces the refresh. */}
          {backgroundRefreshing && (
            <Box
              component="span"
              role="status"
              aria-label={`Refreshing ${pluralLabel.toLowerCase()}`}
              display="inline-flex"
              alignItems="center"
            >
              <Spinner size="chip" aria-hidden="true" />
            </Box>
          )}
        </Box>
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

      {firstLoad && <PageLoader minHeight={240} />}
      {!loading && displayEntities.length === 0 && (
        <Box className={classes.emptyState}>No entities found</Box>
      )}
      {!firstLoad && displayEntities.length > 0 && (
        <Box className={classes.listContainer}>
          {/* Header row */}
          <Box className={`${classes.headerRow} ${gridTemplateClass}`}>
            {headerColumns.map((col, i) => (
              <Typography key={i} className={classes.headerCell}>
                {col}
              </Typography>
            ))}
          </Box>

          {displayEntities.map(entity => {
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
              selectedKind === 'component' ||
              selectedKind === 'api' ||
              selectedKind === 'resource';
            const showComponent = selectedKind === 'api';
            const showType =
              selectedKind === 'component' ||
              selectedKind === 'api' ||
              selectedKind === 'resource' ||
              selectedKind === 'environment' ||
              selectedKind === 'workflow' ||
              selectedKind === 'clusterworkflow';
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
                  <Box
                    className={`${classes.columnCell} ${classes.hiddenOnMobile}`}
                  >
                    {componentType ? (
                      <Chip
                        label={componentType}
                        title={componentType}
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
                    <Tooltip title="Open in new tab">
                      <IconButton
                        component="a"
                        href={entityRoute({
                          kind: entity.kind.toLocaleLowerCase('en-US'),
                          namespace: entity.metadata.namespace || 'default',
                          name: entity.metadata.name,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {!firstLoad && displayTotal !== undefined && displayTotal > 0 && (
        <Box className={classes.paginationContainer}>
          <TablePagination
            count={displayTotal}
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
