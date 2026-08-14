import { render, renderHook, screen } from '@testing-library/react';

const useNamespacePermission = jest.fn();

// The registry is the unit under test; the card components it wires up have
// their own suites, so they are stubbed to keep this module load cheap.
jest.mock('@backstage/plugin-home', () => ({
  HomePageStarredEntities: () => null,
}));
jest.mock('@backstage/plugin-search', () => ({
  HomePageSearchBar: () => <input aria-label="Search" />,
}));
jest.mock('@openchoreo/backstage-plugin', () => ({
  MyProjectsWidget: () => null,
  QuickActionsSection: () => null,
}));
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useNamespacePermission: () => useNamespacePermission(),
}));
jest.mock('@openchoreo/backstage-plugin-platform-engineer-core', () => ({
  HomePagePlatformDetailsCard: () => null,
}));
jest.mock('../RecentlyVisitedCard', () => ({
  RecentlyVisitedCard: () => null,
}));
jest.mock('../RecentDeploymentsCard', () => ({
  RecentDeploymentsCard: () => null,
}));
jest.mock('../styles', () => ({
  useStyles: () => ({}),
}));

import { HOME_CARD_REGISTRY } from './registry';
import { getHomeCardConfig, DEFAULT_HOME_CARD_CONFIG } from './configs';

describe('HOME_CARD_REGISTRY', () => {
  it('keys every definition by its own id', () => {
    for (const [key, definition] of Object.entries(HOME_CARD_REGISTRY)) {
      expect(definition.id).toBe(key);
      expect(definition.title).toBeTruthy();
      expect(definition.description).toBeTruthy();
      expect(definition.component).toBeDefined();
    }
  });

  it('resolves every card referenced by the default layout', () => {
    const config = getHomeCardConfig(DEFAULT_HOME_CARD_CONFIG);
    for (const placement of config.cards) {
      expect(HOME_CARD_REGISTRY[placement.cardId]).toBeDefined();
    }
  });

  it('renders the search card', () => {
    const SearchCard = HOME_CARD_REGISTRY.search.component;
    render(<SearchCard />);
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  describe('platform-details visibility', () => {
    it('is visible when the user can view namespaces', () => {
      useNamespacePermission.mockReturnValue({ canView: true });
      const { result } = renderHook(() =>
        HOME_CARD_REGISTRY['platform-details'].useVisibility!(),
      );
      expect(result.current).toBe(true);
    });

    it('is hidden when the user cannot view namespaces', () => {
      useNamespacePermission.mockReturnValue({ canView: false });
      const { result } = renderHook(() =>
        HOME_CARD_REGISTRY['platform-details'].useVisibility!(),
      );
      expect(result.current).toBe(false);
    });
  });
});
