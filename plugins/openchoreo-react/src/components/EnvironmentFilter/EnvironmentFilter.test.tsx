import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvironmentFilter, EnvironmentFilterProps } from './EnvironmentFilter';
import { Environment } from './types';

// ---- Helpers ----

const envs: Environment[] = [
  { name: 'dev', displayName: 'Development', namespace: 'ns-1' },
  { name: 'stage', displayName: 'Staging', namespace: 'ns-1' },
  { name: 'prod', namespace: 'ns-1' }, // no displayName — falls back to name
];

function renderFilter(overrides: Partial<EnvironmentFilterProps> = {}) {
  const onChange = jest.fn();
  const props: EnvironmentFilterProps = {
    value: null,
    onChange,
    environments: envs,
    ...overrides,
  };
  return {
    onChange,
    ...render(<EnvironmentFilter {...props} />),
  };
}

// Material-UI hides the actual <select> behind a button-like trigger.
const openSelect = async () => {
  const trigger = screen.getByRole('button', { name: /environment/i });
  await userEvent.click(trigger);
};

describe('EnvironmentFilter', () => {
  it('renders an option per environment, labeled with displayName || name', async () => {
    renderFilter();
    await openSelect();
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual([
      'Development',
      'Staging',
      'prod',
    ]);
  });

  it('shows a single disabled "No environments" item when the list is empty', async () => {
    renderFilter({ environments: [] });
    await openSelect();
    const listbox = screen.getByRole('listbox');
    const items = within(listbox).getAllByRole('option');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/no environments/i);
    expect(items[0]).toHaveAttribute('aria-disabled', 'true');
  });

  it('calls onChange with the full Environment object when a different option is picked', async () => {
    const { onChange } = renderFilter({ value: envs[0] });
    await openSelect();
    await userEvent.click(screen.getByRole('option', { name: 'Staging' }));
    expect(onChange).toHaveBeenCalledWith(envs[1]);
  });

  it('renders a Skeleton placeholder when loading=true (no Select rendered)', () => {
    renderFilter({ loading: true });
    // The Select isn't rendered at all while loading.
    expect(screen.queryByRole('button', { name: /environment/i })).toBeNull();
  });

  it('reflects the selected value as the trigger label', () => {
    renderFilter({ value: envs[1] });
    expect(
      screen.getByRole('button', { name: /environment/i }),
    ).toHaveTextContent('Staging');
  });

  it('renders the Select straight away when loading is omitted', () => {
    // loading defaults to false.
    renderFilter({ loading: undefined });
    expect(
      screen.getByRole('button', { name: /environment/i }),
    ).toBeInTheDocument();
  });

  describe('isEnvDisabled + disabledTooltip', () => {
    it('renders matching options with aria-disabled', async () => {
      renderFilter({
        isEnvDisabled: env => env.name === 'prod',
      });
      await openSelect();
      const prodOption = screen.getByRole('option', { name: 'prod' });
      expect(prodOption).toHaveAttribute('aria-disabled', 'true');
    });

    it('wraps disabled options in a Tooltip, with a dynamic title per env', async () => {
      const tooltipFn = jest.fn(
        (env: Environment) => `Cannot use ${env.name} — Cilium missing`,
      );
      renderFilter({
        isEnvDisabled: env => env.name === 'prod',
        disabledTooltip: tooltipFn,
      });
      await openSelect();
      // The tooltip-fn is invoked once per disabled env during render.
      expect(tooltipFn).toHaveBeenCalledWith(envs[2]);
      // And the disabled option is still rendered (wrapped) — assert by text.
      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('prod')).toBeInTheDocument();
    });

    it('accepts a static-string disabledTooltip', async () => {
      renderFilter({
        isEnvDisabled: env => env.name === 'prod',
        disabledTooltip: 'Runtime obs unavailable',
      });
      await openSelect();
      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('prod')).toBeInTheDocument();
    });

    it('renders enabled options without the disabled attribute', async () => {
      renderFilter({
        isEnvDisabled: env => env.name === 'prod',
      });
      await openSelect();
      const devOption = screen.getByRole('option', { name: 'Development' });
      expect(devOption).not.toHaveAttribute('aria-disabled', 'true');
    });
  });
});
