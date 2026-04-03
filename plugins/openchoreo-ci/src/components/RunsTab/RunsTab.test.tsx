import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RunsTab } from './RunsTab';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';

// ---- Mocks ----

jest.mock('../BuildStatusChip', () => ({
  BuildStatusChip: ({ status }: { status: string }) => (
    <span data-testid="build-status-chip">{status}</span>
  ),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  formatRelativeTime: (ts: string) => `relative(${ts})`,
}));

jest.mock('../../utils/schemaExtensions', () => ({
  extractGitFieldValues: (_params: any, _mapping: any) => ({}),
}));

jest.mock('../../hooks', () => ({
  formatRetentionDuration: (ttl: string) => `formatted(${ttl})`,
}));

jest.mock('@backstage/core-components', () => ({
  Table: ({ title, data, columns, emptyContent, onRowClick }: any) => (
    <div data-testid="table">
      <div data-testid="table-title">{title}</div>
      {data.length === 0 ? (
        <div data-testid="empty-content">{emptyContent}</div>
      ) : (
        <div data-testid="table-rows">
          {data.map((row: any, i: number) => (
            <div // eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
              key={i}
              data-testid={`row-${row.name}`}
              onClick={() => onRowClick?.(undefined, row)}
            >
              {row.name}
              {columns.map((col: any, j: number) =>
                col.render ? (
                  <span key={j} data-testid={`cell-${col.field}-${i}`}>
                    {col.render(row)}
                  </span>
                ) : null,
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  ),
}));

// ---- Helpers ----

const builds: ModelsBuild[] = [
  {
    name: 'build-2',
    uuid: 'uuid-2',
    componentName: 'api-service',
    projectName: 'my-project',
    namespaceName: 'dev-ns',
    status: 'Succeeded',
    createdAt: '2024-06-02T10:00:00Z',
    commit: 'abc1234',
  },
  {
    name: 'build-1',
    uuid: 'uuid-1',
    componentName: 'api-service',
    projectName: 'my-project',
    namespaceName: 'dev-ns',
    status: 'Failed',
    createdAt: '2024-06-01T10:00:00Z',
    commit: 'def5678',
  },
];

function renderTab(
  overrides: Partial<React.ComponentProps<typeof RunsTab>> = {},
) {
  const defaultProps = {
    builds,
    loading: false,
    isRefreshing: false,
    onRefresh: jest.fn(),
    onRowClick: jest.fn(),
  };

  return {
    ...render(<RunsTab {...defaultProps} {...overrides} />),
    props: { ...defaultProps, ...overrides },
  };
}

// ---- Tests ----

describe('RunsTab', () => {
  it('renders table with "Workflow Runs" title', () => {
    renderTab();

    expect(screen.getByText('Workflow Runs')).toBeInTheDocument();
  });

  it('renders rows for each build', () => {
    renderTab();

    expect(screen.getByTestId('row-build-2')).toBeInTheDocument();
    expect(screen.getByTestId('row-build-1')).toBeInTheDocument();
  });

  it('sorts builds by createdAt descending (newest first)', () => {
    renderTab();

    const rows = screen.getByTestId('table-rows');
    const rowTexts = rows.textContent;
    // build-2 (newer) should appear before build-1
    expect(rowTexts?.indexOf('build-2')).toBeLessThan(
      rowTexts?.indexOf('build-1') ?? Infinity,
    );
  });

  it('calls onRowClick when a row is clicked', async () => {
    const user = userEvent.setup();
    const onRowClick = jest.fn();

    renderTab({ onRowClick });

    await user.click(screen.getByTestId('row-build-2'));

    expect(onRowClick).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'build-2' }),
    );
  });

  it('shows empty content when no builds', () => {
    renderTab({ builds: [] });

    expect(screen.getByText('No workflow runs found')).toBeInTheDocument();
    expect(
      screen.getByText('Trigger a workflow to see runs appear here'),
    ).toBeInTheDocument();
  });

  it('shows retention info in empty content when retentionTtl is provided', () => {
    renderTab({ builds: [], retentionTtl: '24h' });

    expect(
      screen.getByText(/automatically removed after formatted\(24h\)/),
    ).toBeInTheDocument();
  });

  it('shows retention tooltip when retentionTtl is provided', () => {
    renderTab({ retentionTtl: '48h' });

    expect(screen.getByLabelText('Retention period info')).toBeInTheDocument();
  });

  it('renders refresh button', () => {
    renderTab();

    expect(screen.getByTitle('Refresh builds')).toBeInTheDocument();
  });

  it('disables refresh button when refreshing', () => {
    renderTab({ isRefreshing: true });

    expect(screen.getByTitle('Refreshing...')).toBeDisabled();
  });

  it('calls onRefresh when refresh button is clicked', async () => {
    const user = userEvent.setup();
    const onRefresh = jest.fn();

    renderTab({ onRefresh });

    await user.click(screen.getByTitle('Refresh builds'));

    expect(onRefresh).toHaveBeenCalled();
  });
});
