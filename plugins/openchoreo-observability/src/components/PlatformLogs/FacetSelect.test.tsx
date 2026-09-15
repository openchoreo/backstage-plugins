import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FacetSelect } from './FacetSelect';

type FacetSelectProps = Parameters<typeof FacetSelect>[0];

/**
 * Holds `open` the way the filter row does, so the component behaves as it does in the
 * app: it reports that it wants to open or close, and something else decides.
 */
const Harness = ({
  onOpenChange,
  ...props
}: Omit<FacetSelectProps, 'open' | 'onOpenChange'> & {
  onOpenChange?: (open: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <FacetSelect
      {...props}
      open={open}
      onOpenChange={isOpen => {
        setOpen(isOpen);
        onOpenChange?.(isOpen);
      }}
    />
  );
};

const renderSelect = (props: Partial<FacetSelectProps> = {}) => {
  const onChange = jest.fn();
  const onOpenChange = jest.fn();
  render(
    <Harness
      label="Namespaces"
      options={['cert-manager', 'openchoreo-control-plane']}
      selected={[]}
      onChange={onChange}
      onOpenChange={onOpenChange}
      {...props}
    />,
  );
  return { onChange, onOpenChange };
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

  // The list is never complete: the observer caps it and bounds it by the window, and
  // the fallback only knows what the loaded rows mentioned. Without this the picker
  // would be strictly less capable than the text box it replaced.
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
          <Harness
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

describe('FacetSelect values from the observer', () => {
  it('shows how many records carry each value', async () => {
    renderSelect({
      options: ['openchoreo-control-plane', 'cert-manager'],
      counts: { 'openchoreo-control-plane': 412, 'cert-manager': 1088 },
    });

    await userEvent.click(screen.getByLabelText('Namespaces'));

    expect(screen.getByText('412')).toBeInTheDocument();
    // Grouped, because a bare 1088 next to 412 reads as the smaller number.
    expect(screen.getByText('1,088')).toBeInTheDocument();
  });

  // The fallback values are derived from loaded rows and carry no count. A zero would
  // be a lie, so nothing is shown at all.
  it('shows no count for a value that has none', async () => {
    renderSelect({
      options: ['openchoreo-control-plane', 'cert-manager'],
      counts: { 'openchoreo-control-plane': 412 },
    });

    await userEvent.click(screen.getByLabelText('Namespaces'));

    expect(screen.getByText('412')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /cert-manager/ }),
    ).toBeInTheDocument();
  });

  it('reports opening and closing rather than deciding for itself', async () => {
    const { onOpenChange } = renderSelect();

    await userEvent.click(screen.getByLabelText('Namespaces'));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    fireEvent.mouseDown(document.body);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('reports what is typed, for narrowing the values', async () => {
    const onSearchChange = jest.fn();
    renderSelect({ onSearchChange });

    await userEvent.type(screen.getByLabelText('Namespaces'), 'cert');

    expect(onSearchChange).toHaveBeenLastCalledWith('cert');
  });

  // Selecting an option makes MUI clear the input, which arrives here as a change with
  // reason 'reset'. Treated as a search it would leave the next picker narrowed by text
  // nobody can see.
  it('clears the reported search when a value is selected', async () => {
    const onSearchChange = jest.fn();
    renderSelect({ onSearchChange });

    await userEvent.type(screen.getByLabelText('Namespaces'), 'cert');
    await userEvent.click(screen.getByRole('option', { name: /cert-manager/ }));

    expect(onSearchChange).toHaveBeenLastCalledWith('');
  });

  it('shows progress while the values are being fetched', () => {
    renderSelect({ loading: true });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
