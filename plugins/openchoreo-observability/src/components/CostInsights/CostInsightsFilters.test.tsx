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
    ...overrides,
  };
  return { props, ...render(<CostInsightsFilters {...props} />) };
}

describe('CostInsightsFilters', () => {
  it('renders the environments select', () => {
    renderFilters();
    expect(
      screen.getByRole('textbox', { name: 'Environments' }),
    ).toBeInTheDocument();
  });

  it('renders a refresh button and invokes onRefresh when clicked', () => {
    const onRefresh = jest.fn();
    renderFilters({ onRefresh });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('disables the refresh button while refreshing', () => {
    renderFilters({ onRefresh: jest.fn(), refreshing: true });
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  });

  it('omits the refresh button when no handler is given', () => {
    renderFilters();
    expect(
      screen.queryByRole('button', { name: 'Refresh' }),
    ).not.toBeInTheDocument();
  });
});
