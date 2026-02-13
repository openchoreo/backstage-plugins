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
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { Theme } from '@material-ui/core/styles';
import CreateComponentIcon from '@material-ui/icons/AddCircleOutline';
import IconButton from '@material-ui/core/IconButton';
import { ScaffolderStarredFilter } from './ScaffolderStarredFilter';
import { ScaffolderCategoryPicker } from './ScaffolderCategoryPicker';
import { ScaffolderTagPicker } from './ScaffolderTagPicker';
import { ScaffolderSearchBar } from './ScaffolderSearchBar';
import { CustomTemplateCard } from './CustomTemplateCard';
import { useScaffolderPermissions } from './useScaffolderPermissions';
import { useStyles } from './styles';

const APPLICATION_TYPES = ['System (Project)'];
const PLATFORM_TYPES = [
  'Namespace',
  'Environment',
  'Trait',
  'ComponentType',
  'ComponentWorkflow',
];
const KNOWN_CARD_TYPES = [...APPLICATION_TYPES, 'Component', ...PLATFORM_TYPES];

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
  const permissions = useScaffolderPermissions();

  // Get all template entities from the catalog (filtered by search/category/tag/starred)
  const { entities } = useEntityList();
  const templates = entities as TemplateEntityV1beta3[];

  const applicationTemplates = useMemo(
    () => templates.filter(t => APPLICATION_TYPES.includes(t.spec?.type)),
    [templates],
  );
  const platformTemplates = useMemo(
    () => templates.filter(t => PLATFORM_TYPES.includes(t.spec?.type)),
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

  const navigateBackToLanding = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  const renderTemplateCards = (items: TemplateEntityV1beta3[]) =>
    items.map(template => {
      const perm = permissions[template.spec?.type];
      const disabled = perm ? !perm.loading && !perm.allowed : false;
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
            disabled={disabled}
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
            <ScaffolderCategoryPicker />
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
              <ScaffolderCategoryPicker />
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

  const renderLandingView = () => (
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
        {renderTemplateCards(applicationTemplates)}
        {/* Component — navigation card, no single backing template */}
        <Grid item xs={12} sm={6} md={3}>
          {(() => {
            const componentPerm = permissions.Component;
            const componentDisabled =
              componentPerm && !componentPerm.loading && !componentPerm.allowed;
            const card = (
              <Box
                className={`${classes.cardBase} ${classes.resourceCard} ${
                  componentDisabled ? classes.cardDisabled : ''
                }`}
                onClick={
                  componentDisabled ? undefined : navigateToComponentsView
                }
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
                <Typography className={classes.resourceCardTitle}>
                  Component
                </Typography>
                <Typography className={classes.resourceCardDescription}>
                  Browse component templates
                </Typography>
              </Box>
            );
            return componentDisabled ? (
              <Tooltip title="You do not have permission to create this resource">
                <Box className={classes.cardDisabledWrapper}>{card}</Box>
              </Tooltip>
            ) : (
              card
            );
          })()}
        </Grid>
      </Grid>

      {/* Platform Resources */}
      {platformTemplates.length > 0 && (
        <>
          <Typography className={classes.sectionSubtitle}>
            Platform Resources
          </Typography>
          <Grid container spacing={3}>
            {renderTemplateCards(platformTemplates)}
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

  const ComponentTemplateCard = useMemo(() => {
    const componentPerm = permissions.Component;
    const disabled =
      componentPerm && !componentPerm.loading && !componentPerm.allowed;
    const Card = (cardProps: {
      template: TemplateEntityV1beta3;
      onSelected?: (template: TemplateEntityV1beta3) => void;
    }) => <CustomTemplateCard {...cardProps} disabled={disabled} />;
    Card.displayName = 'ComponentTemplateCard';
    return Card;
  }, [permissions]);

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

          {isComponentsView ? renderComponentsView() : renderLandingView()}
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
