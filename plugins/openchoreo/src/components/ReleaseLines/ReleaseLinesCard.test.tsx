import { fireEvent, screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { ReleaseLinesCard } from './ReleaseLinesCard';

jest.mock('./useReleaseLines', () => ({
  useReleaseLines: () => ({
    releaseLines: [
      { name: 'main', environments: [] },
      { name: 'next', environments: [] },
      { name: 'next-hotfix', environments: [] },
    ],
    loading: false,
    isRefetching: false,
    error: null,
    refetch: jest.fn(),
    createReleaseLine: jest.fn(),
    creating: false,
  }),
}));

jest.mock('@backstage/plugin-permission-react', () => ({
  ...jest.requireActual('@backstage/plugin-permission-react'),
  usePermission: () => ({ allowed: true, loading: false }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  useComponentUpdatePermission: () => ({
    canUpdateComponent: true,
    loading: false,
  }),
}));

jest.mock('../DeleteEntity', () => ({
  ...jest.requireActual('../DeleteEntity'),
  useDeleteEntityDialog: () => ({
    requestDelete: jest.fn(),
    DeleteDialog: () => null,
  }),
}));

const component: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'hello', namespace: 'default' },
  spec: { type: 'service' },
};

async function renderCard() {
  await renderInTestApp(
    <EntityProvider entity={component}>
      <ReleaseLinesCard />
    </EntityProvider>,
  );
}

const lineNames = () =>
  screen
    .queryAllByRole('link')
    .map(link => link.textContent)
    .filter(name => name && /^(main|next)/.test(name));

describe('ReleaseLinesCard', () => {
  it('filters the release lines by name', async () => {
    await renderCard();
    expect(lineNames()).toEqual(['main', 'next', 'next-hotfix']);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search by name' }), {
      target: { value: 'NEXT' },
    });

    expect(lineNames()).toEqual(['next', 'next-hotfix']);
    expect(screen.getByText('1–2 of 2')).toBeInTheDocument();
  });

  it('says so when no line matches, and clears the filter', async () => {
    await renderCard();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search by name' }), {
      target: { value: 'nope' },
    });
    expect(
      screen.getByText('No release lines match the current filters'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(lineNames()).toHaveLength(3);
  });
});
