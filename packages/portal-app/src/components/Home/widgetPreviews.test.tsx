import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import {
  catalogApiRef,
  entityPresentationApiRef,
} from '@backstage/plugin-catalog-react';
import { visitsApiRef } from '@backstage/plugin-home';
import { openChoreoClientApiRef } from '@openchoreo/backstage-plugin';
import { widgetPreviews } from './widgetPreviews';

// Any method call on these APIs is recorded, so a preview that reaches an API
// fails the test.
const calls = jest.fn();
const spyApi = new Proxy(
  {},
  {
    get:
      (_target, method) =>
      (...args: unknown[]) => {
        calls(String(method), ...args);
        return Promise.resolve({ items: [] });
      },
  },
);

describe('widgetPreviews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has a preview for each OpenChoreo home widget', () => {
    expect(Object.keys(widgetPreviews).sort()).toEqual([
      'OpenChoreoMyProjects',
      'OpenChoreoQuickActions',
      'OpenChoreoRecentDeployments',
      'OpenChoreoRecentlyVisited',
    ]);
  });

  it.each([
    ['OpenChoreoRecentlyVisited', ['Home', 'Catalog', 'Create']],
    [
      'OpenChoreoMyProjects',
      ['Projects:', 'Components:', 'Active Deployments:'],
    ],
    ['OpenChoreoQuickActions', ['Create Component', 'Browse Templates']],
    [
      'OpenChoreoRecentDeployments',
      ['movie-frontend', 'movie-backend', 'react-starter'],
    ],
  ])('%s preview shows sample data and calls no API', async (name, texts) => {
    const Preview = widgetPreviews[name];

    await renderInTestApp(
      <TestApiProvider
        apis={[
          [catalogApiRef, spyApi],
          [openChoreoClientApiRef, spyApi],
          [visitsApiRef, spyApi],
          [entityPresentationApiRef, spyApi],
        ]}
      >
        <Preview />
      </TestApiProvider>,
    );

    texts.forEach(text => expect(screen.getByText(text)).toBeInTheDocument());
    expect(calls).not.toHaveBeenCalled();
  });
});
