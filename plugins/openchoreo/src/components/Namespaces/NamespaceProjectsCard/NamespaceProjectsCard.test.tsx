import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { NamespaceProjectsCard } from './NamespaceProjectsCard';

const useRelatedEntitiesQuery = jest.fn();
const useScopedProjectCreatePermission = jest.fn();

// The card is the integration under test; the data hook has its own suite.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useRelatedEntitiesQuery: (...args: unknown[]) =>
    useRelatedEntitiesQuery(...args),
  useScopedProjectCreatePermission: () => useScopedProjectCreatePermission(),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  Skeleton: () => <span data-testid="skeleton" />,
}));

// Mocked so the real stylesheet (which reads design-system colour tokens the
// mock above does not provide) never loads.
jest.mock('./styles', () => ({
  useNamespaceProjectsCardStyles: () => ({
    cardWrapper: '',
    createProjectButton: '',
  }),
}));

const namespace = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Domain',
  metadata: { name: 'acme', namespace: 'default' },
} as Entity;

const project = (name: string, description?: string): Entity =>
  ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: { name, namespace: 'default', description },
  } as Entity);

function renderCard() {
  return renderInTestApp(
    <EntityProvider entity={namespace}>
      <NamespaceProjectsCard />
    </EntityProvider>,
  );
}

describe('NamespaceProjectsCard', () => {
  beforeEach(() => {
    useRelatedEntitiesQuery.mockReset();
    useScopedProjectCreatePermission.mockReset();
    useScopedProjectCreatePermission.mockReturnValue({
      canCreate: true,
      loading: false,
      createDeniedTooltip: '',
    });
  });

  it('requests the namespace’s System hasPart relations', async () => {
    useRelatedEntitiesQuery.mockReturnValue({
      entities: [],
      loading: false,
      error: null,
    });

    await renderCard();

    expect(useRelatedEntitiesQuery).toHaveBeenCalledWith(namespace, {
      type: 'hasPart',
      kind: 'System',
    });
  });

  it('renders a row per project once loaded', async () => {
    useRelatedEntitiesQuery.mockReturnValue({
      entities: [project('billing', 'Billing stack'), project('checkout')],
      loading: false,
      error: null,
    });

    await renderCard();

    expect(await screen.findByText('billing')).toBeInTheDocument();
    expect(screen.getByText('checkout')).toBeInTheDocument();
    expect(screen.getByText('Billing stack')).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    // Name cell links to the project's entity page.
    expect(screen.getByRole('link', { name: 'billing' })).toHaveAttribute(
      'href',
      '/catalog/default/system/billing',
    );
  });

  it('shows skeleton rows instead of project rows while loading', async () => {
    useRelatedEntitiesQuery.mockReturnValue({
      entities: undefined,
      loading: true,
      error: null,
    });

    await renderCard();

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('keeps rendering rows when a refetch is in flight (no skeleton flash)', async () => {
    // The regression the caching fix exists to prevent: `useRelatedEntitiesQuery`
    // holds the previous rows (loading false) while the new ref set is fetched,
    // so the card must render them rather than falling back to skeletons.
    useRelatedEntitiesQuery.mockReturnValue({
      entities: [project('billing')],
      loading: false,
      error: null,
    });

    await renderCard();

    expect(await screen.findByText('billing')).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('shows the empty state when the namespace has no projects', async () => {
    useRelatedEntitiesQuery.mockReturnValue({
      entities: [],
      loading: false,
      error: null,
    });

    await renderCard();

    expect(
      await screen.findByText('No projects found in this namespace'),
    ).toBeInTheDocument();
  });

  it('disables Create Project when the user lacks permission', async () => {
    useRelatedEntitiesQuery.mockReturnValue({
      entities: [],
      loading: false,
      error: null,
    });
    useScopedProjectCreatePermission.mockReturnValue({
      canCreate: false,
      loading: false,
      createDeniedTooltip: 'You do not have permission',
    });

    await renderCard();

    expect(
      await screen.findByRole('button', { name: /create project/i }),
    ).toBeDisabled();
  });
});
