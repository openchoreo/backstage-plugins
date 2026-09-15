import { render, screen, fireEvent } from '@testing-library/react';
import { MultiSelectFilter, MultiSelectGroup } from './MultiSelectFilter';

const flatGroups: MultiSelectGroup[] = [
  {
    options: [
      { value: 'component', label: 'Component', count: 6 },
      { value: 'resource', label: 'Resource', count: 2 },
    ],
  },
];

const groupedGroups: MultiSelectGroup[] = [
  {
    label: 'Component Types',
    options: [{ value: 'deployment/service', label: 'deployment/service' }],
  },
  {
    label: 'Resource Types',
    options: [{ value: 'postgres', label: 'postgres' }],
  },
];

const kinds = ['component', 'resource'];

const openMenu = (label: string) =>
  fireEvent.click(screen.getByLabelText(`Filter by ${label.toLowerCase()}`));

describe('MultiSelectFilter', () => {
  it('shows "All" when every value is selected', () => {
    render(
      <MultiSelectFilter
        label="Kind"
        groups={flatGroups}
        allValues={kinds}
        selected={new Set(kinds)}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Filter by kind')).toHaveTextContent(
      'Kind: All',
    );
  });

  it('shows "None" when nothing is selected', () => {
    render(
      <MultiSelectFilter
        label="Kind"
        groups={flatGroups}
        allValues={kinds}
        selected={new Set()}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Filter by kind')).toHaveTextContent(
      'Kind: None',
    );
  });

  it('shows the value when exactly one is selected', () => {
    render(
      <MultiSelectFilter
        label="Kind"
        groups={flatGroups}
        allValues={kinds}
        selected={new Set(['component'])}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Filter by kind')).toHaveTextContent(
      'Kind: Component',
    );
  });

  it('shows "<first in menu order> +N" for a multi-selection', () => {
    const groups: MultiSelectGroup[] = [
      {
        options: [
          { value: 'component', label: 'Component' },
          { value: 'resource', label: 'Resource' },
          { value: 'api', label: 'API' },
        ],
      },
    ];
    render(
      <MultiSelectFilter
        label="Kind"
        groups={groups}
        allValues={['component', 'resource', 'api']}
        selected={new Set(['resource', 'api'])}
        onChange={jest.fn()}
      />,
    );
    // Resource is the first selected in menu order, +1 for API.
    expect(screen.getByLabelText('Filter by kind')).toHaveTextContent(
      'Kind: Resource +1',
    );
  });

  it('opens the menu with options and their counts', () => {
    render(
      <MultiSelectFilter
        label="Kind"
        groups={flatGroups}
        allValues={kinds}
        selected={new Set(kinds)}
        onChange={jest.fn()}
      />,
    );
    openMenu('Kind');
    expect(screen.getByText('Component')).toBeInTheDocument();
    expect(screen.getByText('Resource')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders group headings for grouped options', () => {
    render(
      <MultiSelectFilter
        label="Type"
        groups={groupedGroups}
        allValues={['deployment/service', 'postgres']}
        selected={new Set(['deployment/service', 'postgres'])}
        onChange={jest.fn()}
      />,
    );
    openMenu('Type');
    expect(screen.getByText('Component Types')).toBeInTheDocument();
    expect(screen.getByText('Resource Types')).toBeInTheDocument();
  });

  it('toggles an option off and reports the new selection', () => {
    const onChange = jest.fn();
    render(
      <MultiSelectFilter
        label="Kind"
        groups={flatGroups}
        allValues={kinds}
        selected={new Set(kinds)}
        onChange={onChange}
      />,
    );
    openMenu('Kind');
    fireEvent.click(screen.getByText('Resource'));
    expect(onChange).toHaveBeenCalledWith(new Set(['component']));
  });

  it('Select all and Clear report the full / empty selection', () => {
    const onChange = jest.fn();
    render(
      <MultiSelectFilter
        label="Kind"
        groups={flatGroups}
        allValues={kinds}
        selected={new Set(['component'])}
        onChange={onChange}
      />,
    );
    openMenu('Kind');
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(onChange).toHaveBeenCalledWith(new Set(kinds));

    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith(new Set());
  });

  it('disables Select all when all selected and Clear when none', () => {
    const { rerender } = render(
      <MultiSelectFilter
        label="Kind"
        groups={flatGroups}
        allValues={kinds}
        selected={new Set(kinds)}
        onChange={jest.fn()}
      />,
    );
    openMenu('Kind');
    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled();

    rerender(
      <MultiSelectFilter
        label="Kind"
        groups={flatGroups}
        allValues={kinds}
        selected={new Set()}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Select all' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  describe('fixed options', () => {
    const groups = [
      {
        options: [
          { value: 'time', label: 'Time', disabled: true },
          { value: 'surface', label: 'Surface' },
        ],
      },
    ];

    it('keeps a fixed option out of reach', () => {
      const onChange = jest.fn();
      render(
        <MultiSelectFilter
          label="Columns"
          groups={groups}
          allValues={['time', 'surface']}
          selected={new Set(['time', 'surface'])}
          onChange={onChange}
        />,
      );

      fireEvent.click(screen.getByLabelText('Filter by columns'));
      fireEvent.click(screen.getByText('Time'));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('leaves fixed options selected when clearing', () => {
      const onChange = jest.fn();
      render(
        <MultiSelectFilter
          label="Columns"
          groups={groups}
          allValues={['time', 'surface']}
          selected={new Set(['time', 'surface'])}
          onChange={onChange}
        />,
      );

      fireEvent.click(screen.getByLabelText('Filter by columns'));
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

      // Clearing a view's mandatory columns would leave it unusable.
      expect(onChange).toHaveBeenCalledWith(new Set(['time']));
    });

    it('has nothing left to clear once only the fixed ones remain', () => {
      render(
        <MultiSelectFilter
          label="Columns"
          groups={groups}
          allValues={['time', 'surface']}
          selected={new Set(['time'])}
          onChange={jest.fn()}
        />,
      );

      fireEvent.click(screen.getByLabelText('Filter by columns'));

      expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    });

    it('still offers Clear when a removable value stands in for a fixed one', () => {
      render(
        <MultiSelectFilter
          label="Columns"
          groups={groups}
          allValues={['time', 'surface']}
          selected={new Set(['surface'])}
          onChange={jest.fn()}
        />,
      );

      fireEvent.click(screen.getByLabelText('Filter by columns'));

      expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled();
    });
  });

  it('disables the trigger when there are no selectable values', () => {
    render(
      <MultiSelectFilter
        label="Type"
        groups={[]}
        allValues={[]}
        selected={new Set()}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Filter by type')).toBeDisabled();
  });
});
