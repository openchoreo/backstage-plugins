import { render, screen } from '@testing-library/react';
import { BuildStatusChip } from './BuildStatusChip';

// ---- Tests ----

describe('BuildStatusChip', () => {
  it('renders success chip for "Succeeded" status', () => {
    render(<BuildStatusChip status="Succeeded" />);
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
  });

  it('renders success chip for "Completed" status', () => {
    render(<BuildStatusChip status="Completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders error chip for "Failed" status', () => {
    render(<BuildStatusChip status="Failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders error chip for "Error" status', () => {
    render(<BuildStatusChip status="Error" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders running chip for "Running" status', () => {
    render(<BuildStatusChip status="Running" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('renders running chip for "InProgress" status', () => {
    render(<BuildStatusChip status="InProgress" />);
    expect(screen.getByText('InProgress')).toBeInTheDocument();
  });

  it('renders pending chip for "Pending" status', () => {
    render(<BuildStatusChip status="Pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders pending chip for "Queued" status', () => {
    render(<BuildStatusChip status="Queued" />);
    expect(screen.getByText('Queued')).toBeInTheDocument();
  });

  it('renders "Unknown" when status is undefined', () => {
    render(<BuildStatusChip status={undefined} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('renders fallback chip for unrecognized status', () => {
    render(<BuildStatusChip status="SomeOtherStatus" />);
    expect(screen.getByText('SomeOtherStatus')).toBeInTheDocument();
  });
});
