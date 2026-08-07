import { Content, Page, Header } from '@backstage/core-components';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { SearchContextProvider } from '@backstage/plugin-search-react';
import { Grid, Typography, Box } from '@material-ui/core';
import { useStyles } from './styles';
import { useUserInfo } from '../../hooks';
import {
  HOME_CARD_REGISTRY,
  getHomeCardConfig,
  DEFAULT_HOME_CARD_CONFIG,
  HomeCardPlacement,
} from './cards';

const useAlwaysVisible = () => true;

/**
 * Renders one card slot from the active layout config. Visibility hooks
 * (e.g. permission gates) run here so a hidden card contributes no grid
 * slot at all.
 */
const HomeCardSlot = ({ placement }: { placement: HomeCardPlacement }) => {
  const classes = useStyles();
  const definition = HOME_CARD_REGISTRY[placement.cardId];
  const useVisibility = definition?.useVisibility ?? useAlwaysVisible;
  const visible = useVisibility();

  if (!definition || !visible) {
    return null;
  }

  const CardComponent = definition.component;
  return (
    <Grid
      item
      xs={placement.size.xs ?? 12}
      md={placement.size.md}
      style={{ display: 'flex' }}
    >
      <Box className={classes.cardWrapper}>
        <CardComponent />
      </Box>
    </Grid>
  );
};

/**
 * Custom HomePage composed of predefined cards. The set and order of
 * cards comes from a named layout config (`openchoreo.home.cardConfig`,
 * default `choreo-default`), so operators can switch layouts via
 * app-config and the upcoming Backstage card-picker can build on the
 * same registry.
 */
export const HomePage = () => {
  const { userName, loading } = useUserInfo();
  const configApi = useApi(configApiRef);
  const configName =
    configApi.getOptionalString('openchoreo.home.cardConfig') ??
    DEFAULT_HOME_CARD_CONFIG;
  const cardConfig = getHomeCardConfig(configName);

  if (loading) {
    return (
      <Page themeId="home">
        <Header title="Loading..." />
        <Content>
          <Typography>Loading user information...</Typography>
        </Content>
      </Page>
    );
  }

  return (
    <SearchContextProvider>
      <Page themeId="home">
        <Header title={`Welcome, ${userName}!`} />
        <Content>
          <Grid container spacing={3} alignItems="stretch">
            {cardConfig.cards.map(placement => (
              <HomeCardSlot key={placement.cardId} placement={placement} />
            ))}
          </Grid>
        </Content>
      </Page>
    </SearchContextProvider>
  );
};
