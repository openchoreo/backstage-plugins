import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { OverviewWidget } from './OverviewWidget';

const getEntities = jest.fn();
const fetchTotalBindingsCount = jest.fn();

const componentWithAnnotations = {
  metadata: {
    name: 'svc',
    annotations: {
      [CHOREO_ANNOTATIONS.NAMESPACE]: 'ns',
      [CHOREO_ANNOTATIONS.PROJECT]: 'proj',
      [CHOREO_ANNOTATIONS.COMPONENT]: 'svc',
    },
  },
};

const items = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ metadata: { name: `e${i}` } }));

// Distinct counts per kind so each tile's value is unambiguous.
const countsByKind: Record<string, number> = {
  System: 2,
  Environment: 3,
  API: 4,
  Resource: 6,
};

function renderWidget(props: { disableCard?: boolean } = {}) {
  return renderInTestApp(
    <TestApiProvider
      apis={[
        [catalogApiRef, { getEntities }],
        [openChoreoClientApiRef, { fetchTotalBindingsCount }],
      ]}
    >
      <OverviewWidget {...props} />
    </TestApiProvider>,
  );
}

const tileValue = (label: string) =>
  screen.getByText(label).previousElementSibling?.textContent;

describe('OverviewWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getEntities.mockImplementation(async ({ filter }) => {
      if (filter.kind === 'Component') {
        return { items: [componentWithAnnotations] };
      }
      return { items: items(countsByKind[filter.kind]) };
    });
    fetchTotalBindingsCount.mockResolvedValue(5);
  });

  it('renders the title and a count per metric', async () => {
    await renderWidget();

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(await screen.findByText('Projects')).toBeInTheDocument();
    expect(tileValue('Projects')).toBe('2');
    expect(tileValue('Components')).toBe('1');
    // 1 component with annotations -> bindings fetched.
    expect(tileValue('Active Deployments')).toBe('5');
    expect(tileValue('Environments')).toBe('3');
    expect(tileValue('APIs')).toBe('4');
    expect(tileValue('Resources')).toBe('6');
    expect(fetchTotalBindingsCount).toHaveBeenCalledWith([
      { namespaceName: 'ns', projectName: 'proj', componentName: 'svc' },
    ]);
  });

  it('links the catalog-backed metrics to their listings', async () => {
    await renderWidget();

    const projects = await screen.findByText('Projects');
    expect(projects.closest('a')).toHaveAttribute(
      'href',
      '/catalog?filters[kind]=System',
    );
    expect(screen.getByText('APIs').closest('a')).toHaveAttribute(
      'href',
      '/api-docs',
    );
    expect(screen.getByText('Active Deployments').closest('a')).toBeNull();
  });

  it('skips the bindings call when no component carries the annotations', async () => {
    getEntities.mockResolvedValue({ items: [{ metadata: { name: 'bare' } }] });
    await renderWidget();

    expect(await screen.findByText('Active Deployments')).toBeInTheDocument();
    expect(tileValue('Active Deployments')).toBe('0');
    expect(fetchTotalBindingsCount).not.toHaveBeenCalled();
  });

  it('omits the card title when disableCard is set', async () => {
    await renderWidget({ disableCard: true });

    expect(await screen.findByText('Projects')).toBeInTheDocument();
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
  });

  it('shows an error state when the catalog query fails', async () => {
    getEntities.mockRejectedValue(new Error('catalog down'));
    await renderWidget();

    expect(await screen.findByText('catalog down')).toBeInTheDocument();
  });
});
