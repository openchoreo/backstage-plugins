import { render, screen } from '@testing-library/react';
import { ChangesPreview } from './ChangesPreview';
import type { Change } from '@openchoreo/backstage-plugin-react';

// ---- Tests ----

describe('ChangesPreview', () => {
  it('shows correct count for single change', () => {
    const changes: Change[] = [
      { type: 'new', path: 'image', newValue: 'node:18' },
    ];

    render(<ChangesPreview changes={changes} />);

    expect(screen.getByText('Confirm Changes (1 change)')).toBeInTheDocument();
  });

  it('shows correct count for multiple changes', () => {
    const changes: Change[] = [
      { type: 'new', path: 'image', newValue: 'node:18' },
      { type: 'removed', path: 'debug', oldValue: true },
    ];

    render(<ChangesPreview changes={changes} />);

    expect(
      screen.getByText('Confirm Changes (2 changes)'),
    ).toBeInTheDocument();
  });

  it('renders new change with [New] label and value', () => {
    const changes: Change[] = [
      { type: 'new', path: 'timeout', newValue: '30m' },
    ];

    render(<ChangesPreview changes={changes} />);

    expect(screen.getByText(/timeout/)).toBeInTheDocument();
    expect(screen.getByText('[New]')).toBeInTheDocument();
    expect(screen.getByText(/30m/)).toBeInTheDocument();
  });

  it('renders modified change with old → new values', () => {
    const changes: Change[] = [
      { type: 'modified', path: 'replicas', oldValue: 1, newValue: 3 },
    ];

    render(<ChangesPreview changes={changes} />);

    expect(screen.getByText(/replicas/)).toBeInTheDocument();
    // The modified line contains "1 → 3"
    expect(screen.getByText(/1 →/)).toBeInTheDocument();
  });

  it('renders removed change with [Removed] label', () => {
    const changes: Change[] = [
      { type: 'removed', path: 'debug', oldValue: true },
    ];

    render(<ChangesPreview changes={changes} />);

    expect(screen.getByText(/debug/)).toBeInTheDocument();
    expect(screen.getByText('[Removed]')).toBeInTheDocument();
  });

  it('formats null values as "null"', () => {
    const changes: Change[] = [
      { type: 'new', path: 'field', newValue: null },
    ];

    render(<ChangesPreview changes={changes} />);

    expect(screen.getByText(/null/)).toBeInTheDocument();
  });

  it('formats object values as JSON', () => {
    const changes: Change[] = [
      { type: 'new', path: 'config', newValue: { key: 'val' } },
    ];

    render(<ChangesPreview changes={changes} />);

    expect(screen.getByText(/{"key":"val"}/)).toBeInTheDocument();
  });

  it('shows footer text about updating workflow config', () => {
    render(<ChangesPreview changes={[]} />);

    expect(
      screen.getByText(
        'This will update the workflow configuration for the component.',
      ),
    ).toBeInTheDocument();
  });
});
