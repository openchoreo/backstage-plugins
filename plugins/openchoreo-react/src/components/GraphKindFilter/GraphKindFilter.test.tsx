import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphKindFilter } from './GraphKindFilter';
import { APPLICATION_VIEW } from '../../utils/platformOverviewConstants';

// ---- Helpers ----

function renderFilter(
  overrides: Partial<{
    selectedKinds: string[];
    onKindsChange: jest.Mock;
    clusterScopeActive: boolean;
    leading: React.ReactNode;
    trailing: React.ReactNode;
  }> = {},
) {
  const defaultProps = {
    selectedKinds: APPLICATION_VIEW.kinds,
    onKindsChange: jest.fn(),
    clusterScopeActive: false,
    ...overrides,
  };

  return {
    ...render(<GraphKindFilter {...defaultProps} />),
    onKindsChange: defaultProps.onKindsChange,
  };
}

// ---- Tests ----

describe('GraphKindFilter', () => {
  it('shows preset label when selection matches a preset', () => {
    renderFilter({ selectedKinds: APPLICATION_VIEW.kinds });

    expect(
      screen.getByRole('button', { name: /Kind: Developer Resources/i }),
    ).toBeInTheDocument();
  });

  it('shows count when selection does not match a preset', () => {
    renderFilter({ selectedKinds: ['system', 'dataplane'] });

    expect(
      screen.getByRole('button', { name: /Kind: 2 selected/i }),
    ).toBeInTheDocument();
  });

  it('shows single kind label when only one kind selected', () => {
    renderFilter({ selectedKinds: ['environment'] });

    expect(
      screen.getByRole('button', { name: /Kind: Environment/i }),
    ).toBeInTheDocument();
  });

  it('opens popover with presets and individual kinds on click', async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.click(
      screen.getByRole('button', { name: /Kind: Developer Resources/i }),
    );

    // Presets
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Developer Resources')).toBeInTheDocument();
    expect(screen.getByText('Platform Resources')).toBeInTheDocument();

    // Individual kinds
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Component')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Environment')).toBeInTheDocument();
  });

  it('hides cluster-scoped kinds when clusterScopeActive is false', async () => {
    const user = userEvent.setup();
    renderFilter({ clusterScopeActive: false });

    await user.click(
      screen.getByRole('button', { name: /Kind:/i }),
    );

    expect(screen.queryByText('Cluster Data Plane')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Cluster Workflow Plane'),
    ).not.toBeInTheDocument();
  });

  it('shows cluster-scoped kinds when clusterScopeActive is true', async () => {
    const user = userEvent.setup();
    renderFilter({ clusterScopeActive: true });

    await user.click(
      screen.getByRole('button', { name: /Kind:/i }),
    );

    expect(screen.getByText('Cluster Data Plane')).toBeInTheDocument();
    expect(screen.getByText('Cluster Workflow Plane')).toBeInTheDocument();
  });

  it('calls onKindsChange with preset kinds when preset clicked', async () => {
    const user = userEvent.setup();
    const { onKindsChange } = renderFilter({
      selectedKinds: ['system'],
    });

    await user.click(
      screen.getByRole('button', { name: /Kind:/i }),
    );
    await user.click(screen.getByText('Developer Resources'));

    expect(onKindsChange).toHaveBeenCalledWith(APPLICATION_VIEW.kinds);
  });

  it('deselects preset kinds when fully-selected preset is clicked', async () => {
    const user = userEvent.setup();
    const { onKindsChange } = renderFilter({
      selectedKinds: APPLICATION_VIEW.kinds,
    });

    await user.click(
      screen.getByRole('button', { name: /Kind: Developer Resources/i }),
    );
    await user.click(screen.getByText('Developer Resources'));

    // Should remove all APPLICATION_VIEW kinds
    expect(onKindsChange).toHaveBeenCalledWith([]);
  });

  it('toggles individual kind on click', async () => {
    const user = userEvent.setup();
    const { onKindsChange } = renderFilter({
      selectedKinds: ['system', 'component'],
    });

    await user.click(
      screen.getByRole('button', { name: /Kind:/i }),
    );
    // Click "Pipeline" to add it
    await user.click(screen.getByText('Pipeline'));

    expect(onKindsChange).toHaveBeenCalledWith([
      'system',
      'component',
      'deploymentpipeline',
    ]);
  });

  it('removes kind when already-selected kind is clicked', async () => {
    const user = userEvent.setup();
    const { onKindsChange } = renderFilter({
      selectedKinds: ['system', 'component'],
    });

    await user.click(
      screen.getByRole('button', { name: /Kind:/i }),
    );
    await user.click(screen.getByText('Component'));

    expect(onKindsChange).toHaveBeenCalledWith(['system']);
  });

  it('renders leading and trailing content', () => {
    renderFilter({
      leading: <span data-testid="leading">Scope</span>,
      trailing: <span data-testid="trailing">Project</span>,
    });

    expect(screen.getByTestId('leading')).toBeInTheDocument();
    expect(screen.getByTestId('trailing')).toBeInTheDocument();
  });
});
