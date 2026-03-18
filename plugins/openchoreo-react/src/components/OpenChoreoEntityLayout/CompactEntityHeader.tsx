import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import useAsync from 'react-use/esm/useAsync';
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
// BackstageHeader (backgroundImage, boxShadow, minHeight, etc.) are
// automatically merged into the matching class keys by MUI's style system.
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
        color: '#f3ba37',
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
      color: theme.palette.grey[200],
      textDecoration: 'none',
      textTransform: 'lowercase',
      padding: 0,
      borderRadius: 0,
      whiteSpace: 'nowrap',
      overflowWrap: 'normal',
      '&:hover': {
        color: theme.page.fontColor,
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
  } = props;
  const classes = useStyles();
  const navigate = useNavigate();
  const catalogApi = useApi(catalogApiRef);
  const [breadcrumbMenuAnchor, setBreadcrumbMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [breadcrumbMenuItems, setBreadcrumbMenuItems] = useState<
    Array<{
      key: string;
      value: string;
      path: string | null;
      isCurrent?: boolean;
    }>
  >([]);
  const [breadcrumbMenuTitle, setBreadcrumbMenuTitle] = useState('Resources');
  const [isBreadcrumbMenuLoading, setIsBreadcrumbMenuLoading] = useState(false);
  const breadcrumbMenuRequestIdRef = useRef(0);

  const kindLabel = kindDisplayNames?.[kind.toLowerCase()] ?? kind;

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

  const loadBreadcrumbLevelItems = useCallback(
    async (targetNodeIndex: number, requestId: number) => {
      const isCurrentRequest = () =>
        breadcrumbMenuRequestIdRef.current === requestId;
      const leftNode = breadcrumbNodes[targetNodeIndex - 1];
      const targetNode = breadcrumbNodes[targetNodeIndex];
      const fallbackItems = targetNode
        ? [
            {
              key: targetNode.key,
              value: targetNode.value,
              path: targetNode.path,
              isCurrent: true,
            },
          ]
        : [];

      if (!isCurrentRequest()) {
        return;
      }
      setIsBreadcrumbMenuLoading(true);
      setBreadcrumbMenuItems(fallbackItems);
      setBreadcrumbMenuTitle(getMenuTitleForNodeIndex(targetNodeIndex));

      if (!targetNode) {
        if (isCurrentRequest()) {
          setIsBreadcrumbMenuLoading(false);
        }
        return;
      }

      try {
        const response = await catalogApi.getEntities({
          filter: [
            {
              kind: targetNode.kind,
              'metadata.namespace': targetNode.namespace,
            },
          ],
        });
        if (!isCurrentRequest()) {
          return;
        }

        const sameKindCandidates = response.items;
        const siblingCandidates =
          typeof leftNode?.normalizedRef === 'string'
            ? sameKindCandidates.filter(candidate =>
                (candidate.relations ?? []).some(
                  relation =>
                    normalizeEntityRef(relation.targetRef) ===
                      leftNode.normalizedRef &&
                    (targetNode.relationType
                      ? relation.type === targetNode.relationType
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
              key: `${targetNode.kind}-${candidateRef}`,
              value: candidate.metadata.title ?? candidate.metadata.name,
              path: buildCatalogEntityPathFromEntity(candidate),
              isCurrent:
                normalizeEntityRef(candidateRef) === targetNode.normalizedRef,
            };
          })
          .sort((a, b) => a.value.localeCompare(b.value));

        setBreadcrumbMenuItems(siblingItems);
      } catch {
        if (isCurrentRequest()) {
          setBreadcrumbMenuItems(fallbackItems);
        }
      } finally {
        if (isCurrentRequest()) {
          setIsBreadcrumbMenuLoading(false);
        }
      }
    },
    [breadcrumbNodes, getMenuTitleForNodeIndex, catalogApi],
  );

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
        const ancestorName = ancestor.value;
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
    const requestId = breadcrumbMenuRequestIdRef.current + 1;
    breadcrumbMenuRequestIdRef.current = requestId;
    setBreadcrumbMenuAnchor(event.currentTarget);
    setBreadcrumbMenuTitle(getMenuTitleForNodeIndex(targetNodeIndex));
    void loadBreadcrumbLevelItems(targetNodeIndex, requestId);
  };

  const closeBreadcrumbMenu = () => {
    breadcrumbMenuRequestIdRef.current += 1;
    if (breadcrumbMenuAnchor) {
      breadcrumbMenuAnchor.classList.remove(
        classes.breadcrumbSeparatorButtonOpen,
      );
    }
    setBreadcrumbMenuAnchor(null);
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
          <EntityDisplayName entityRef={entity} hideIcon />
        </Typography>
        <Box component="span" className={classes.favorite}>
          <FavoriteEntity entity={entity} />
        </Box>
        <Chip
          label={kindLabel}
          variant="outlined"
          size="small"
          className={`${classes.chip} ${classes.kindChip}`}
        />
        {entityType && (
          <Chip
            label={entityType}
            variant="outlined"
            size="small"
            className={classes.chip}
          />
        )}
        <Box flexGrow={1} />
        {contextMenu}
      </Box>
      {breadcrumbNodes.length > 0 && (
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
        <Box px={2} pt={1.25} pb={0.5}>
          <Typography className={classes.breadcrumbMenuTitle}>
            {breadcrumbMenuTitle}
          </Typography>
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
