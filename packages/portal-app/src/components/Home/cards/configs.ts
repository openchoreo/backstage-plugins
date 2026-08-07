import { HomeCardConfig } from './types';

export const DEFAULT_HOME_CARD_CONFIG = 'choreo-default';

/**
 * The default OpenChoreo home page layout. Cards render in order; rows
 * are formed by the grid sizes (two md=6 cards share a row on desktop).
 */
const choreoDefault: HomeCardConfig = {
  name: 'choreo-default',
  cards: [
    { cardId: 'search', size: { xs: 12 } },
    { cardId: 'my-projects', size: { xs: 12, md: 6 } },
    { cardId: 'quick-actions', size: { xs: 12, md: 6 } },
    { cardId: 'recent-deployments', size: { xs: 12 } },
    { cardId: 'starred-entities', size: { xs: 12, md: 6 } },
    { cardId: 'recently-visited', size: { xs: 12, md: 6 } },
    { cardId: 'platform-details', size: { xs: 12 } },
  ],
};

/**
 * Named home page layouts. The active one is selected via the
 * `openchoreo.home.cardConfig` app-config key (default: choreo-default).
 * New predefined layouts register here.
 */
const HOME_CARD_CONFIGS: Record<string, HomeCardConfig> = {
  [choreoDefault.name]: choreoDefault,
};

export function getHomeCardConfig(name: string): HomeCardConfig {
  return HOME_CARD_CONFIGS[name] ?? HOME_CARD_CONFIGS[DEFAULT_HOME_CARD_CONFIG];
}
