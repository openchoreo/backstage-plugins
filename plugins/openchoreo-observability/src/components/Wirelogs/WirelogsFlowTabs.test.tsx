import { fireEvent, render, screen } from '@testing-library/react';
import { WirelogsFlowTabs, copyText } from './WirelogsFlowTabs';
import type { WirelogFlow } from './types';

jest.mock('@openchoreo/backstage-design-system', () => ({
  JsonViewer: ({ value }: any) => (
    <pre data-testid="json-viewer">{JSON.stringify(value)}</pre>
  ),
}));

const baseFlow = (): WirelogFlow => ({
  uuid: 'flow-1',
  verdict: 'FORWARDED',
  traffic_direction: 'INGRESS',
  Type: 'L7',
  source: {
    pod_name: 'src-pod',
    namespace: 'src-ns',
    labels: ['k8s:openchoreo.dev/component=src-comp'],
  },
  destination: {
    pod_name: 'dst-pod',
    namespace: 'dst-ns',
  },
  l4: { TCP: { source_port: 50000, destination_port: 8080 } },
  IP: { source: '10.0.0.1', destination: '10.0.0.2' },
});

describe('WirelogsFlowTabs', () => {
  it('renders the overview panel by default with endpoints + networking', () => {
    render(<WirelogsFlowTabs flow={baseFlow()} />);
    expect(screen.getByText('Endpoints')).toBeInTheDocument();
    expect(screen.getByText('Networking')).toBeInTheDocument();
    expect(screen.getByText('src-pod')).toBeInTheDocument();
    expect(screen.getByText('dst-pod')).toBeInTheDocument();
    // formatAddress puts ip:port in the kv value column.
    expect(screen.getByText('10.0.0.1:50000')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.2:8080')).toBeInTheDocument();
  });

  it('renders the drop banner when the flow is dropped', () => {
    render(
      <WirelogsFlowTabs
        flow={{
          ...baseFlow(),
          verdict: 'DROPPED',
          drop_reason_desc: 'POLICY_DENIED',
        }}
      />,
    );
    expect(screen.getByText(/Policy denied/)).toBeInTheDocument();
  });

  it('shows method/url for L7 request flows', () => {
    render(
      <WirelogsFlowTabs
        flow={{
          ...baseFlow(),
          l7: {
            type: 'REQUEST',
            http: { method: 'POST', url: 'https://api/orders' },
          },
        }}
      />,
    );
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('https://api/orders')).toBeInTheDocument();
  });

  it('shows the status code for L7 response flows', () => {
    render(
      <WirelogsFlowTabs
        flow={{
          ...baseFlow(),
          l7: { type: 'RESPONSE', http: { code: 502 } },
        }}
      />,
    );
    // The kv value renders the code as a string.
    expect(screen.getByText('502')).toBeInTheDocument();
  });

  it('shows the headers tab only for L7 flows and switches to it', () => {
    render(
      <WirelogsFlowTabs
        flow={{
          ...baseFlow(),
          l7: {
            type: 'REQUEST',
            http: {
              method: 'GET',
              url: '/',
              headers: [
                { key: 'x-test', value: 'a' },
                { key: 'authorization', value: 'b' },
              ],
            },
          },
        }}
      />,
    );

    const headersTab = screen.getByRole('tab', { name: /Headers/i });
    fireEvent.click(headersTab);

    expect(screen.getByText('x-test')).toBeInTheDocument();
    expect(screen.getByText('authorization')).toBeInTheDocument();
  });

  it('hides the headers tab when the flow is not L7', () => {
    render(<WirelogsFlowTabs flow={{ ...baseFlow(), l7: undefined }} />);
    expect(
      screen.queryByRole('tab', { name: /Headers/i }),
    ).not.toBeInTheDocument();
  });

  it('shows empty-headers message when L7 has no captured headers', () => {
    render(
      <WirelogsFlowTabs
        flow={{
          ...baseFlow(),
          l7: { type: 'REQUEST', http: { method: 'GET', url: '/' } },
        }}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Headers/i }));
    expect(
      screen.getByText(/No request headers captured/i),
    ).toBeInTheDocument();
  });

  it('renders the raw tab with a JSON dump and a copy button', () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const flow = baseFlow();
    render(<WirelogsFlowTabs flow={flow} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Raw' }));

    expect(screen.getByTestId('json-viewer')).toHaveTextContent('flow-1');

    fireEvent.click(screen.getByText('Copy as JSON'));
    expect(writeText).toHaveBeenCalledWith(JSON.stringify(flow, null, 2));
  });
});

describe('copyText', () => {
  it('writes through navigator.clipboard.writeText when available', () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    copyText('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('silently no-ops when navigator.clipboard is missing', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    // should not throw.
    expect(() => copyText('hello')).not.toThrow();
  });

  it('swallows clipboard rejection', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    expect(() => copyText('x')).not.toThrow();
    // give the rejection a microtask to settle without producing unhandled.
    await Promise.resolve();
  });
});
