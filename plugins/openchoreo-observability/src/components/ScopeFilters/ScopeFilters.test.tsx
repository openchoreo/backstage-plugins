import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  ScopeFilterProvider,
  NamespaceFilter,
  ProjectFilter,
  ComponentFilter,
  type ScopeSelection,
} from './ScopeFilters';

jest.mock('../../hooks/useGetComponentsByProject', () => ({
  useGetComponentsByProject: () => ({ components: [] }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useOpenChoreoQuery: () => ({ data: [] }),
}));

const catalogApi = { getEntities: async () => ({ items: [] }) };

const render = (scope: ScopeSelection, children?: React.ReactNode) =>
  renderInTestApp(
    <TestApiProvider apis={[[catalogApiRef, catalogApi as any]]}>
      <ScopeFilterProvider scope={scope} onScopeChange={() => {}}>
        {children ?? (
          <>
            <NamespaceFilter />
            <ProjectFilter />
            <ComponentFilter />
          </>
        )}
      </ScopeFilterProvider>
    </TestApiProvider>,
  );

// Selecting nothing is a real scope -- no project means the whole namespace --
// so the control has to say so. Left to itself MUI shows an empty box for an
// empty value even when a matching item exists, which reads as "not loaded yet"
// rather than "everything".
describe('scope filters', () => {
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

  // The controls are placed by the page, so the order they appear in is the
  // page's to choose and anything of the page's own can sit between them.
  // Document order is asserted, not CSS order, because it is also the tab order.
  it('renders the controls in the order the caller composes them', async () => {
    const { container } = await render(
      { namespace: 'default', project: 'checkout' },
      <>
        <NamespaceFilter />
        <div data-testid="page-own-filter" />
        <ProjectFilter />
        <ComponentFilter />
      </>,
    );
    // An outlined MUI field repeats its label in the notch, so read the <label>
    // elements rather than every node carrying the text.
    const order = Array.from(
      container.querySelectorAll('label, [data-testid="page-own-filter"]'),
    ).map(node => node.textContent || node.getAttribute('data-testid'));
    expect(order).toEqual([
      'Namespace',
      'page-own-filter',
      'Project',
      'Component',
    ]);
  });

  it('fails loudly when a control is used outside the provider', async () => {
    // React logs the error it re-throws; silence it so the run stays readable.
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    await expect(
      renderInTestApp(
        <TestApiProvider apis={[[catalogApiRef, catalogApi as any]]}>
          <ProjectFilter />
        </TestApiProvider>,
      ),
    ).rejects.toThrow('<ProjectFilter> must be rendered inside');
    consoleError.mockRestore();
  });
});
