import { screen } from '@testing-library/react';
import { configApiRef, identityApiRef } from '@backstage/core-plugin-api';
import {
  mockApis,
  renderInTestApp,
  TestApiProvider,
} from '@backstage/test-utils';
import type { JsonObject } from '@backstage/types';
import type { NavContentComponentProps } from '@backstage/plugin-app-react';
import { PortalNavContent } from './PortalNavContent';

// My Groups and the settings item need the catalog and routes these tests
// don't exercise.
jest.mock('@backstage/plugin-org', () => ({
  MyGroupsSidebarItem: () => null,
}));
jest.mock('@backstage/plugin-user-settings', () => ({
  Settings: () => null,
  UserSettingsSignInAvatar: () => null,
}));

const SCORECARDS_ID = 'page:tech-insights-scorecards';

/** Nav items holding only the Scorecards page. */
function scorecardsNavItems(): NavContentComponentProps['navItems'] {
  const item = {
    href: '/scorecards',
    title: 'Scorecards',
    icon: <span />,
    node: { spec: { id: SCORECARDS_ID } },
  };
  return {
    take: (id: string) => (id === SCORECARDS_ID ? item : undefined),
  } as unknown as NavContentComponentProps['navItems'];
}

async function renderNav(config: JsonObject) {
  await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, mockApis.config({ data: config })],
        [identityApiRef, mockApis.identity()],
      ]}
    >
      <PortalNavContent navItems={scorecardsNavItems()} items={[]} />
    </TestApiProvider>,
  );
}

describe('PortalNavContent', () => {
  it('shows Scorecards when its flag is unset', async () => {
    await renderNav({});
    expect(screen.getByText('Scorecards')).toBeInTheDocument();
  });

  it('hides Scorecards when it is turned off', async () => {
    await renderNav({ techInsights: { scorecards: { enabled: false } } });
    expect(screen.queryByText('Scorecards')).not.toBeInTheDocument();
  });
});
