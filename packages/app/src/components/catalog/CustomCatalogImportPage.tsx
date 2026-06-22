import { useNavigate } from 'react-router-dom';
import {
  Content,
  ContentHeader,
  Header,
  Page,
  SupportButton,
} from '@backstage/core-components';
import {
  useApi,
  configApiRef,
  createRoutableExtension,
} from '@backstage/core-plugin-api';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import {
  ImportInfoCard,
  ImportStepper,
  catalogImportPlugin,
} from '@backstage/plugin-catalog-import';
import { catalogImportTranslationRef } from '@backstage/plugin-catalog-import/alpha';
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';

const useStyles = makeStyles({
  title: {
    display: 'flex',
    alignItems: 'center',
  },
  backButton: {
    color: 'inherit',
    marginRight: 8,
    marginLeft: -12,
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
  },
});

const CustomCatalogImportPageContent = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const theme = useTheme();
  const configApi = useApi(configApiRef);
  const { t } = useTranslationRef(catalogImportTranslationRef);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const appTitle = configApi.getOptionalString('app.title') || 'Backstage';
  const headerTitle = t('defaultImportPage.headerTitle');

  const contentItems = [
    <Grid item xs={12} md={4} lg={6} xl={8} key={0}>
      <ImportInfoCard />
    </Grid>,
    <Grid item xs={12} md={8} lg={6} xl={4} key={1}>
      <ImportStepper />
    </Grid>,
  ];

  return (
    <Page themeId="home">
      <Header
        title={
          <Box className={classes.title}>
            <IconButton
              className={classes.backButton}
              size="small"
              onClick={() => navigate(-1)}
              aria-label="Back"
              title="Back"
            >
              <ArrowBackIcon />
            </IconButton>
            {headerTitle}
          </Box>
        }
        pageTitleOverride={headerTitle}
      />
      <Content>
        <ContentHeader
          title={t('defaultImportPage.contentHeaderTitle', { appTitle })}
        >
          <SupportButton>
            {t('defaultImportPage.supportTitle', { appTitle })}
          </SupportButton>
        </ContentHeader>
        <Grid container spacing={2}>
          {isMobile ? contentItems : contentItems.reverse()}
        </Grid>
      </Content>
    </Page>
  );
};

// Routable extension on the catalog-import plugin so the `importPage` routeRef
// keeps its path for useRouteRef consumers and bound external routes.
export const CustomCatalogImportPage = catalogImportPlugin.provide(
  createRoutableExtension({
    name: 'CustomCatalogImportPage',
    component: () => Promise.resolve(CustomCatalogImportPageContent),
    mountPoint: catalogImportPlugin.routes.importPage,
  }),
);
