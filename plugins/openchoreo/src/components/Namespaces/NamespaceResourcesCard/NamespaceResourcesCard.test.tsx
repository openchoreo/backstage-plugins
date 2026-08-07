import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { NamespaceResourcesCard } from './NamespaceResourcesCard';

const useRelatedEntitiesQuery = jest.fn();

// The card is the integration under test; the data hook has its own suite.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useRelatedEntitiesQuery: (...args: unknown[]) =>
    useRelatedEntitiesQuery(...args),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  Skeleton: () => <span data-testid="skeleton" />,
}));

// Mocked so the real stylesheet (which reads design-system colour tokens the
// mock above does not provide) never loads.
jest.mock('./styles', () => ({
  useNamespaceResourcesCardStyles: () => ({ cardWrapper: '' }),
}));

// The card is the integration under test; the delete stack has its own suite.
jest.mock('../../DeleteEntity', () => ({
  isMarkedForDeletion: () => false,
  DeletionBadge: () => null,
  RowDeleteButton: () => null,
  useDeleteEntityDialog: () => ({
    requestDelete: jest.fn(),
    DeleteDialog: () => null,
  }),
  usePendingDeletionOverlay: () => ({
    markDeleted: jest.fn(),
    overlay: (entities: Entity[]) => entities,
  }),
}));

const namespace = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Domain',
  metadata: { name: 'acme', namespace: 'default' },
} as Entity;

const related = (kind: string, name: string): Entity =>
  ({
    apiVersion: 'backstage.io/v1alpha1',
    kind,
    metadata: { name, namespace: 'default' },
  } as Entity);

function renderCard() {
  return renderInTestApp(
    <EntityProvider entity={namespace}>
      <NamespaceResourcesCard />
    </EntityProvider>,
  );
}

describe('NamespaceResourcesCard', () => {
  beforeEach(() => {
    useRelatedEntitiesQuery.mockReset();
  });

  it('requests hasPart relations of every kind (no kind filter)', async () => {
    useRelatedEntitiesQuery.mockReturnValue({
      entities: [],
      loading: false,
      error: null,
    });

    await renderCard();

    expect(useRelatedEntitiesQuery).toHaveBeenCalledWith(namespace, {
      type: 'hasPart',
    });
  });

  it('lists non-System related entities and excludes Systems', async () => {
    // Systems are the namespace's projects and belong to the sibling card;
    // this one shows everything else in the namespace.
    useRelatedEntitiesQuery.mockReturnValue({
      entities: [
        related('System', 'billing'),
        related('Environment', 'production'),
        related('Resource', 'redis'),
      ],
      loading: false,
      error: null,
    });

    await renderCard();

    expect(await screen.findByText('production')).toBeInTheDocument();
    expect(screen.getByText('redis')).toBeInTheDocument();
    expect(screen.queryByText('billing')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'redis' })).toHaveAttribute(
      'href',
      '/catalog/default/resource/redis',
    );
  });

  it('shows skeleton rows while loading', async () => {
    useRelatedEntitiesQuery.mockReturnValue({
      entities: undefined,
      loading: true,
      error: null,
    });

    await renderCard();

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('keeps rendering rows when a refetch is in flight (no skeleton flash)', async () => {
    useRelatedEntitiesQuery.mockReturnValue({
      entities: [related('Resource', 'redis')],
      loading: false,
      error: null,
    });

    await renderCard();

    expect(await screen.findByText('redis')).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('shows the empty state when only Systems are related', async () => {
    useRelatedEntitiesQuery.mockReturnValue({
      entities: [related('System', 'billing')],
      loading: false,
      error: null,
    });

    await renderCard();

    expect(
      await screen.findByText('No resources found in this namespace'),
    ).toBeInTheDocument();
  });
});
