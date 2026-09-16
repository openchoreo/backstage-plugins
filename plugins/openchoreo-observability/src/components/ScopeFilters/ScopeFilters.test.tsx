import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { ScopeFilters, type ScopeSelection } from './ScopeFilters';

jest.mock('../../hooks/useGetComponentsByProject', () => ({
  useGetComponentsByProject: () => ({ components: [] }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useOpenChoreoQuery: () => ({ data: [] }),
}));

const catalogApi = { getEntities: async () => ({ items: [] }) };

const render = (scope: ScopeSelection) =>
  renderInTestApp(
    <TestApiProvider apis={[[catalogApiRef, catalogApi as any]]}>
      <ScopeFilters scope={scope} onScopeChange={() => {}} />
    </TestApiProvider>,
  );

// Selecting nothing is a real scope -- no project means the whole namespace --
// so the control has to say so. Left to itself MUI shows an empty box for an
// empty value even when a matching item exists, which reads as "not loaded yet"
// rather than "everything".
describe('ScopeFilters', () => {
  it('says "All projects" when no project is chosen', async () => {
    await render({ namespace: 'default' });
    expect(screen.getByText('All projects')).toBeInTheDocument();
  });

  it('says "All components" when a project is chosen but no component is', async () => {
    await render({ namespace: 'default', project: 'checkout' });
    expect(screen.getByText('All components')).toBeInTheDocument();
  });

  it('shows the selection itself once one is made', async () => {
    await render({
      namespace: 'default',
      project: 'checkout',
      component: 'cart',
    });
    expect(screen.queryByText('All components')).not.toBeInTheDocument();
  });
});
