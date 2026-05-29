import { fireEvent, render, screen } from '@testing-library/react';
import { WirelogsFlowDrawer } from './WirelogsFlowDrawer';
import type { WirelogEvent } from './types';

jest.mock('@openchoreo/backstage-design-system', () => ({
  JsonViewer: ({ value }: any) => (
    <pre data-testid="json-viewer">{JSON.stringify(value)}</pre>
  ),
}));

function makeEvent(
  overrides: Partial<WirelogEvent['flow']> = {},
): WirelogEvent {
  return {
    flow: {
      uuid: 'flow-1',
      verdict: 'FORWARDED',
      Type: 'L3_L4',
      traffic_direction: 'INGRESS',
      l4: { TCP: { destination_port: 8080 } },
      ...overrides,
    },
  };
}

describe('WirelogsFlowDrawer', () => {
  it('does not render any content when event is null', () => {
    render(<WirelogsFlowDrawer event={null} onClose={jest.fn()} />);
    expect(screen.queryByText(/flow-1/)).not.toBeInTheDocument();
  });

  it('renders title, uuid, verdict and tabs when an event is given', () => {
    render(<WirelogsFlowDrawer event={makeEvent()} onClose={jest.fn()} />);
    expect(screen.getByText('flow-1')).toBeInTheDocument();
    expect(screen.getByText('Forwarded')).toBeInTheDocument();
    expect(screen.getAllByText('L3/L4').length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Raw' })).toBeInTheDocument();
  });

  it('uses the DROPPED chip variant and "Dropped" label', () => {
    render(
      <WirelogsFlowDrawer
        event={makeEvent({ verdict: 'DROPPED' })}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Dropped')).toBeInTheDocument();
  });

  it('falls back to "Unknown" for an unrecognised verdict', () => {
    render(
      <WirelogsFlowDrawer
        event={makeEvent({ verdict: undefined })}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('fires onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    render(<WirelogsFlowDrawer event={makeEvent()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
