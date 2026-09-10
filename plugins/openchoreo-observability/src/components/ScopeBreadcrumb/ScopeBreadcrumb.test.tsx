import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { ScopeBreadcrumb, ScopeSelection } from './ScopeBreadcrumb';

const entity = (
  kind: string,
  name: string,
  title?: string,
  annotations?: Record<string, string>,
) => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind,
  metadata: { name, ...(title ? { title } : {}), annotations },
});

// Catalog entities keyed by kind: Domains = namespaces, Systems = projects,
// Components carry namespace/project annotations.
const getEntities = jest.fn(async ({ filter }: any) => {
  switch (filter.kind) {
    case 'Domain':
      return { items: [entity('Domain', 'default', 'Default NS')] };
    case 'System':
      return {
        items: [
          entity('System', 'gcp', 'GCP Demo'),
          entity('System', 'shop', 'Shop'),
        ],
      };
    case 'Component':
      return {
        items: [
          entity('Component', 'api', 'API Service', {
            'openchoreo.io/namespace': 'default',
            'openchoreo.io/project': 'gcp',
          }),
        ],
      };
    default:
      return { items: [] };
  }
});

async function renderBreadcrumb(
  scope: ScopeSelection,
  onScopeChange = jest.fn(),
) {
  // useOpenChoreoQuery needs a QueryClient; the breadcrumb styles read
  // `theme.page.fontColor`, so it also needs a Backstage theme (renderInTestApp).
  const QueryWrapper = createQueryWrapper();
  await renderInTestApp(
    <TestApiProvider apis={[[catalogApiRef, { getEntities } as any]]}>
      <QueryWrapper>
        <ScopeBreadcrumb scope={scope} onScopeChange={onScopeChange} />
      </QueryWrapper>
    </TestApiProvider>,
  );
  return { onScopeChange };
}

describe('ScopeBreadcrumb', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the namespace segment with its catalog title', async () => {
    await renderBreadcrumb({ namespace: 'default' });
    expect(await screen.findByText('Default NS')).toBeInTheDocument();
    // Deeper segments are hidden until selected.
    expect(screen.queryByText('GCP Demo')).not.toBeInTheDocument();
  });

  it('opens the namespace switcher and changes scope on selection', async () => {
    const { onScopeChange } = await renderBreadcrumb({ namespace: 'default' });
    await screen.findByText('Default NS');

    fireEvent.click(screen.getByRole('button', { name: 'Switch namespace' }));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Default NS' }),
    );
    expect(onScopeChange).toHaveBeenCalledWith({ namespace: 'default' });
  });

  it('renders project and component segments once the scope is deep enough', async () => {
    await renderBreadcrumb({
      namespace: 'default',
      project: 'gcp',
      component: 'api',
    });
    expect(await screen.findByText('GCP Demo')).toBeInTheDocument();
    expect(await screen.findByText('API Service')).toBeInTheDocument();
  });

  it('navigates to a shallower scope when a segment name is clicked', async () => {
    const { onScopeChange } = await renderBreadcrumb({
      namespace: 'default',
      project: 'gcp',
    });
    const nsLink = await screen.findByRole('button', { name: 'Default NS' });
    fireEvent.click(nsLink);
    // Clicking the namespace name drops the deeper project selection.
    expect(onScopeChange).toHaveBeenCalledWith({ namespace: 'default' });
  });

  it('only queries deeper levels once their parent scope is set', async () => {
    await renderBreadcrumb({ namespace: 'default' });
    await screen.findByText('Default NS');
    await waitFor(() =>
      expect(
        getEntities.mock.calls.some(([arg]) => arg.filter.kind === 'Domain'),
      ).toBe(true),
    );
    // No project selected, so the Component query must stay disabled.
    expect(
      getEntities.mock.calls.some(([arg]) => arg.filter.kind === 'Component'),
    ).toBe(false);
  });

  it('switches to a sibling project via the caret dropdown', async () => {
    const { onScopeChange } = await renderBreadcrumb({
      namespace: 'default',
      project: 'gcp',
    });
    await screen.findByText('GCP Demo');

    fireEvent.click(screen.getByRole('button', { name: 'Switch project' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Shop' }));
    expect(onScopeChange).toHaveBeenCalledWith({
      namespace: 'default',
      project: 'shop',
    });
  });
});
