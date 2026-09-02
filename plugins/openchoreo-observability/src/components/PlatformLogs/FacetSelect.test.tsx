import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FacetSelect } from './FacetSelect';

const renderSelect = (
  props: Partial<Parameters<typeof FacetSelect>[0]> = {},
) => {
  const onChange = jest.fn();
  render(
    <FacetSelect
      label="Namespaces"
      options={['cert-manager', 'openchoreo-control-plane']}
      selected={[]}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
};

describe('FacetSelect', () => {
  it('reads as All when nothing is selected', () => {
    renderSelect();

    expect(screen.getByPlaceholderText('All')).toBeInTheDocument();
  });

  it('offers the values seen so far', async () => {
    renderSelect();

    await userEvent.click(screen.getByLabelText('Namespaces'));

    expect(
      screen.getByRole('option', { name: 'openchoreo-control-plane' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'cert-manager' }),
    ).toBeInTheDocument();
  });

  it('selects a value from the list', async () => {
    const { onChange } = renderSelect();

    await userEvent.click(screen.getByLabelText('Namespaces'));
    await userEvent.click(screen.getByRole('option', { name: 'cert-manager' }));

    expect(onChange).toHaveBeenCalledWith(['cert-manager']);
  });

  // The options come from loaded results, never a complete list — a pod that has not
  // logged in the current window is missing from it. Without this the picker would be
  // strictly less capable than the text box it replaced.
  it('accepts a value that is not in the list', async () => {
    const { onChange } = renderSelect();

    await userEvent.type(
      screen.getByLabelText('Namespaces'),
      'never-seen{enter}',
    );

    expect(onChange).toHaveBeenCalledWith(['never-seen']);
  });

  it('trims typed values', async () => {
    const { onChange } = renderSelect();

    await userEvent.type(
      screen.getByLabelText('Namespaces'),
      '  spaced  {enter}',
    );

    expect(onChange).toHaveBeenCalledWith(['spaced']);
  });

  it('renders the current selection as chips', () => {
    renderSelect({ selected: ['cert-manager', 'openbao'] });

    expect(screen.getByText('cert-manager')).toBeInTheDocument();
    expect(screen.getByText('openbao')).toBeInTheDocument();
  });

  it('still renders with no options yet', () => {
    renderSelect({ options: [] });

    expect(screen.getByPlaceholderText('All')).toBeInTheDocument();
  });
});
