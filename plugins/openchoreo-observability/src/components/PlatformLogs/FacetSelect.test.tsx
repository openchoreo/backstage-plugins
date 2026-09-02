import { fireEvent, render, screen } from '@testing-library/react';
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

    expect(screen.getByText('All')).toBeInTheDocument();
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

  // Chips inside the field made the control grow as it was used, so four side by side
  // never kept a common height. The toolbar chips already say what is applied; this
  // field only has to say how much.
  it('names the value when exactly one is selected', () => {
    renderSelect({ selected: ['cert-manager'] });

    expect(screen.getByText('cert-manager')).toBeInTheDocument();
  });

  it('counts instead of listing beyond one selection', () => {
    renderSelect({ selected: ['cert-manager', 'openbao', 'thunder'] });

    expect(screen.getByText('3 selected')).toBeInTheDocument();
    expect(screen.queryByText('openbao')).not.toBeInTheDocument();
  });

  it('ticks the options that are selected', async () => {
    renderSelect({ selected: ['cert-manager'] });

    await userEvent.click(screen.getByLabelText('Namespaces'));

    const ticked = screen
      .getAllByRole('checkbox')
      .filter(box => (box as HTMLInputElement).checked);
    expect(ticked).toHaveLength(1);
  });

  // MUI's Autocomplete has no click-away handling: it closes only from the input's
  // onBlur, so any click that does not move focus off the input - or that moves focus
  // into the portalled listbox - leaves the popup orphaned and open. These pin the
  // explicit close instead of relying on focus mechanics.
  describe('closing', () => {
    const renderWithOutside = () => {
      const onChange = jest.fn();
      const { container } = render(
        <div>
          <FacetSelect
            label="Namespaces"
            options={['cert-manager', 'openchoreo-control-plane']}
            selected={[]}
            onChange={onChange}
          />
          <div data-testid="elsewhere">some other part of the page</div>
        </div>,
      );
      return { onChange, container };
    };

    it('closes when the mouse goes down anywhere outside', async () => {
      renderWithOutside();
      await userEvent.click(screen.getByLabelText('Namespaces'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      fireEvent.mouseDown(screen.getByTestId('elsewhere'));

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('stays open while picking several options', async () => {
      renderWithOutside();
      await userEvent.click(screen.getByLabelText('Namespaces'));

      const [firstOption] = screen.getAllByRole('option');
      fireEvent.mouseDown(firstOption);

      // Clicking an option is not clicking away.
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // The regression this guards: the outside-click check used to match the listbox by
    // class name, which a nested ThemeProvider silently breaks (MUI appends a counter,
    // giving `MuiAutocomplete-popper-42`). The list then closed on mousedown, before
    // the click could select, and nothing could be picked at all.
    it('selects when the tick box itself is clicked', async () => {
      const { onChange } = renderWithOutside();
      await userEvent.click(screen.getByLabelText('Namespaces'));

      await userEvent.click(screen.getAllByRole('checkbox')[0]);

      expect(onChange).toHaveBeenCalledWith(['cert-manager']);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('keeps the option list inside the field so containment is exact', async () => {
      const { container } = renderWithOutside();
      await userEvent.click(screen.getByLabelText('Namespaces'));

      // disablePortal: the listbox must be a descendant, not moved to document.body.
      expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    });

    // Clicking the field while it is open is MUI's own toggle, not a click away - the
    // outside-click handler has to leave it alone rather than fight it.
    it('lets the field toggle itself shut', async () => {
      renderWithOutside();
      // Captured before opening: once open, the floating label matches too.
      const field = screen.getByLabelText('Namespaces');

      await userEvent.click(field);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      await userEvent.click(field);

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('still renders with no options yet', () => {
    renderSelect({ options: [] });

    expect(screen.getByText('All')).toBeInTheDocument();
  });
});
