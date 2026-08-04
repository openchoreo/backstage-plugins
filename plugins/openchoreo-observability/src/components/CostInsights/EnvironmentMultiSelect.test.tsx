import { render, screen, fireEvent, within } from '@testing-library/react';
import { EnvironmentMultiSelect } from './EnvironmentMultiSelect';
import type { Environment } from '@openchoreo/backstage-plugin-react';

const environments: Environment[] = [
  { name: 'dev', namespace: 'default', displayName: 'Development' },
  { name: 'prod', namespace: 'default', displayName: 'Production' },
];

const getTrigger = () =>
  screen.getByRole('textbox', { name: 'Environments' }) as HTMLInputElement;

describe('EnvironmentMultiSelect', () => {
  it('summarises the trigger label from the current selection', () => {
    const { rerender } = render(
      <EnvironmentMultiSelect
        environments={environments}
        value={[]}
        onChange={jest.fn()}
      />,
    );
    expect(getTrigger().value).toBe('Select environments');

    rerender(
      <EnvironmentMultiSelect
        environments={environments}
        value={['dev']}
        onChange={jest.fn()}
      />,
    );
    // A single selection shows the environment's display name.
    expect(getTrigger().value).toBe('Development');

    rerender(
      <EnvironmentMultiSelect
        environments={environments}
        value={['dev', 'prod']}
        onChange={jest.fn()}
      />,
    );
    // Multiple selections list each environment's display name.
    expect(getTrigger().value).toBe('Development, Production');
  });

  it('adds an unchecked environment to the selection on click', () => {
    const onChange = jest.fn();
    render(
      <EnvironmentMultiSelect
        environments={environments}
        value={['dev']}
        onChange={onChange}
      />,
    );
    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByText('Production'));
    expect(onChange).toHaveBeenCalledWith(['dev', 'prod']);
  });

  it('removes an already-selected environment on click', () => {
    const onChange = jest.fn();
    render(
      <EnvironmentMultiSelect
        environments={environments}
        value={['dev', 'prod']}
        onChange={onChange}
      />,
    );
    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByText('Development'));
    expect(onChange).toHaveBeenCalledWith(['prod']);
  });

  it('renders a skeleton instead of the control while loading', () => {
    render(
      <EnvironmentMultiSelect
        environments={[]}
        value={[]}
        onChange={jest.fn()}
        loading
      />,
    );
    expect(
      screen.queryByRole('textbox', { name: 'Environments' }),
    ).not.toBeInTheDocument();
  });

  it('shows a "No environments" note when the list is empty', () => {
    render(
      <EnvironmentMultiSelect
        environments={[]}
        value={[]}
        onChange={jest.fn()}
      />,
    );
    fireEvent.click(getTrigger());
    // The popover is portalled; scope the query to the presentation menu.
    const menu = screen.getByRole('presentation');
    expect(within(menu).getByText('No environments')).toBeInTheDocument();
  });
});
