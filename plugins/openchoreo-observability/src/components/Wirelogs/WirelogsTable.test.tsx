import { render, screen, fireEvent } from '@testing-library/react';
import { WirelogsTable, matchesSearch } from './WirelogsTable';
import type { WirelogEvent } from './types';

// JsonViewer is loaded via the drawer's tabs; stub it to avoid pulling in the
// design-system editor (which expects a richer DOM than jsdom provides).
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
      time: '2026-01-01T10:00:00.000Z',
      verdict: 'FORWARDED',
      traffic_direction: 'INGRESS',
      Type: 'L3_L4',
      source: { pod_name: 'src-pod', namespace: 'src-ns' },
      destination: { pod_name: 'dst-pod', namespace: 'dst-ns' },
      l4: { TCP: { source_port: 50000, destination_port: 8080 } },
      ...overrides,
    },
  };
}

describe('matchesSearch', () => {
  const event = makeEvent({
    uuid: 'abc-uuid',
    IP: { source: '10.0.0.1', destination: '10.0.0.2' },
    l7: { http: { method: 'GET', url: 'https://api/users', code: 200 } },
  });

  it.each([
    ['empty query matches everything', ''],
    ['uuid', 'abc-uuid'],
    ['pod name', 'src-pod'],
    ['namespace', 'dst-ns'],
    ['source IP', '10.0.0.1'],
    ['destination IP', '10.0.0.2'],
    ['HTTP method', 'get'],
    ['URL substring', 'api/users'],
    ['HTTP status code', '200'],
    ['source port', '50000'],
    ['destination port', '8080'],
    ['verdict', 'forwarded'],
  ])('matches by %s', (_label, query) => {
    expect(matchesSearch(event, query)).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(matchesSearch(event, 'no-such-token')).toBe(false);
  });
});

describe('WirelogsTable', () => {
  it('renders the streaming empty-state message when streaming', () => {
    render(<WirelogsTable flows={[]} isStreaming />);
    expect(screen.getByText(/Waiting for traffic/i)).toBeInTheDocument();
  });

  it('renders the idle empty-state message when not streaming', () => {
    render(<WirelogsTable flows={[]} isStreaming={false} />);
    expect(screen.getByText(/Press Start stream/i)).toBeInTheDocument();
  });

  it('renders flow rows with verdict, type, endpoints and summary', () => {
    render(
      <WirelogsTable
        flows={[
          makeEvent({
            uuid: 'a',
            verdict: 'FORWARDED',
            l7: {
              type: 'REQUEST',
              http: { method: 'GET', url: 'https://api/users' },
            },
          }),
        ]}
        isStreaming
      />,
    );
    expect(screen.getByText('Forwarded')).toBeInTheDocument();
    expect(screen.getByText('L7')).toBeInTheDocument();
    expect(screen.getAllByText('GET').length).toBeGreaterThan(0);
    expect(screen.getByText('src-pod')).toBeInTheDocument();
    expect(screen.getByText('dst-pod')).toBeInTheDocument();
  });

  it('opens the drawer when a row is clicked', () => {
    render(
      <WirelogsTable
        flows={[
          makeEvent({
            uuid: 'click-me',
            l7: {
              type: 'REQUEST',
              http: { method: 'POST', url: 'https://api/x' },
            },
          }),
        ]}
        isStreaming
      />,
    );
    fireEvent.click(screen.getByText('src-pod'));
    // The drawer header echoes the flow uuid.
    expect(screen.getByText('click-me')).toBeInTheDocument();
  });

  it('renders L7 response summary including status code and latency', () => {
    render(
      <WirelogsTable
        flows={[
          makeEvent({
            uuid: 'resp',
            l7: {
              type: 'RESPONSE',
              latency_ns: 12_000_000,
              http: { code: 404 },
            },
          }),
        ]}
        isStreaming
      />,
    );
    expect(screen.getByText('reply')).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('12ms')).toBeInTheDocument();
  });

  it.each([
    ['DELETE', 'DELETE'],
    ['PUT', 'PUT'],
    ['PATCH', 'PATCH'],
    ['OPTIONS', 'OPTIONS'],
  ])('renders %s method badges via the method class branch', (_, method) => {
    render(
      <WirelogsTable
        flows={[
          makeEvent({
            uuid: method,
            l7: {
              type: 'REQUEST',
              http: { method, url: 'https://api/x' },
            },
          }),
        ]}
        isStreaming
      />,
    );
    expect(screen.getAllByText(method).length).toBeGreaterThan(0);
  });

  it('renders an L4 summary including TCP flags', () => {
    render(
      <WirelogsTable
        flows={[
          makeEvent({
            uuid: 'l4',
            l4: {
              TCP: {
                source_port: 50000,
                destination_port: 443,
                flags: { SYN: true, ACK: true },
              },
            },
          }),
        ]}
        isStreaming
      />,
    );
    // The summary text glues protocol :port [flags] into one span.
    expect(screen.getByText(/TCP :443 \[SYN,ACK\]/)).toBeInTheDocument();
  });

  it('shows an em-dash for unknown direction', () => {
    render(
      <WirelogsTable
        flows={[makeEvent({ traffic_direction: undefined })]}
        isStreaming
      />,
    );
    // First — comes from DirCell.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
