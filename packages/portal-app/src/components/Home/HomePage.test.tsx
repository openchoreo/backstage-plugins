import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { configApiRef } from '@backstage/core-plugin-api';
import { ConfigReader } from '@backstage/config';

type ConfigData = ConstructorParameters<typeof ConfigReader>[0];

const useUserInfo = jest.fn();
const getHomeCardConfig = jest.fn();

jest.mock('../../hooks', () => ({
  useUserInfo: () => useUserInfo(),
}));

jest.mock('@backstage/plugin-search-react', () => ({
  SearchContextProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

// The layout config and card set are mocked so the test drives exactly which
// slots exist; the real registry/configs have their own suites.
jest.mock('./cards', () => ({
  DEFAULT_HOME_CARD_CONFIG: 'choreo-default',
  getHomeCardConfig: (name: string) => getHomeCardConfig(name),
  HOME_CARD_REGISTRY: {
    'always-on': {
      id: 'always-on',
      title: 'Always On',
      description: '',
      component: () => <div data-testid="card-always-on" />,
    },
    gated: {
      id: 'gated',
      title: 'Gated',
      description: '',
      component: () => <div data-testid="card-gated" />,
      useVisibility: () => false,
    },
  },
}));

jest.mock('./styles', () => ({
  useStyles: () => ({}),
}));

import { HomePage } from './HomePage';

function renderHomePage(config: ConfigData = {}) {
  return renderInTestApp(
    <TestApiProvider apis={[[configApiRef, new ConfigReader(config)]]}>
      <HomePage />
    </TestApiProvider>,
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUserInfo.mockReturnValue({ userName: 'Isuru', loading: false });
    getHomeCardConfig.mockReturnValue({
      name: 'choreo-default',
      cards: [
        { cardId: 'always-on', size: { xs: 12 } },
        { cardId: 'gated', size: { xs: 12, md: 6 } },
        { cardId: 'unknown-card', size: { xs: 12 } },
      ],
    });
  });

  it('renders the cards of the active layout', async () => {
    await renderHomePage();
    expect(screen.getByText('Welcome, Isuru!')).toBeInTheDocument();
    expect(screen.getByTestId('card-always-on')).toBeInTheDocument();
  });

  it('skips cards whose visibility hook returns false', async () => {
    await renderHomePage();
    expect(screen.queryByTestId('card-gated')).not.toBeInTheDocument();
  });

  it('skips card ids missing from the registry', async () => {
    await expect(renderHomePage()).resolves.toBeDefined();
  });

  it('selects the layout named in app-config', async () => {
    await renderHomePage({
      openchoreo: { home: { cardConfig: 'my-layout' } },
    });
    expect(getHomeCardConfig).toHaveBeenCalledWith('my-layout');
  });

  it('falls back to the default layout name when unconfigured', async () => {
    await renderHomePage();
    expect(getHomeCardConfig).toHaveBeenCalledWith('choreo-default');
  });

  it('shows the loading state while user info loads', async () => {
    useUserInfo.mockReturnValue({ userName: undefined, loading: true });
    await renderHomePage();
    expect(screen.getByText('Loading user information...')).toBeInTheDocument();
  });
});
