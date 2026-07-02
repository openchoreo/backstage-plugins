import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Drawer,
  Button,
  Typography,
  Grid,
  Tooltip,
} from '@material-ui/core';
import FilterListIcon from '@material-ui/icons/FilterList';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import WidgetsOutlinedIcon from '@material-ui/icons/WidgetsOutlined';
import StorageOutlinedIcon from '@material-ui/icons/StorageOutlined';
import AccountTreeOutlinedIcon from '@material-ui/icons/AccountTreeOutlined';
import { useRouteRef, useApp } from '@backstage/core-plugin-api';
import { DocsIcon, Page, Header, Content } from '@backstage/core-components';
import {
  EntityListProvider,
  EntityKindPicker,
  useEntityList,
} from '@backstage/plugin-catalog-react';
import {
  ScaffolderPageContextMenu,
  TemplateGroups,
} from '@backstage/plugin-scaffolder-react/alpha';
import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import { buildTechDocsURL } from '@backstage/plugin-techdocs-react';
import {
  TECHDOCS_ANNOTATION,
  TECHDOCS_EXTERNAL_ANNOTATION,
} from '@backstage/plugin-techdocs-common';
import type { TemplateEntityV1beta3 } from '@backstage/plugin-scaffolder-common';
import type { TemplateListPageProps } from '@backstage/plugin-scaffolder/alpha';
import { Link } from 'react-router-dom';
import { usePermission } from '@backstage/plugin-permission-react';
import { catalogEntityCreatePermission } from '@backstage/plugin-catalog-common/alpha';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { Theme } from '@material-ui/core/styles';
import CreateComponentIcon from '@material-ui/icons/AddCircleOutline';
import IconButton from '@material-ui/core/IconButton';
import {
  useProjectPermission,
  useComponentCreatePermission,
  useEnvironmentPermission,
  useNotificationChannelPermission,
  useTraitCreatePermission,
  useComponentTypePermission,
  useClusterTraitCreatePermission,
  useClusterComponentTypePermission,
  useClusterResourceTypePermission,
  useResourceTypePermission,
  useClusterProjectTypePermission,
  useProjectTypePermission,
  useResourceCreatePermission,
  useComponentWorkflowPermission,
  useWorkflowPermission,
  useClusterWorkflowPermission,
  useNamespacePermission,
  useDeploymentPipelinePermission,
  useComponentCreateContextPermissions,
  useResourceCreateContextPermissions,
  type ComponentCreateContextItem,
  type ResourceCreateContextItem,
} from '@openchoreo/backstage-plugin-react';
import { ScaffolderStarredFilter } from './ScaffolderStarredFilter';
import { ScaffolderCategoryPicker } from './ScaffolderCategoryPicker';
import { ScaffolderTagPicker } from './ScaffolderTagPicker';
import { ScaffolderSearchBar } from './ScaffolderSearchBar';
import { ScaffolderNamespacePicker } from './ScaffolderNamespacePicker';
import { CustomTemplateCard } from './CustomTemplateCard';
import { TemplateCardSkeletons } from './TemplateCardSkeleton';
import { useStyles } from './styles';

// 'Project', 'Component' and 'Resource' are all presented as meta-cards on the
// landing view; their per-type templates are listed under
// /create?view=projects|components|resources. None of them appear as real
// application-template cards, so APPLICATION_TYPES is empty.
const APPLICATION_TYPES: string[] = [];
// Order is significant — this list controls the on-screen order of the
// Platform Resources cards (see platformTemplates sort below). Foundation-
// first to mirror Application Resources (Project → Component → Resource),
// then template types grouped by concept (workload shape → cross-cutting
// concerns → infra deps → automation), with cluster-scoped before
// namespace-scoped within each pair so pairs stay adjacent.
const PLATFORM_TYPES = [
  'Namespace',
  'Environment',
  'ObservabilityAlertsNotificationChannel',
  'DeploymentPipeline',
  'ClusterProjectType',
  'ProjectType',
  'ClusterComponentType',
  'ComponentType',
  'ClusterTrait',
  'Trait',
  'ClusterResourceType',
  'ResourceType',
  'ClusterWorkflow',
  'Workflow',
];
// 'Project'/'Component'/'Resource' are in KNOWN_CARD_TYPES but NOT in
// APPLICATION_TYPES — their per-type templates are rendered under the
// respective ?view= pages, not in the landing grid or the "Other Templates"
// catch-all.
const KNOWN_CARD_TYPES = [
  ...APPLICATION_TYPES,
  'Project',
  'Component',
  'Resource',
  ...PLATFORM_TYPES,
];

const RegisterExistingButton = ({ to }: { to: string | undefined }) => {
  const { allowed } = usePermission({
    permission: catalogEntityCreatePermission,
  });
  const isXSScreen = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down('xs'),
  );

  if (!to || !allowed) return null;

  return isXSScreen ? (
    <IconButton
      component={Link}
      color="primary"
      title="Import to Catalog"
      size="small"
      to={to}
    >
      <CreateComponentIcon />
    </IconButton>
  ) : (
    <Button component={Link} variant="outlined" color="primary" to={to}>
      Import to Catalog
    </Button>
  );
};

/** Inner component that has access to EntityListProvider context */
const TemplateListContent = (props: TemplateListPageProps) => {
  const classes = useStyles();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const isComponentsView = searchParams.get('view') === 'components';
  const isResourcesView = searchParams.get('view') === 'resources';
  const isProjectsView = searchParams.get('view') === 'projects';

  const { templateFilter, headerOptions } = props;

  const navigate = useNavigate();
  const editorLink = useRouteRef(scaffolderPlugin.routes.edit);
  const actionsLink = useRouteRef(scaffolderPlugin.routes.actions);
  const tasksLink = useRouteRef(scaffolderPlugin.routes.listTasks);
  const viewTechDocsLink = useRouteRef(
    scaffolderPlugin.externalRoutes.viewTechDoc,
  );
  const templateRoute = useRouteRef(scaffolderPlugin.routes.selectedTemplate);
  const templatingExtensionsLink = useRouteRef(
    scaffolderPlugin.routes.templatingExtensions,
  );
  const registerComponentLink = useRouteRef(
    scaffolderPlugin.externalRoutes.registerComponent,
  );
  const app = useApp();

  // Entity-specific permission hooks
  const projectPerm = useProjectPermission();
  const componentPerm = useComponentCreatePermission();
  const environmentPerm = useEnvironmentPermission();
  const notificationChannelPerm = useNotificationChannelPermission();
  const traitPerm = useTraitCreatePermission();
  const componentTypePerm = useComponentTypePermission();
  const clusterTraitPerm = useClusterTraitCreatePermission();
  const clusterComponentTypePerm = useClusterComponentTypePermission();
  const clusterResourceTypePerm = useClusterResourceTypePermission();
  const resourceTypePerm = useResourceTypePermission();
  const clusterProjectTypePerm = useClusterProjectTypePermission();
  const projectTypePerm = useProjectTypePermission();
  const resourcePerm = useResourceCreatePermission();
  const componentWorkflowPerm = useComponentWorkflowPermission();
  const workflowPerm = useWorkflowPermission();
  const clusterWorkflowPerm = useClusterWorkflowPermission();
  const namespacePerm = useNamespacePermission();
  const deploymentPipelinePerm = useDeploymentPipelinePermission();

  // Map template spec.type to whether the card should be disabled
  const isTemplateDisabled = useCallback(
    (specType: string): boolean => {
      switch (specType) {
        case 'Project':
          return !projectPerm.loading && !projectPerm.canCreate;
        case 'Component':
          return !componentPerm.loading && !componentPerm.canCreate;
        case 'Environment':
          return !environmentPerm.loading && !environmentPerm.canCreate;
        case 'ObservabilityAlertsNotificationChannel':
          return (
            !notificationChannelPerm.loading &&
            !notificationChannelPerm.canCreate
          );
        case 'Trait':
          return !traitPerm.loading && !traitPerm.canCreate;
        case 'ClusterTrait':
          return !clusterTraitPerm.loading && !clusterTraitPerm.canCreate;
        case 'ComponentType':
          return !componentTypePerm.loading && !componentTypePerm.canCreate;
        case 'ClusterComponentType':
          return (
            !clusterComponentTypePerm.loading &&
            !clusterComponentTypePerm.canCreate
          );
        case 'ClusterResourceType':
          return (
            !clusterResourceTypePerm.loading &&
            !clusterResourceTypePerm.canCreate
          );
        case 'ResourceType':
          return !resourceTypePerm.loading && !resourceTypePerm.canCreate;
        case 'ClusterProjectType':
          return (
            !clusterProjectTypePerm.loading && !clusterProjectTypePerm.canCreate
          );
        case 'ProjectType':
          return !projectTypePerm.loading && !projectTypePerm.canCreate;
        case 'Resource':
          return !resourcePerm.loading && !resourcePerm.canCreate;
        case 'ComponentWorkflow':
          return (
            !componentWorkflowPerm.loading && !componentWorkflowPerm.canCreate
          );
        case 'Workflow':
          return !workflowPerm.loading && !workflowPerm.canCreate;
        case 'ClusterWorkflow':
          return !clusterWorkflowPerm.loading && !clusterWorkflowPerm.canCreate;
        case 'Namespace':
          return !namespacePerm.loading && !namespacePerm.canCreate;
        case 'DeploymentPipeline':
          return (
            !deploymentPipelinePerm.loading && !deploymentPipelinePerm.canCreate
          );
        default:
          return false;
      }
    },
    [
      projectPerm,
      componentPerm,
      environmentPerm,
      notificationChannelPerm,
      traitPerm,
      clusterTraitPerm,
      componentTypePerm,
      clusterComponentTypePerm,
      clusterResourceTypePerm,
      resourceTypePerm,
      clusterProjectTypePerm,
      projectTypePerm,
      resourcePerm,
      componentWorkflowPerm,
      workflowPerm,
      clusterWorkflowPerm,
      namespacePerm,
      deploymentPipelinePerm,
    ],
  );

  // Get all template entities from the catalog (filtered by search/category/tag/starred)
  const { entities, loading, filters } = useEntityList();
  const templates = entities as TemplateEntityV1beta3[];

  const applicationTemplates = useMemo(
    () => templates.filter(t => APPLICATION_TYPES.includes(t.spec?.type)),
    [templates],
  );
  const platformTemplates = useMemo(
    () =>
      templates
        .filter(t => PLATFORM_TYPES.includes(t.spec?.type))
        .sort(
          (a, b) =>
            PLATFORM_TYPES.indexOf(a.spec?.type) -
            PLATFORM_TYPES.indexOf(b.spec?.type),
        ),
    [templates],
  );
  const otherTemplates = useMemo(
    () => templates.filter(t => !KNOWN_CARD_TYPES.includes(t.spec?.type)),
    [templates],
  );

  const componentGroups = [
    {
      title: 'Component Templates',
      filter: (e: any) => e.spec?.type === 'Component',
    },
  ];

  // Per-tile componentType gate for the Component templates view.
  const projectParam = searchParams.get('project') ?? undefined;
  const namespaceParam =
    searchParams.get('namespace') ??
    // Pick the first selected namespace facet if exactly one is active.
    (filters.namespace?.values?.length === 1
      ? filters.namespace.values[0]
      : undefined);

  const componentTemplates = useMemo(
    () => templates.filter(t => t.spec?.type === 'Component'),
    [templates],
  );

  const componentTypeItems = useMemo<ComponentCreateContextItem[]>(() => {
    const items: ComponentCreateContextItem[] = [];
    for (const t of componentTemplates) {
      const ctdName = t.metadata.annotations?.[CHOREO_ANNOTATIONS.CTD_NAME];
      if (!ctdName) continue;
      const ctdKind = t.metadata.annotations?.[CHOREO_ANNOTATIONS.CTD_KIND];
      items.push({
        key: stringifyEntityRef(t as any),
        componentType: {
          name: ctdName,
          ...(ctdKind ? { kind: ctdKind } : {}),
        },
      });
    }
    return items;
  }, [componentTemplates]);

  const { decisions: componentTypeDecisions } =
    useComponentCreateContextPermissions({
      items: componentTypeItems,
      namespace: namespaceParam,
      project: projectParam,
    });

  const componentTypeContextActive = Boolean(namespaceParam && projectParam);

  const getTemplateCardState = useCallback(
    (
      template: TemplateEntityV1beta3,
    ): { disabled: boolean; reason?: string } => {
      // Without a concrete (namespace, project), the per-componentType call
      // hasn't fired — keep today's boolean (Phase-1 soft-allow) so we don't
      // hide tiles the user might be allowed in a different scope.
      if (!componentTypeContextActive) {
        return { disabled: isTemplateDisabled('Component') };
      }
      const key = stringifyEntityRef(template as any);
      const decision = componentTypeDecisions[key];
      if (!decision || decision.loading) {
        return { disabled: false };
      }
      if (decision.allowed) return { disabled: false };
      const ctdName =
        template.metadata.annotations?.[CHOREO_ANNOTATIONS.CTD_NAME] ?? 'this';
      return {
        disabled: true,
        reason: `You do not have permission to create a '${ctdName}' component.`,
      };
    },
    [componentTypeContextActive, componentTypeDecisions, isTemplateDisabled],
  );

  // Resource Templates view shows the per-type wizards generated by
  // RtdToTemplateConverter from (Cluster)ResourceType entities. The
  // RTD_GENERATED annotation distinguishes them from any standalone
  // hand-written Resource template.
  const resourceGroups = [
    {
      title: 'Resource Templates',
      filter: (e: any) =>
        e.spec?.type === 'Resource' &&
        e.metadata?.annotations?.[CHOREO_ANNOTATIONS.RTD_GENERATED] === 'true',
    },
  ];

  // Project Templates view shows the per-type wizards generated by
  // PtdToTemplateConverter from (Cluster)ProjectType entities. The
  // PTD_GENERATED annotation distinguishes them from any standalone
  // hand-written Project template.
  const projectGroups = [
    {
      title: 'Project Templates',
      filter: (e: any) =>
        e.spec?.type === 'Project' &&
        e.metadata?.annotations?.[CHOREO_ANNOTATIONS.PTD_GENERATED] === 'true',
    },
  ];

  const resourceTemplates = useMemo(
    () =>
      templates.filter(
        t =>
          t.spec?.type === 'Resource' &&
          t.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_GENERATED] === 'true',
      ),
    [templates],
  );

  const resourceTypeItems = useMemo<ResourceCreateContextItem[]>(() => {
    const items: ResourceCreateContextItem[] = [];
    for (const t of resourceTemplates) {
      const rtdName = t.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_NAME];
      if (!rtdName) continue;
      const rtdKind = t.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_KIND];
      items.push({
        key: stringifyEntityRef(t as any),
        resourceType: {
          name: rtdName,
          ...(rtdKind ? { kind: rtdKind } : {}),
        },
      });
    }
    return items;
  }, [resourceTemplates]);

  const { decisions: resourceTypeDecisions } =
    useResourceCreateContextPermissions({
      items: resourceTypeItems,
      namespace: namespaceParam,
      project: projectParam,
    });

  const resourceTypeContextActive = Boolean(namespaceParam && projectParam);

  const getResourceTemplateCardState = useCallback(
    (
      template: TemplateEntityV1beta3,
    ): { disabled: boolean; reason?: string } => {
      // Without a concrete (namespace, project), the per-resourceType call
      // hasn't fired — keep today's boolean (soft-allow).
      if (!resourceTypeContextActive) {
        return { disabled: isTemplateDisabled('Resource') };
      }
      const key = stringifyEntityRef(template as any);
      const decision = resourceTypeDecisions[key];
      if (!decision || decision.loading) {
        return {
          disabled: true,
          reason: 'Checking your permissions to create this resource…',
        };
      }
      if (decision.allowed) return { disabled: false };
      const rtdName =
        template.metadata.annotations?.[CHOREO_ANNOTATIONS.RTD_NAME] ?? 'this';
      return {
        disabled: true,
        reason: `You do not have permission to create a '${rtdName}' resource.`,
      };
    },
    [resourceTypeContextActive, resourceTypeDecisions, isTemplateDisabled],
  );

  const scaffolderPageContextMenuProps = {
    onEditorClicked:
      props?.contextMenu?.editor !== false
        ? () => navigate(editorLink())
        : undefined,
    onActionsClicked:
      props?.contextMenu?.actions !== false
        ? () => navigate(actionsLink())
        : undefined,
    onTasksClicked:
      props?.contextMenu?.tasks !== false
        ? () => navigate(tasksLink())
        : undefined,
    onTemplatingExtensionsClicked:
      props?.contextMenu?.templatingExtensions !== false
        ? () => navigate(templatingExtensionsLink())
        : undefined,
  };

  const additionalLinksForEntity = useCallback(
    (template: any) => {
      if (
        !(
          template.metadata.annotations?.[TECHDOCS_ANNOTATION] ||
          template.metadata.annotations?.[TECHDOCS_EXTERNAL_ANNOTATION]
        ) ||
        !viewTechDocsLink
      ) {
        return [];
      }
      const url = buildTechDocsURL(template, viewTechDocsLink);
      return url
        ? [
            {
              icon: app.getSystemIcon('docs') ?? DocsIcon,
              text: 'View TechDocs',
              url,
            },
          ]
        : [];
    },
    [app, viewTechDocsLink],
  );

  const onTemplateSelected = useCallback(
    (template: any) => {
      const { namespace, name } = parseEntityRef(stringifyEntityRef(template));
      navigate(templateRoute({ namespace, templateName: name }));
    },
    [navigate, templateRoute],
  );

  const navigateToComponentsView = useCallback(() => {
    setSearchParams({ view: 'components' });
  }, [setSearchParams]);

  const navigateToResourcesView = useCallback(() => {
    setSearchParams({ view: 'resources' });
  }, [setSearchParams]);

  const navigateToProjectsView = useCallback(() => {
    setSearchParams({ view: 'projects' });
  }, [setSearchParams]);

  const navigateBackToLanding = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  const renderTemplateCards = (items: TemplateEntityV1beta3[]) =>
    items.map(template => {
      const isComponentTemplate = template.spec?.type === 'Component';
      const cardState = isComponentTemplate
        ? getTemplateCardState(template)
        : { disabled: isTemplateDisabled(template.spec?.type) };
      return (
        <Grid
          item
          xs={12}
          sm={6}
          md={3}
          key={template.metadata.uid ?? template.metadata.name}
        >
          <CustomTemplateCard
            template={template}
            onSelected={onTemplateSelected}
            disabled={cardState.disabled}
            disabledReason={
              'reason' in cardState ? cardState.reason : undefined
            }
          />
        </Grid>
      );
    });

  const renderFilters = () => (
    <>
      <Box className={classes.filterSection}>
        <Box className={classes.filterRow}>
          <ScaffolderSearchBar />
          <Box className={classes.categoryFilter}>
            {isComponentsView || isResourcesView || isProjectsView ? (
              <ScaffolderNamespacePicker />
            ) : (
              <ScaffolderCategoryPicker />
            )}
          </Box>
          <Box className={classes.tagFilter}>
            <ScaffolderTagPicker />
          </Box>
          <Box className={classes.starredFilter}>
            <ScaffolderStarredFilter />
          </Box>
        </Box>
        <EntityKindPicker initialFilter="template" hidden />
      </Box>
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        className={classes.filterDrawer}
      >
        <Box className={classes.filterDrawerContent}>
          <Box className={classes.filterGrid}>
            <Box className={classes.filterItem}>
              <ScaffolderSearchBar />
            </Box>
            <Box className={classes.filterItem}>
              {isComponentsView || isResourcesView || isProjectsView ? (
                <ScaffolderNamespacePicker />
              ) : (
                <ScaffolderCategoryPicker />
              )}
            </Box>
            <Box className={classes.filterItem}>
              <ScaffolderTagPicker />
            </Box>
            <Box className={classes.filterItem}>
              <ScaffolderStarredFilter />
            </Box>
          </Box>
          <EntityKindPicker initialFilter="template" hidden />
        </Box>
      </Drawer>
    </>
  );

  const renderLandingView = () => {
    const projectDisabled = isTemplateDisabled('Project');
    const projectCard = (
      <Box
        className={`${classes.cardBase} ${classes.resourceCard} ${
          projectDisabled ? classes.cardDisabled : ''
        }`}
        onClick={projectDisabled ? undefined : navigateToProjectsView}
        onKeyDown={
          projectDisabled
            ? undefined
            : e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigateToProjectsView();
                }
              }
        }
        role="button"
        tabIndex={projectDisabled ? -1 : 0}
        aria-disabled={projectDisabled || undefined}
      >
        <Box className={classes.resourceCardIcon}>
          <AccountTreeOutlinedIcon fontSize="inherit" />
        </Box>
        <Typography className={classes.resourceCardTitle}>Project</Typography>
        <Typography className={classes.resourceCardDescription}>
          Browse project templates
        </Typography>
      </Box>
    );

    const componentDisabled = isTemplateDisabled('Component');
    const componentCard = (
      <Box
        className={`${classes.cardBase} ${classes.resourceCard} ${
          componentDisabled ? classes.cardDisabled : ''
        }`}
        onClick={componentDisabled ? undefined : navigateToComponentsView}
        onKeyDown={
          componentDisabled
            ? undefined
            : e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigateToComponentsView();
                }
              }
        }
        role="button"
        tabIndex={componentDisabled ? -1 : 0}
        aria-disabled={componentDisabled || undefined}
      >
        <Box className={classes.resourceCardIcon}>
          <WidgetsOutlinedIcon fontSize="inherit" />
        </Box>
        <Typography className={classes.resourceCardTitle}>Component</Typography>
        <Typography className={classes.resourceCardDescription}>
          Browse component templates
        </Typography>
      </Box>
    );

    const resourceDisabled = isTemplateDisabled('Resource');
    const resourceCard = (
      <Box
        className={`${classes.cardBase} ${classes.resourceCard} ${
          resourceDisabled ? classes.cardDisabled : ''
        }`}
        onClick={resourceDisabled ? undefined : navigateToResourcesView}
        onKeyDown={
          resourceDisabled
            ? undefined
            : e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigateToResourcesView();
                }
              }
        }
        role="button"
        tabIndex={resourceDisabled ? -1 : 0}
        aria-disabled={resourceDisabled || undefined}
      >
        <Box className={classes.resourceCardIcon}>
          <StorageOutlinedIcon fontSize="inherit" />
        </Box>
        <Typography className={classes.resourceCardTitle}>Resource</Typography>
        <Typography className={classes.resourceCardDescription}>
          Browse resource templates
        </Typography>
      </Box>
    );

    return (
      <>
        <Typography
          className={`${classes.sectionTitle} ${classes.sectionTitleFirst}`}
        >
          Create an OpenChoreo Resource
        </Typography>

        {/* Application Resources */}
        <Typography className={classes.sectionSubtitle}>
          Application Resources
        </Typography>
        <Grid container spacing={3}>
          {loading ? (
            <TemplateCardSkeletons count={2} />
          ) : (
            renderTemplateCards(applicationTemplates)
          )}
          {/* Project — navigation card, opens the per-type templates list */}
          <Grid item xs={12} sm={6} md={3}>
            {projectDisabled ? (
              <Tooltip title={projectPerm.createDeniedTooltip}>
                <Box className={classes.cardDisabledWrapper}>{projectCard}</Box>
              </Tooltip>
            ) : (
              projectCard
            )}
          </Grid>
          {/* Component — navigation card, no single backing template */}
          <Grid item xs={12} sm={6} md={3}>
            {componentDisabled ? (
              <Tooltip title={componentPerm.createDeniedTooltip}>
                <Box className={classes.cardDisabledWrapper}>
                  {componentCard}
                </Box>
              </Tooltip>
            ) : (
              componentCard
            )}
          </Grid>
          {/* Resource — navigation card, opens the per-type templates list */}
          <Grid item xs={12} sm={6} md={3}>
            {resourceDisabled ? (
              <Tooltip title={resourcePerm.createDeniedTooltip}>
                <Box className={classes.cardDisabledWrapper}>
                  {resourceCard}
                </Box>
              </Tooltip>
            ) : (
              resourceCard
            )}
          </Grid>
        </Grid>

        {/* Platform Resources */}
        {(loading || platformTemplates.length > 0) && (
          <>
            <Typography className={classes.sectionSubtitle}>
              Platform Resources
            </Typography>
            <Grid container spacing={3}>
              {loading ? (
                <TemplateCardSkeletons count={3} />
              ) : (
                renderTemplateCards(platformTemplates)
              )}
            </Grid>
          </>
        )}

        {/* Other Templates */}
        {otherTemplates.length > 0 && (
          <>
            <Typography className={classes.sectionTitle}>
              Other Templates
            </Typography>
            <Grid container spacing={3}>
              {renderTemplateCards(otherTemplates)}
            </Grid>
          </>
        )}
      </>
    );
  };

  const ComponentTemplateCard = useMemo(() => {
    const Card = (cardProps: {
      template: TemplateEntityV1beta3;
      onSelected?: (template: TemplateEntityV1beta3) => void;
    }) => {
      const cardState = getTemplateCardState(cardProps.template);
      return (
        <CustomTemplateCard
          {...cardProps}
          disabled={cardState.disabled}
          disabledReason={cardState.reason}
        />
      );
    };
    Card.displayName = 'ComponentTemplateCard';
    return Card;
  }, [getTemplateCardState]);

  const ResourceTemplateCard = useMemo(() => {
    const Card = (cardProps: {
      template: TemplateEntityV1beta3;
      onSelected?: (template: TemplateEntityV1beta3) => void;
    }) => {
      const cardState = getResourceTemplateCardState(cardProps.template);
      return (
        <CustomTemplateCard
          {...cardProps}
          disabled={cardState.disabled}
          disabledReason={cardState.reason}
        />
      );
    };
    Card.displayName = 'ResourceTemplateCard';
    return Card;
  }, [getResourceTemplateCardState]);

  // Project create permission is namespace-scoped and generic (there is no
  // per-projectType create permission), so the card is gated by the single
  // project:create decision rather than a per-type context check.
  const ProjectTemplateCard = useMemo(() => {
    const projectDisabled = !projectPerm.loading && !projectPerm.canCreate;
    const Card = (cardProps: {
      template: TemplateEntityV1beta3;
      onSelected?: (template: TemplateEntityV1beta3) => void;
    }) => (
      <CustomTemplateCard
        {...cardProps}
        disabled={projectDisabled}
        disabledReason={
          projectDisabled ? projectPerm.createDeniedTooltip : undefined
        }
      />
    );
    Card.displayName = 'ProjectTemplateCard';
    return Card;
  }, [projectPerm]);

  const renderComponentsView = () => (
    <>
      <Box
        component="button"
        className={classes.backButton}
        onClick={navigateBackToLanding}
      >
        <ArrowBackIcon fontSize="small" />
        Back to Resources
      </Box>
      <Box className={classes.contentArea}>
        <TemplateGroups
          groups={componentGroups}
          templateFilter={templateFilter}
          TemplateCardComponent={ComponentTemplateCard}
          onTemplateSelected={onTemplateSelected}
          additionalLinksForEntity={additionalLinksForEntity}
        />
      </Box>
    </>
  );

  const renderResourcesView = () => (
    <>
      <Box
        component="button"
        className={classes.backButton}
        onClick={navigateBackToLanding}
      >
        <ArrowBackIcon fontSize="small" />
        Back to Resources
      </Box>
      <Box className={classes.contentArea}>
        <TemplateGroups
          groups={resourceGroups}
          templateFilter={templateFilter}
          TemplateCardComponent={ResourceTemplateCard}
          onTemplateSelected={onTemplateSelected}
          additionalLinksForEntity={additionalLinksForEntity}
        />
      </Box>
    </>
  );

  const renderProjectsView = () => (
    <>
      <Box
        component="button"
        className={classes.backButton}
        onClick={navigateBackToLanding}
      >
        <ArrowBackIcon fontSize="small" />
        Back to Resources
      </Box>
      <Box className={classes.contentArea}>
        <TemplateGroups
          groups={projectGroups}
          templateFilter={templateFilter}
          TemplateCardComponent={ProjectTemplateCard}
          onTemplateSelected={onTemplateSelected}
          additionalLinksForEntity={additionalLinksForEntity}
        />
      </Box>
    </>
  );

  return (
    <Page themeId="home">
      <Header
        title={headerOptions?.title ?? 'Create a new component'}
        subtitle={
          headerOptions?.subtitle ??
          'Create new software components using standard templates in your organization'
        }
      >
        <ScaffolderPageContextMenu {...scaffolderPageContextMenuProps} />
      </Header>
      <Content>
        <Box className={classes.root}>
          <Box className={classes.header}>
            <Box display="flex" justifyContent="flex-start">
              <Box
                className={classes.filterButton}
                component="button"
                onClick={() => setDrawerOpen(true)}
                style={{ gap: '8px' }}
              >
                <FilterListIcon fontSize="small" />
                <span className={classes.filterButtonText}>Filters</span>
              </Box>
            </Box>
            <RegisterExistingButton
              to={registerComponentLink && registerComponentLink()}
            />
          </Box>

          {renderFilters()}

          {(() => {
            if (isComponentsView) return renderComponentsView();
            if (isResourcesView) return renderResourcesView();
            if (isProjectsView) return renderProjectsView();
            return renderLandingView();
          })()}
        </Box>
      </Content>
    </Page>
  );
};

/** Outer wrapper that provides EntityListProvider context */
export const CustomTemplateListPage = (props: TemplateListPageProps) => (
  <EntityListProvider>
    <TemplateListContent {...props} />
  </EntityListProvider>
);
