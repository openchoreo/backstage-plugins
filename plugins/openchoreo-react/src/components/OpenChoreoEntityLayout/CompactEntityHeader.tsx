import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
import useAsync from 'react-use/esm/useAsync';
import { useIsFetching } from '@tanstack/react-query';
import { useOpenChoreoQuery } from '../../hooks/useOpenChoreoQuery';
import { useUserScopedKey } from '../../query/OpenChoreoQueryProvider';
import Box from '@material-ui/core/Box';
import MaterialBreadcrumbs from '@material-ui/core/Breadcrumbs';
import Chip from '@material-ui/core/Chip';
import IconButton from '@material-ui/core/IconButton';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import {
  catalogApiRef,
  EntityDisplayName,
  FavoriteEntity,
} from '@backstage/plugin-catalog-react';
import {
  parseEntityRef,
  stringifyEntityRef,
  type Entity,
  type EntityRelation,
} from '@backstage/catalog-model';
import { useNavigate } from 'react-router-dom';
import {
  lightTokens,
  darkTokens,
  Skeleton,
  Spinner,
} from '@openchoreo/backstage-design-system';

export interface CompactEntityHeaderProps {
  entity: Entity;
  headerTitle: string;
  kind: string;
  /** Current entity name for breadcrumb trail */
  entityName: string;
  kindDisplayNames?: Record<string, string>;
  parentEntity?: EntityRelation | null;
  ancestorEntity?: EntityRelation | null;
  contextMenu?: ReactNode;
  /**
   * True while navigating to another entity. When set, the header keeps its
   * chrome mounted but renders the entity-derived bits (type chip, favorite,
   * parent breadcrumbs) as skeletons — the current entity's identity still
   * comes from the URL-derived `kind`/`entityName`, so it updates immediately.
   */
  loading?: boolean;
}

function buildCatalogEntityPath(entityRef: string): string | null {
  try {
    const { namespace, kind, name } = parseEntityRef(entityRef, {
      defaultNamespace: 'default',
      defaultKind: 'Component',
    });
    return `/catalog/${namespace.toLowerCase()}/${kind.toLowerCase()}/${name}`;
  } catch {
    return null;
  }
}

function buildCatalogEntityPathFromEntity(entity: Entity): string {
  return `/catalog/${(
    entity.metadata.namespace ?? 'default'
  ).toLowerCase()}/${entity.kind.toLowerCase()}/${entity.metadata.name}`;
}

function normalizeEntityRef(ref: string): string | null {
  try {
    const parsed = parseEntityRef(ref, {
      defaultNamespace: 'default',
      defaultKind: 'Component',
    });
    return `${parsed.kind.toLowerCase()}:${parsed.namespace.toLowerCase()}/${parsed.name.toLowerCase()}`;
  } catch {
    return null;
  }
}

function formatResourceTypeLabel(kind: string): string {
  return kind
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');
}

function toPluralLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return 'Resources';
  if (trimmed.endsWith('s') || trimmed.endsWith('S')) return trimmed;
  return `${trimmed}s`;
}

// Named 'BackstageHeader' so that theme component overrides for
// BackstageHeader are merged into the matching class keys by MUI's style system.
const useStyles = makeStyles(
  theme => ({
    header: {
      gridArea: 'pageHeader',
      padding: theme.spacing(2, 3),
      width: '100%',
      color: theme.page.fontColor,
      backgroundImage: theme.page.backgroundImage,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
      boxShadow: theme.shadows[4],
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(2),
      },
    },
    topRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      minHeight: 40,
      [theme.breakpoints.down('sm')]: {
        flexWrap: 'wrap',
        minHeight: 'auto',
        rowGap: theme.spacing(0.75),
      },
    },
    chip: {
      color: theme.page.fontColor,
      borderColor: `${theme.page.fontColor}80`,
      fontSize: '0.7rem',
      fontWeight: 600,
      height: 24,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    kindChip: {
      [theme.breakpoints.down('sm')]: {
        maxWidth: '100%',
      },
    },
    title: {
      color: theme.page.fontColor,
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.h5.fontWeight as number,
      wordBreak: 'break-word',
      display: 'block',
      minWidth: 0,
      [theme.breakpoints.down('sm')]: {
        flexBasis: '100%',
        lineHeight: 1.2,
      },
    },
    favorite: {
      display: 'inline-flex',
      '& button:hover svg': {
        color: (theme.palette.type === 'dark' ? darkTokens : lightTokens).status
          .gold,
      },
    },
    breadcrumbs: {
      color: theme.page.fontColor,
      fontSize: theme.typography.body2.fontSize,
      marginTop: theme.spacing(0.5),
      opacity: 0.9,
      '& ol': {
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: theme.spacing(0.25),
      },
      '& li[class*="MuiBreadcrumbs-separator"]': {
        margin: theme.spacing(0, 0.25),
        opacity: 0.7,
      },
      [theme.breakpoints.down('sm')]: {
        marginTop: theme.spacing(1),
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingBottom: theme.spacing(0.125),
        '& ol': {
          flexWrap: 'nowrap',
          gap: theme.spacing(0.125),
        },
      },
      '&::-webkit-scrollbar': {
        height: 6,
      },
      '&::-webkit-scrollbar-thumb': {
        backgroundColor: `${theme.page.fontColor}40`,
        borderRadius: 6,
      },
      '&::-webkit-scrollbar-track': {
        backgroundColor: `${theme.page.fontColor}12`,
      },
    },
    breadcrumbKindLink: {
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: theme.typography.body2.fontSize,
      fontWeight: 500,
      fontStyle: 'normal',
      lineHeight: 1.3,
      // Derive from the page font color so we stay legible on the gradient
      // header in both themes. `grey[200]` used to be `#e5e7eb` in light
      // (good), but the dark token set inverts the grey scale, making it a
      // near-black and invisible on the dark-purple header.
      color: theme.page.fontColor,
      opacity: 0.75,
      textDecoration: 'none',
      textTransform: 'lowercase',
      padding: 0,
      borderRadius: 0,
      whiteSpace: 'nowrap',
      overflowWrap: 'normal',
      '&:hover': {
        color: theme.page.fontColor,
        opacity: 1,
        textDecoration: 'underline',
      },
    },
    breadcrumbKindDivider: {
      display: 'inline-flex',
      alignItems: 'center',
      color: theme.page.fontColor,
      opacity: 0.75,
      fontSize: theme.typography.body2.fontSize,
      lineHeight: 1.3,
      userSelect: 'none',
    },
    breadcrumbNameLink: {
      display: 'inline-flex',
      alignItems: 'center',
      color: theme.page.fontColor,
      fontSize: theme.typography.body2.fontSize,
      fontWeight: 700,
      lineHeight: 1.3,
      padding: 0,
      borderRadius: 0,
      background: 'transparent',
      whiteSpace: 'nowrap',
      overflowWrap: 'normal',
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
    breadcrumbLevelBox: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.25),
      border: `1px solid ${theme.page.fontColor}33`,
      borderRadius: 6,
      padding: theme.spacing(0.125, 0.5, 0.125, 0.75),
      backgroundColor: `${theme.page.fontColor}0D`,
      textDecoration: 'none !important',
      [theme.breakpoints.down('sm')]: {
        gap: theme.spacing(0.125),
        borderRadius: 5,
        padding: theme.spacing(0, 0.375, 0, 0.5),
      },
    },
    breadcrumbPlainText: {
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: theme.typography.body2.fontSize,
      lineHeight: 1.3,
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      textDecoration: 'none !important',
    },
    breadcrumbSeparatorButton: {
      border: 0,
      background: 'transparent',
      color: theme.page.fontColor,
      borderRadius: 999,
      lineHeight: 1,
      fontSize: '14px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 22,
      minWidth: 22,
      padding: 0,
      margin: 0,
      cursor: 'pointer',
      transition: 'none',
      [theme.breakpoints.down('sm')]: {
        minHeight: 20,
        minWidth: 20,
      },
      '&:hover': {
        backgroundColor: `${theme.page.fontColor}1A`,
      },
      '&:focus-visible': {
        backgroundColor: `${theme.page.fontColor}24`,
      },
    },
    breadcrumbCaretIcon: {
      fontSize: 18,
      display: 'block',
      transform: 'rotate(90deg)',
      transformOrigin: '50% 50%',
      transformBox: 'fill-box',
      transition: 'none',
    },
    breadcrumbSeparatorButtonHover: {
      '&:hover $breadcrumbCaretIcon': {},
      '&:focus-visible $breadcrumbCaretIcon': {},
    },
    breadcrumbSeparatorButtonOpen: {
      '& $breadcrumbCaretIcon': {},
    },
    breadcrumbMenuItem: {
      minWidth: 220,
      alignItems: 'flex-start',
    },
    breadcrumbMenuItemContent: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
    },
    breadcrumbMenuTitle: {
      fontSize: '0.67rem',
      letterSpacing: '0.08em',
      lineHeight: 1.2,
      textTransform: 'uppercase',
      opacity: 0.72,
      textDecoration: 'none !important',
      textUnderlineOffset: 0,
    },
    breadcrumbMenuValue: {
      fontSize: '14px',
      fontWeight: 600,
      lineHeight: 1.35,
    },
    breadcrumbMenuOpenIconButton: {
      padding: 4,
      marginRight: -4,
    },
    breadcrumbMenuOpenIcon: {
      fontSize: 16,
    },
  }),
  { name: 'BackstageHeader' },
);

export function CompactEntityHeader(props: CompactEntityHeaderProps) {
  const {
    entity,
    kind,
    entityName,
    kindDisplayNames,
    parentEntity,
    ancestorEntity,
    contextMenu,
    loading = false,
  } = props;
  const classes = useStyles();
  const navigate = useNavigate();
  const catalogApi = useApi(catalogApiRef);
  const [breadcrumbMenuAnchor, setBreadcrumbMenuAnchor] =
    useState<HTMLElement | null>(null);
  // Which breadcrumb level's sibling menu is open (null = closed). Drives the
  // keyed useOpenChoreoQuery below so the sibling list renders cached-first —
  // reopening a level shows the cached list instantly (no spinner) and only
  // revalidates in the background.
  const [openNodeIndex, setOpenNodeIndex] = useState<number | null>(null);

  const kindLabel = kindDisplayNames?.[kind.toLowerCase()] ?? kind;

  // Expected number of parent breadcrumb levels for the URL kind, used to size
  // the skeleton trail while loading so it matches the real trail's shape:
  // Component/Resource/API sit under Namespace > Project (2), Project under
  // Namespace (1), Namespace and standalone platform resources have none (0).
  const loadingAncestorCount = (() => {
    switch (kind.toLowerCase()) {
      case 'component':
      case 'resource':
      case 'api':
        return 2;
      case 'system':
        return 1;
      default:
        return 0;
    }
  })();

  const entityType =
    entity.spec && 'type' in entity.spec
      ? (entity.spec as { type: string }).type
      : undefined;

  type BreadcrumbNode = {
    key: string;
    entityRef: string;
    normalizedRef: string | null;
    kind: string;
    namespace: string;
    /** Raw entity name (metadata.name) — used for catalog filter params. */
    name: string;
    value: string;
    displayType: string;
    path: string | null;
    relationType?: string;
    isCurrent: boolean;
  };

  // Fetch display titles for parent/ancestor entities (we only have refs)
  const { value: ancestorTitle } = useAsync(async () => {
    if (!ancestorEntity?.targetRef) return undefined;
    const ent = await catalogApi.getEntityByRef(ancestorEntity.targetRef);
    return ent?.metadata.title;
  }, [ancestorEntity?.targetRef]);

  const { value: parentTitle } = useAsync(async () => {
    if (!parentEntity?.targetRef) return undefined;
    const ent = await catalogApi.getEntityByRef(parentEntity.targetRef);
    return ent?.metadata.title;
  }, [parentEntity?.targetRef]);

  const breadcrumbNodes = useMemo<BreadcrumbNode[]>(() => {
    const nodes: BreadcrumbNode[] = [];

    const makeNode = (
      key: string,
      entityRef: string,
      options?: {
        isCurrent?: boolean;
        valueOverride?: string;
        relationType?: string;
      },
    ): BreadcrumbNode => {
      const parsed = parseEntityRef(entityRef, {
        defaultNamespace: entity.metadata.namespace ?? 'default',
        defaultKind: 'Component',
      });

      return {
        key,
        entityRef,
        normalizedRef: normalizeEntityRef(entityRef),
        kind: parsed.kind,
        namespace: parsed.namespace,
        name: parsed.name,
        value: options?.valueOverride ?? parsed.name,
        displayType:
          kindDisplayNames?.[parsed.kind.toLowerCase()] ??
          formatResourceTypeLabel(parsed.kind),
        path: buildCatalogEntityPath(entityRef),
        relationType: options?.relationType,
        isCurrent: options?.isCurrent ?? false,
      };
    };

    if (ancestorEntity?.targetRef) {
      nodes.push(
        makeNode(
          `ancestor-${ancestorEntity.targetRef}`,
          ancestorEntity.targetRef,
          { valueOverride: ancestorTitle ?? undefined },
        ),
      );
    }

    if (parentEntity?.targetRef) {
      nodes.push(
        makeNode(`parent-${parentEntity.targetRef}`, parentEntity.targetRef, {
          relationType: ancestorEntity?.type,
          valueOverride: parentTitle ?? undefined,
        }),
      );
    }

    const currentRef = stringifyEntityRef(entity);
    nodes.push(
      makeNode(`current-${currentRef}`, currentRef, {
        isCurrent: true,
        valueOverride: entity.metadata.title ?? entityName,
        relationType: parentEntity?.type,
      }),
    );

    return nodes;
  }, [
    ancestorEntity,
    parentEntity,
    entity,
    entityName,
    kindDisplayNames,
    ancestorTitle,
    parentTitle,
  ]);

  const getMenuTitleForNodeIndex = useCallback(
    (targetNodeIndex: number) => {
      const targetNode = breadcrumbNodes[targetNodeIndex];
      return targetNode ? toPluralLabel(targetNode.displayType) : 'Resources';
    },
    [breadcrumbNodes],
  );

  // The breadcrumb level whose sibling menu is currently open (if any).
  const openTargetNode =
    openNodeIndex !== null ? breadcrumbNodes[openNodeIndex] : undefined;
  const openLeftNode =
    openNodeIndex !== null ? breadcrumbNodes[openNodeIndex - 1] : undefined;

  const breadcrumbMenuTitle =
    openNodeIndex !== null
      ? getMenuTitleForNodeIndex(openNodeIndex)
      : 'Resources';

  // Sibling entities for the open level, fetched through the cached catalog API
  // via useQuery. Keyed by kind+namespace so reopening the same level paints the
  // previous list instantly from this query's own cache entry and re-renders when
  // the refetch lands — the imperative await-before-render version always blocked
  // on the network, even for a list loaded moments earlier.
  const { data: siblingEntities, loading: siblingsLoading } =
    useOpenChoreoQuery(
      ['breadcrumb-siblings', openTargetNode?.kind, openTargetNode?.namespace],
      () =>
        catalogApi.getEntities({
          filter: [
            {
              kind: openTargetNode!.kind,
              'metadata.namespace': openTargetNode!.namespace,
            },
          ],
        }),
      { enabled: Boolean(openTargetNode) },
    );

  // Two cache layers sit under this: the outer query above, and the inner
  // `getEntities` entry inside CachingCatalogApi. When the inner entry is still
  // within its freshness window the outer fetcher resolves without any network
  // call, so the outer `isRefetching` is not a reliable "fetching now" signal.
  // Track the inner `getEntities` query directly via `useIsFetching`, matched to
  // the open level's kind+namespace, so the spinner reflects the actual fetch.
  const scopeKey = useUserScopedKey();
  const siblingsRefetching =
    useIsFetching({
      queryKey: scopeKey(['catalog', 'getEntities']),
      predicate: query => {
        // Key shape: ['@user', user, 'catalog', 'getEntities', request].
        const request = query.queryKey[4] as
          | { filter?: Array<Record<string, unknown>> }
          | undefined;
        const filter = request?.filter?.[0];
        return (
          !!openTargetNode &&
          !!filter &&
          filter.kind === openTargetNode.kind &&
          filter['metadata.namespace'] === openTargetNode.namespace
        );
      },
    }) > 0;

  // Derive the menu items from the fetched siblings, applying the same
  // relation-based sibling filtering, current-entity flagging, and alpha sort
  // the imperative version did. Falls back to just the current node until data
  // arrives (matching the old fallbackItems behavior).
  const breadcrumbMenuItems = useMemo(() => {
    if (!openTargetNode) return [];

    const currentOnly = [
      {
        key: openTargetNode.key,
        value: openTargetNode.value,
        path: openTargetNode.path,
        isCurrent: true,
      },
    ];

    if (!siblingEntities) return currentOnly;

    const sameKindCandidates = siblingEntities.items;
    const siblingCandidates =
      typeof openLeftNode?.normalizedRef === 'string'
        ? sameKindCandidates.filter(candidate =>
            (candidate.relations ?? []).some(
              relation =>
                normalizeEntityRef(relation.targetRef) ===
                  openLeftNode.normalizedRef &&
                (openTargetNode.relationType
                  ? relation.type === openTargetNode.relationType
                  : true),
            ),
          )
        : sameKindCandidates;

    const effectiveCandidates =
      siblingCandidates.length > 0 ? siblingCandidates : sameKindCandidates;

    const siblingItems = effectiveCandidates
      .map(candidate => {
        const candidateRef = stringifyEntityRef(candidate);
        return {
          key: `${openTargetNode.kind}-${candidateRef}`,
          value: candidate.metadata.title ?? candidate.metadata.name,
          path: buildCatalogEntityPathFromEntity(candidate),
          isCurrent:
            normalizeEntityRef(candidateRef) === openTargetNode.normalizedRef,
        };
      })
      .sort((a, b) => a.value.localeCompare(b.value));

    return siblingItems.length > 0 ? siblingItems : currentOnly;
  }, [openTargetNode, openLeftNode, siblingEntities]);

  // "Loading" only for the true first fetch (no cached data yet) — a background
  // revalidation of an already-cached list must NOT show the spinner.
  const isBreadcrumbMenuLoading = siblingsLoading;

  const buildKindCatalogPath = useCallback(
    (targetNodeIndex: number): string => {
      const targetNode = breadcrumbNodes[targetNodeIndex];
      if (!targetNode) {
        return '/catalog';
      }

      const params = new URLSearchParams();
      params.append('filters[kind]', targetNode.kind.toLowerCase());

      let hasNamespaceScopedFilter = false;

      for (let i = 0; i < targetNodeIndex; i += 1) {
        const ancestor = breadcrumbNodes[i];
        // Use the raw entity name (not the display value/title) for catalog
        // filter params: the namespace filter matches `metadata.namespace` and
        // the project/component filters match the `openchoreo.io/*` annotation
        // values — all of which are entity names, never display titles.
        const ancestorName = ancestor.name;
        const ancestorKind = ancestor.kind.toLowerCase();

        if (ancestorKind === 'domain') {
          params.set('filters[namespace]', ancestorName);
          hasNamespaceScopedFilter = true;
          continue;
        }

        if (ancestorKind === 'system') {
          params.set('filters[project]', ancestorName);
          continue;
        }

        if (ancestorKind === 'component') {
          params.set('filters[component]', ancestorName);
        }
      }

      if (!hasNamespaceScopedFilter && targetNode.namespace) {
        params.set('filters[namespace]', targetNode.namespace);
      }

      return `/catalog?${params.toString()}`;
    },
    [breadcrumbNodes],
  );

  const openBreadcrumbMenu = (
    event: MouseEvent<HTMLButtonElement>,
    targetNodeIndex: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (breadcrumbMenuAnchor && breadcrumbMenuAnchor !== event.currentTarget) {
      breadcrumbMenuAnchor.classList.remove(
        classes.breadcrumbSeparatorButtonOpen,
      );
    }
    event.currentTarget.classList.add(classes.breadcrumbSeparatorButtonOpen);
    setBreadcrumbMenuAnchor(event.currentTarget);
    setOpenNodeIndex(targetNodeIndex);
  };

  const closeBreadcrumbMenu = () => {
    if (breadcrumbMenuAnchor) {
      breadcrumbMenuAnchor.classList.remove(
        classes.breadcrumbSeparatorButtonOpen,
      );
    }
    setBreadcrumbMenuAnchor(null);
    setOpenNodeIndex(null);
  };

  const navigateFromBreadcrumbMenu = (
    path: string | null,
    isCurrent?: boolean,
  ) => {
    closeBreadcrumbMenu();
    if (path && !isCurrent) {
      navigate(path);
    }
  };

  const openInNewTabFromBreadcrumbMenu = (
    event: MouseEvent<HTMLButtonElement>,
    path: string | null,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!path) return;
    window.open(path, '_blank', 'noopener,noreferrer');
    closeBreadcrumbMenu();
  };

  return (
    <header className={classes.header}>
      <Box className={classes.topRow}>
        <Typography variant="h5" className={classes.title}>
          {loading ? (
            entityName
          ) : (
            <EntityDisplayName entityRef={entity} hideIcon />
          )}
        </Typography>
        <Box component="span" className={classes.favorite}>
          {loading ? (
            <Skeleton variant="circle" width={20} height={20} />
          ) : (
            <FavoriteEntity entity={entity} />
          )}
        </Box>
        <Chip
          label={kindLabel}
          variant="outlined"
          size="small"
          className={`${classes.chip} ${classes.kindChip}`}
        />
        {loading ? (
          <Skeleton
            variant="rect"
            width={72}
            height={24}
            style={{ borderRadius: 12 }}
          />
        ) : (
          entityType && (
            <Chip
              label={entityType}
              variant="outlined"
              size="small"
              className={classes.chip}
            />
          )
        )}
        <Box flexGrow={1} />
        {contextMenu}
      </Box>
      {loading && (
        <MaterialBreadcrumbs separator="" className={classes.breadcrumbs}>
          {Array.from({ length: loadingAncestorCount }).map((_, index) => (
            <Box
              key={`crumb-skeleton-${index}`}
              component="span"
              className={classes.breadcrumbLevelBox}
            >
              <Skeleton variant="text" width={90} height={18} />
            </Box>
          ))}
          {/* Current level: identity is known from the URL, so render it solid. */}
          <Box component="span" className={classes.breadcrumbLevelBox}>
            <Typography
              component="span"
              className={classes.breadcrumbKindDivider}
            >
              {`${toPluralLabel(kindLabel).toLowerCase()} / `}
            </Typography>
            <Typography component="span" className={classes.breadcrumbNameLink}>
              {entityName}
            </Typography>
          </Box>
        </MaterialBreadcrumbs>
      )}
      {!loading && breadcrumbNodes.length > 0 && (
        <MaterialBreadcrumbs separator="" className={classes.breadcrumbs}>
          {breadcrumbNodes.map((node, levelIndex) => {
            const kindCatalogPath = buildKindCatalogPath(levelIndex);
            const levelLabel = toPluralLabel(node.displayType).toLowerCase();
            let nameNode: ReactNode;

            if (node.path) {
              const namePath = node.path;
              nameNode = (
                <a
                  href={namePath}
                  className={classes.breadcrumbNameLink}
                  onClick={event => {
                    // Allow new tab behaviors (middle-click, ctrl/meta+click)
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey
                    ) {
                      return;
                    }
                    event.preventDefault();
                    navigate(namePath);
                  }}
                >
                  {node.value}
                </a>
              );
            } else {
              nameNode = (
                <Typography
                  component="span"
                  className={classes.breadcrumbPlainText}
                >
                  {node.value}
                </Typography>
              );
            }

            return (
              <Box
                key={node.key}
                component="span"
                className={classes.breadcrumbLevelBox}
              >
                <a
                  href={kindCatalogPath}
                  className={classes.breadcrumbKindLink}
                  onClick={event => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey
                    ) {
                      return;
                    }
                    event.preventDefault();
                    navigate(kindCatalogPath);
                  }}
                >
                  {levelLabel}
                </a>
                <Typography
                  component="span"
                  className={classes.breadcrumbKindDivider}
                >
                  {' / '}
                </Typography>
                {nameNode}
                <button
                  type="button"
                  className={`${classes.breadcrumbSeparatorButton} ${classes.breadcrumbSeparatorButtonHover}`}
                  onClick={event => openBreadcrumbMenu(event, levelIndex)}
                  aria-label="Open breadcrumb quick navigation"
                >
                  <ChevronRightIcon
                    aria-hidden="true"
                    className={classes.breadcrumbCaretIcon}
                  />
                </button>
              </Box>
            );
          })}
        </MaterialBreadcrumbs>
      )}
      <Menu
        anchorEl={breadcrumbMenuAnchor}
        keepMounted
        open={Boolean(breadcrumbMenuAnchor)}
        onClose={closeBreadcrumbMenu}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Box
          px={2}
          pt={1.25}
          pb={0.5}
          display="flex"
          alignItems="center"
          style={{ gap: 8 }}
        >
          <Typography className={classes.breadcrumbMenuTitle}>
            {breadcrumbMenuTitle}
          </Typography>
          {/* Quiet inline spinner next to the menu title while an already-cached
              sibling list revalidates in the background — the first load still
              shows the "Loading resources..." item below. role="status" mirrors
              the other cached surfaces so assistive tech announces the refresh. */}
          {siblingsRefetching && (
            <Box
              component="span"
              role="status"
              aria-label={`Refreshing ${breadcrumbMenuTitle.toLowerCase()}`}
              display="inline-flex"
              alignItems="center"
            >
              <Spinner size="chip" aria-hidden="true" />
            </Box>
          )}
        </Box>
        {isBreadcrumbMenuLoading && (
          <MenuItem disabled className={classes.breadcrumbMenuItem}>
            <Typography className={classes.breadcrumbMenuValue}>
              Loading resources...
            </Typography>
          </MenuItem>
        )}
        {!isBreadcrumbMenuLoading &&
          breadcrumbMenuItems.map(item => (
            <MenuItem
              key={item.key}
              className={classes.breadcrumbMenuItem}
              selected={item.isCurrent}
              onClick={() =>
                navigateFromBreadcrumbMenu(item.path, item.isCurrent)
              }
            >
              <Box className={classes.breadcrumbMenuItemContent}>
                <Typography className={classes.breadcrumbMenuValue}>
                  {item.value}
                </Typography>
                {item.path && (
                  <Tooltip title="Open in new tab">
                    <IconButton
                      size="small"
                      className={classes.breadcrumbMenuOpenIconButton}
                      onClick={event =>
                        openInNewTabFromBreadcrumbMenu(event, item.path)
                      }
                      aria-label={`Open ${item.value} in new tab`}
                    >
                      <OpenInNewIcon
                        className={classes.breadcrumbMenuOpenIcon}
                      />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </MenuItem>
          ))}
        {!isBreadcrumbMenuLoading && breadcrumbMenuItems.length === 0 && (
          <MenuItem disabled className={classes.breadcrumbMenuItem}>
            <Typography className={classes.breadcrumbMenuValue}>
              No resources found
            </Typography>
          </MenuItem>
        )}
      </Menu>
    </header>
  );
}
