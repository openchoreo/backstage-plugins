import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { MyProjectsWidget } from './MyProjectsWidget';

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

function renderWidget(props: { disableCard?: boolean } = {}) {
  return renderInTestApp(
    <TestApiProvider
      apis={[
        [catalogApiRef, { getEntities }],
        [openChoreoClientApiRef, { fetchTotalBindingsCount }],
      ]}
    >
      <MyProjectsWidget {...props} />
    </TestApiProvider>,
  );
}

describe('MyProjectsWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getEntities.mockImplementation(async ({ filter }) => {
      if (filter.kind === 'Component') {
        return { items: [componentWithAnnotations] };
      }
      return {
        items: [{ metadata: { name: 'p1' } }, { metadata: { name: 'p2' } }],
      };
    });
    fetchTotalBindingsCount.mockResolvedValue(5);
  });

  it('renders the title and project/component/deployment counts', async () => {
    await renderWidget();

    expect(await screen.findByText('My Projects')).toBeInTheDocument();
    expect(screen.getByText('Projects:')).toBeInTheDocument();
    expect(screen.getByText('Components:')).toBeInTheDocument();
    expect(screen.getByText('Active Deployments:')).toBeInTheDocument();
    // 1 component with annotations -> bindings fetched.
    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(fetchTotalBindingsCount).toHaveBeenCalled();
  });

  it('omits the card title when disableCard is set', async () => {
    await renderWidget({ disableCard: true });

    expect(await screen.findByText('Projects:')).toBeInTheDocument();
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();
  });

  it('shows an error state when the catalog query fails', async () => {
    getEntities.mockRejectedValue(new Error('catalog down'));
    await renderWidget();

    expect(await screen.findByText('catalog down')).toBeInTheDocument();
  });
});
