import { render, screen } from '@testing-library/react';
import { OverviewTab } from './OverviewTab';

// ---- Mocks ----

jest.mock('../WorkflowDetailsRenderer', () => ({
  WorkflowDetailsRenderer: ({ data }: any) => (
    <div data-testid="workflow-details-renderer">{JSON.stringify(data)}</div>
  ),
}));

// ---- Tests ----

describe('OverviewTab', () => {
  it('shows empty state when workflow is null', () => {
    render(<OverviewTab workflow={null} />);

    expect(
      screen.getByText('No workflow details available for this component.'),
    ).toBeInTheDocument();
  });

  it('shows empty state when workflow is undefined', () => {
    render(<OverviewTab workflow={undefined} />);

    expect(
      screen.getByText('No workflow details available for this component.'),
    ).toBeInTheDocument();
  });

  it('displays workflow name', () => {
    render(
      <OverviewTab workflow={{ name: 'build-and-deploy', parameters: {} }} />,
    );

    expect(screen.getByText('Workflow Name:')).toBeInTheDocument();
    expect(screen.getByText('build-and-deploy')).toBeInTheDocument();
  });

  it('renders WorkflowDetailsRenderer when parameters exist', () => {
    const parameters = { image: 'node:18', timeout: '30m' };

    render(<OverviewTab workflow={{ name: 'my-workflow', parameters }} />);

    expect(screen.getByTestId('workflow-details-renderer')).toBeInTheDocument();
  });

  it('does not render WorkflowDetailsRenderer when parameters are empty', () => {
    render(<OverviewTab workflow={{ name: 'my-workflow', parameters: {} }} />);

    expect(
      screen.queryByTestId('workflow-details-renderer'),
    ).not.toBeInTheDocument();
  });

  it('does not render WorkflowDetailsRenderer when parameters are undefined', () => {
    render(<OverviewTab workflow={{ name: 'my-workflow' } as any} />);

    expect(
      screen.queryByTestId('workflow-details-renderer'),
    ).not.toBeInTheDocument();
  });
});
