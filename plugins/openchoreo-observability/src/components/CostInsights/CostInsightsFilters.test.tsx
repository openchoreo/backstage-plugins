import { render, screen, fireEvent } from '@testing-library/react';
import { CostInsightsFilters } from './CostInsightsFilters';
import type { Environment } from '@openchoreo/backstage-plugin-react';

const environments: Environment[] = [
  { name: 'dev', namespace: 'default', displayName: 'Development' },
];

function renderFilters(
  overrides: Partial<React.ComponentProps<typeof CostInsightsFilters>> = {},
) {
  const props = {
    environments,
    selectedEnvironments: ['dev'],
    onEnvironmentsChange: jest.fn(),
    view: 'table' as const,
    onViewChange: jest.fn(),
    timeRange: '1h',
    onTimeRangeChange: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<CostInsightsFilters {...props} />) };
}

describe('CostInsightsFilters', () => {
  it('renders the view toggle, environments and time range', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: 'Table' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Graphs' })).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Environments' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Time Range' }),
    ).toBeInTheDocument();
  });

  it('emits the selected view when a toggle is clicked', () => {
    const { props } = renderFilters({ view: 'table' });
    fireEvent.click(screen.getByRole('button', { name: 'Graphs' }));
    expect(props.onViewChange).toHaveBeenCalledWith('graph');
  });

  it('disables the view toggles when disabled', () => {
    renderFilters({ disabled: true });
    expect(screen.getByRole('button', { name: 'Table' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Graphs' })).toBeDisabled();
  });
});
