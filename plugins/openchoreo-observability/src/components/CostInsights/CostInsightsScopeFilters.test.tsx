import { render, screen, fireEvent } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { CostInsightsScopeFilters } from './CostInsightsScopeFilters';
import type { CostScopeSelection } from './types';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return { ...actual, useApi: jest.fn() };
});

const option = (value: string) => ({ value, label: value });

// The catalog queries run through useOpenChoreoQuery; stub it to resolve
// synchronously with a fixed catalog: namespaces a/b, projects p1/p2 in a,
// components c1/c2 in a/p1.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  useOpenChoreoQuery: (key: any[], _fn: unknown, opts?: any) => {
    if (opts && opts.enabled === false)
      return { data: undefined, loading: false };
    const catalog: Record<string, any[]> = {
      'cost-insights-filter-namespaces': [option('a'), option('b')],
      'cost-insights-filter-projects': [option('a/p1'), option('a/p2')],
      'cost-insights-filter-components': [option('a/p1/c1'), option('a/p1/c2')],
    };
    return { data: catalog[key[0]] ?? [], loading: false };
  },
}));

// Surface each filter's props as data attributes, plus buttons for the two
// selections that matter: one value, or every value.
jest.mock('@openchoreo/backstage-design-system', () => ({
  MultiSelectFilter: ({
    label,
    allValues,
    selected,
    onChange,
    disabled,
    disabledHint,
  }: any) => (
    <div
      data-testid={`filter-${label}`}
      data-disabled={String(Boolean(disabled))}
      data-hint={disabledHint ?? ''}
      data-selected={[...selected].sort().join(',')}
    >
      <button
        type="button"
        data-testid={`only-${label}`}
        onClick={() => onChange(new Set(allValues.slice(0, 1)))}
      >
        only {label}
      </button>
      <button
        type="button"
        data-testid={`all-${label}`}
        onClick={() => onChange(new Set(allValues))}
      >
        all {label}
      </button>
    </div>
  ),
}));

const empty: CostScopeSelection = {
  namespaces: [],
  projects: [],
  components: [],
};

const renderFilters = (
  selection: CostScopeSelection = empty,
  onChange = jest.fn(),
) => {
  render(
    <CostInsightsScopeFilters selection={selection} onChange={onChange} />,
  );
  return onChange;
};

describe('CostInsightsScopeFilters', () => {
  beforeEach(() => {
    (useApi as jest.Mock).mockReturnValue({ getEntities: jest.fn() });
  });

  it('ticks every option of an unfiltered tier', () => {
    renderFilters();
    expect(screen.getByTestId('filter-Namespaces')).toHaveAttribute(
      'data-selected',
      'a,b',
    );
  });

  it('disables projects until a single namespace is selected', () => {
    renderFilters();
    expect(screen.getByTestId('filter-Projects')).toHaveAttribute(
      'data-disabled',
      'true',
    );
    expect(screen.getByTestId('filter-Projects')).toHaveAttribute(
      'data-hint',
      'Select a single namespace in order to filter by projects',
    );
  });

  it('enables projects for a single namespace, with all of them ticked', () => {
    renderFilters({ ...empty, namespaces: ['a'] });
    const projects = screen.getByTestId('filter-Projects');
    expect(projects).toHaveAttribute('data-disabled', 'false');
    expect(projects).toHaveAttribute('data-selected', 'a/p1,a/p2');
    expect(screen.getByTestId('filter-Components')).toHaveAttribute(
      'data-disabled',
      'true',
    );
  });

  it('enables components once a single project is selected', () => {
    renderFilters({
      namespaces: ['a'],
      projects: [{ namespace: 'a', name: 'p1' }],
      components: [],
    });
    const components = screen.getByTestId('filter-Components');
    expect(components).toHaveAttribute('data-disabled', 'false');
    expect(components).toHaveAttribute('data-selected', 'a/p1/c1,a/p1/c2');
  });

  it('disables components again when several projects are selected', () => {
    renderFilters({
      namespaces: ['a'],
      projects: [
        { namespace: 'a', name: 'p1' },
        { namespace: 'a', name: 'p2' },
      ],
      components: [],
    });
    expect(screen.getByTestId('filter-Components')).toHaveAttribute(
      'data-disabled',
      'true',
    );
    expect(screen.getByTestId('filter-Components')).toHaveAttribute(
      'data-hint',
      'Select a single project in order to filter by components',
    );
  });

  it('narrowing to one project drops the component selection', () => {
    const onChange = renderFilters({
      namespaces: ['a'],
      projects: [],
      components: [{ namespace: 'a', project: 'p1', name: 'c1' }],
    });

    fireEvent.click(screen.getByTestId('only-Projects'));

    expect(onChange).toHaveBeenCalledWith({
      namespaces: ['a'],
      projects: [{ namespace: 'a', name: 'p1' }],
      components: [],
    });
  });

  it('stores a full selection as an empty one', () => {
    const onChange = renderFilters({ ...empty, namespaces: ['a'] });

    fireEvent.click(screen.getByTestId('all-Projects'));

    expect(onChange).toHaveBeenCalledWith({
      namespaces: ['a'],
      projects: [],
      components: [],
    });
  });

  it('resets the tiers below when the namespaces change', () => {
    const onChange = renderFilters({
      namespaces: ['a'],
      projects: [{ namespace: 'a', name: 'p1' }],
      components: [{ namespace: 'a', project: 'p1', name: 'c1' }],
    });

    fireEvent.click(screen.getByTestId('only-Namespaces'));

    expect(onChange).toHaveBeenCalledWith({
      namespaces: ['a'],
      projects: [],
      components: [],
    });
  });
});
