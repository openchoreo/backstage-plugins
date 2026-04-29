import { render, screen } from '@testing-library/react';
import { ChartTooltip } from './ChartTooltip';

const payload = [
  { dataKey: 'cpuUsage', name: 'CPU Usage', value: 1.58, color: '#8884d8' },
  { dataKey: 'cpuLimits', name: 'CPU Limits', value: 100, color: '#ffc658' },
];

describe('ChartTooltip', () => {
  it('renders nothing when inactive', () => {
    const { container } = render(
      <ChartTooltip active={false} payload={payload} label={1000} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when payload is empty', () => {
    const { container } = render(
      <ChartTooltip active payload={[]} label={1000} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders raw label when no labelFormatter provided', () => {
    render(<ChartTooltip active payload={payload} label="Apr 29, 2026" />);
    expect(screen.getByText('Apr 29, 2026')).toBeInTheDocument();
  });

  it('renders formatted label via labelFormatter', () => {
    render(
      <ChartTooltip
        active
        payload={payload}
        label={0}
        labelFormatter={() => 'Formatted Label'}
      />,
    );
    expect(screen.getByText('Formatted Label')).toBeInTheDocument();
  });

  it('renders each payload entry name', () => {
    render(<ChartTooltip active payload={payload} label="t" />);
    expect(screen.getByText(/CPU Usage/)).toBeInTheDocument();
    expect(screen.getByText(/CPU Limits/)).toBeInTheDocument();
  });

  it('applies formatter to entry values', () => {
    render(
      <ChartTooltip
        active
        payload={payload}
        label="t"
        formatter={(v: number) => `${v} mCPU`}
      />,
    );
    expect(screen.getByText(/1\.58 mCPU/)).toBeInTheDocument();
    expect(screen.getByText(/100 mCPU/)).toBeInTheDocument();
  });

  it('renders raw value when no formatter provided', () => {
    render(<ChartTooltip active payload={payload} label="t" />);
    expect(screen.getByText(/1\.58/)).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });
});
