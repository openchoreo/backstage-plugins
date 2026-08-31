import { render, screen, fireEvent } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { CostInsightsScopeFilters } from './CostInsightsScopeFilters';
import type { CostScopeSelection } from './types';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return { ...actual, useApi: jest.fn() };
});

// The catalog queries run through useOpenChoreoQuery; stub it to resolve
// synchronously so the container's option lists are populated deterministically.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  useOpenChoreoQuery: (_key: unknown, _fn: unknown, opts?: any) => ({
    data: opts && opts.enabled === false ? undefined : [],
    loading: false,
  }),
}));

// Expose each filter's onChange as a button so the container's cascade/pruning
// handlers can be exercised without opening the real dropdown menu.
jest.mock('@openchoreo/backstage-design-system', () => ({
  MultiSelectFilter: ({ label, onChange }: any) => (
    <button
      type="button"
      data-testid={`filter-${label}`}
      onClick={() => onChange(new Set())}
    >
      clear {label}
    </button>
  ),
}));

describe('CostInsightsScopeFilters', () => {
  beforeEach(() => {
    (useApi as jest.Mock).mockReturnValue({ getEntities: jest.fn() });
  });

  const selection: CostScopeSelection = {
    namespaces: ['a', 'b'],
    projects: [
      { namespace: 'a', name: 'p1' },
      { namespace: 'b', name: 'p2' },
    ],
    components: [
      { namespace: 'a', project: 'p1', name: 'c1' },
      { namespace: 'b', project: 'p2', name: 'c2' },
    ],
  };

  it('prunes orphaned projects and components when a namespace is cleared', () => {
    const onChange = jest.fn();
    render(
      <CostInsightsScopeFilters selection={selection} onChange={onChange} />,
    );

    fireEvent.click(screen.getByTestId('filter-Namespaces'));

    // Clearing all namespaces drops every dependent project and component.
    expect(onChange).toHaveBeenCalledWith({
      namespaces: [],
      projects: [],
      components: [],
    });
  });

  it('prunes orphaned components when a project is cleared', () => {
    const onChange = jest.fn();
    render(
      <CostInsightsScopeFilters selection={selection} onChange={onChange} />,
    );

    fireEvent.click(screen.getByTestId('filter-Projects'));

    expect(onChange).toHaveBeenCalledWith({
      namespaces: ['a', 'b'],
      projects: [],
      components: [],
    });
  });
});
