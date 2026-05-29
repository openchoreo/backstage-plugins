import { fireEvent, render, screen } from '@testing-library/react';
import { WirelogsFilter } from './WirelogsFilter';

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  EnvironmentFilter: ({ value, onChange, environments, disabled }: any) => (
    <select
      data-testid="env"
      value={value?.name ?? ''}
      disabled={disabled}
      onChange={e =>
        onChange(environments.find((env: any) => env.name === e.target.value))
      }
    >
      <option value="">--</option>
      {environments.map((env: any) => (
        <option key={env.name} value={env.name}>
          {env.name}
        </option>
      ))}
    </select>
  ),
}));

// Skip the 1s debounce — call onChange immediately on input.
jest.mock('../../hooks/useDebouncedSearch', () => ({
  useDebouncedSearch: (
    initial: string,
    onChange: (value: string) => void,
  ): [string, (e: any) => void] => [
    initial,
    (e: any) => onChange(e.target.value),
  ],
}));

const env = {
  name: 'dev',
  namespace: 'dev-ns',
  isProduction: false,
  createdAt: '2026-01-01T00:00:00Z',
};

function defaults() {
  return {
    filters: { environment: env as any, searchQuery: '' },
    onFiltersChange: jest.fn(),
    environments: [env as any],
    environmentsLoading: false,
    status: 'idle' as const,
    onStart: jest.fn(),
    onStop: jest.fn(),
    onClear: jest.fn(),
    onDownload: jest.fn(),
  };
}

describe('WirelogsFilter', () => {
  it('renders Start when idle and fires onStart when clicked', () => {
    const props = defaults();
    render(<WirelogsFilter {...props} />);
    fireEvent.click(screen.getByText('Start stream'));
    expect(props.onStart).toHaveBeenCalled();
  });

  it('disables Start when no environment selected', () => {
    const props = defaults();
    render(
      <WirelogsFilter
        {...props}
        filters={{ environment: null, searchQuery: '' }}
      />,
    );
    expect(screen.getByText('Start stream').closest('button')).toBeDisabled();
  });

  it('renders Stop while streaming and fires onStop', () => {
    const props = defaults();
    render(<WirelogsFilter {...props} status="streaming" />);
    fireEvent.click(screen.getByText('Stop stream'));
    expect(props.onStop).toHaveBeenCalled();
  });

  it('also renders Stop during the connecting transitional state', () => {
    const props = defaults();
    render(<WirelogsFilter {...props} status="connecting" />);
    expect(screen.getByText('Stop stream')).toBeInTheDocument();
  });

  it('fires onClear / onDownload from their toolbar buttons', () => {
    const props = defaults();
    render(<WirelogsFilter {...props} />);
    fireEvent.click(screen.getByText('Clear'));
    fireEvent.click(screen.getByText('Download'));
    expect(props.onClear).toHaveBeenCalled();
    expect(props.onDownload).toHaveBeenCalled();
  });

  it('propagates search input through onFiltersChange', () => {
    const props = defaults();
    render(<WirelogsFilter {...props} />);
    fireEvent.change(screen.getByPlaceholderText(/Filter flows by verdict/i), {
      target: { value: 'foo' },
    });
    expect(props.onFiltersChange).toHaveBeenCalledWith({ searchQuery: 'foo' });
  });

  it('propagates environment change through onFiltersChange', () => {
    const props = defaults();
    const stg = {
      name: 'stg',
      namespace: 'stg-ns',
      isProduction: false,
      createdAt: '2026-01-01T00:00:00Z',
    };
    render(
      <WirelogsFilter {...props} environments={[env as any, stg as any]} />,
    );
    fireEvent.change(screen.getByTestId('env'), { target: { value: 'stg' } });
    expect(props.onFiltersChange).toHaveBeenCalledWith({
      environment: expect.objectContaining({ name: 'stg' }),
    });
  });
});
