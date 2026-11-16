import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { MyProjectsWidgetPreview } from './MyProjectsWidget';

const getEntities = jest.fn();
const fetchTotalBindingsCount = jest.fn();

function renderPreview(props: { disableCard?: boolean } = {}) {
  return renderInTestApp(
    <TestApiProvider
      apis={[
        [catalogApiRef, { getEntities }],
        [openChoreoClientApiRef, { fetchTotalBindingsCount }],
      ]}
    >
      <MyProjectsWidgetPreview {...props} />
    </TestApiProvider>,
  );
}

describe('MyProjectsWidgetPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the metric labels with sample numbers', async () => {
    await renderPreview({ disableCard: true });

    expect(screen.getByText('Projects:')).toBeInTheDocument();
    expect(screen.getByText('Components:')).toBeInTheDocument();
    expect(screen.getByText('Active Deployments:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('does not call any API', async () => {
    await renderPreview({ disableCard: true });

    expect(getEntities).not.toHaveBeenCalled();
    expect(fetchTotalBindingsCount).not.toHaveBeenCalled();
  });
});
