import {
  directionInfo,
  dropReasonText,
  endpointMeta,
  flowSummary,
  flowTitle,
  formatAddress,
  formatLatency,
  formatTime,
  getDestinationPort,
  getSourcePort,
  isL7,
  isResponse,
  l4Protocol,
  parseLabels,
  tcpFlags,
  typeLabel,
  urlPath,
} from './flowFormat';
import type { WirelogFlow } from './types';

describe('getSourcePort / getDestinationPort / l4Protocol', () => {
  it('reads TCP ports when l4.TCP is set', () => {
    const l4 = { TCP: { source_port: 1234, destination_port: 80 } };
    expect(getSourcePort(l4)).toBe(1234);
    expect(getDestinationPort(l4)).toBe(80);
    expect(l4Protocol(l4)).toBe('TCP');
  });

  it('falls back to UDP ports when l4.TCP is absent', () => {
    const l4 = { UDP: { source_port: 5353, destination_port: 53 } };
    expect(getSourcePort(l4)).toBe(5353);
    expect(getDestinationPort(l4)).toBe(53);
    expect(l4Protocol(l4)).toBe('UDP');
  });

  it('returns undefined when l4 itself is missing', () => {
    expect(getSourcePort(undefined)).toBeUndefined();
    expect(getDestinationPort(undefined)).toBeUndefined();
    expect(l4Protocol(undefined)).toBeUndefined();
    expect(l4Protocol({})).toBeUndefined();
  });
});

describe('tcpFlags', () => {
  it('returns the truthy flags in canonical order', () => {
    expect(
      tcpFlags({ TCP: { flags: { ACK: true, SYN: true, FIN: false } } }),
    ).toEqual(['SYN', 'ACK']);
  });

  it('upper-cases lowercase flag names', () => {
    expect(tcpFlags({ TCP: { flags: { syn: true, ack: true } } })).toEqual([
      'SYN',
      'ACK',
    ]);
  });

  it('places unknown flags after the canonical ones', () => {
    expect(
      tcpFlags({ TCP: { flags: { CUSTOM: true, ACK: true, SYN: true } } }),
    ).toEqual(['SYN', 'ACK', 'CUSTOM']);
  });

  it('returns an empty array when there are no flags', () => {
    expect(tcpFlags(undefined)).toEqual([]);
    expect(tcpFlags({ TCP: {} })).toEqual([]);
    expect(tcpFlags({ TCP: { flags: {} } })).toEqual([]);
  });
});

describe('isL7 / typeLabel', () => {
  it('detects L7 HTTP flows', () => {
    expect(isL7({ l7: { http: { method: 'GET' } } } as WirelogFlow)).toBe(true);
    expect(isL7({} as WirelogFlow)).toBe(false);
    expect(isL7({ l7: {} } as WirelogFlow)).toBe(false);
  });

  it('returns L7 when l7 present even without http', () => {
    expect(typeLabel({ l7: { type: 'REQUEST' } } as WirelogFlow)).toBe('L7');
  });

  it('maps L3_L4 to a slash-separated label', () => {
    expect(typeLabel({ Type: 'L3_L4' } as WirelogFlow)).toBe('L3/L4');
  });

  it('passes through unknown types', () => {
    expect(typeLabel({ Type: 'CUSTOM' } as WirelogFlow)).toBe('CUSTOM');
  });

  it('defaults to L3/L4 when Type is missing', () => {
    expect(typeLabel({} as WirelogFlow)).toBe('L3/L4');
  });

  it('returns L7 when only Type=L7 is set', () => {
    expect(typeLabel({ Type: 'L7' } as WirelogFlow)).toBe('L7');
  });
});

describe('directionInfo', () => {
  it('maps EGRESS to out', () => {
    expect(
      directionInfo({ traffic_direction: 'EGRESS' } as WirelogFlow),
    ).toEqual({ label: 'out', direction: 'out' });
  });

  it('maps INGRESS to in', () => {
    expect(
      directionInfo({ traffic_direction: 'INGRESS' } as WirelogFlow),
    ).toEqual({ label: 'in', direction: 'in' });
  });

  it('returns unknown for missing/unrecognised values', () => {
    expect(directionInfo({} as WirelogFlow)).toEqual({
      label: '—',
      direction: 'unknown',
    });
    expect(
      directionInfo({ traffic_direction: 'WEIRD' } as WirelogFlow),
    ).toEqual({ label: '—', direction: 'unknown' });
  });
});

describe('formatTime', () => {
  it('returns an em-dash when undefined', () => {
    expect(formatTime(undefined)).toBe('—');
  });

  it('returns the input verbatim when not a valid date', () => {
    expect(formatTime('not-a-date')).toBe('not-a-date');
  });

  it('zero-pads hours, minutes, seconds and milliseconds', () => {
    // 04:05:06.078 in local time
    const iso = new Date(2026, 0, 1, 4, 5, 6, 78).toISOString();
    expect(formatTime(iso)).toBe('04:05:06.078');
  });
});

describe('formatAddress', () => {
  it('returns dash when ip is missing', () => {
    expect(formatAddress(undefined, 80)).toBe('—');
  });

  it('returns just the ip when port missing', () => {
    expect(formatAddress('10.0.0.1', undefined)).toBe('10.0.0.1');
  });

  it('joins ip and port with a colon', () => {
    expect(formatAddress('10.0.0.1', 8080)).toBe('10.0.0.1:8080');
  });
});

describe('formatLatency', () => {
  it('returns undefined when ns is undefined or null', () => {
    expect(formatLatency(undefined)).toBeUndefined();
    expect(formatLatency(null as unknown as number)).toBeUndefined();
  });

  it('formats sub-millisecond latency with 2 decimals', () => {
    expect(formatLatency(500_000)).toBe('0.50ms');
  });

  it('rounds millisecond-range latency', () => {
    expect(formatLatency(12_345_678)).toBe('12ms');
  });

  it('switches to seconds above 1000ms', () => {
    expect(formatLatency(2_500_000_000)).toBe('2.50s');
  });
});

describe('urlPath', () => {
  it('returns undefined for empty input', () => {
    expect(urlPath(undefined)).toBeUndefined();
  });

  it('returns the path + search for an absolute url', () => {
    expect(urlPath('https://api.example.com/v1/users?limit=10')).toBe(
      '/v1/users?limit=10',
    );
  });

  it('returns the input when parsing fails', () => {
    expect(urlPath('not a url')).toBe('not a url');
  });
});

describe('parseLabels', () => {
  it('drops source prefix and parses key=value pairs', () => {
    expect(
      parseLabels([
        'k8s:openchoreo.dev/component=api',
        'reserved:remote-node',
        'reserved:foo=bar',
      ]),
    ).toEqual({
      'openchoreo.dev/component': 'api',
      foo: 'bar',
    });
  });

  it('handles bare values without a colon source prefix', () => {
    expect(parseLabels(['plain=value'])).toEqual({ plain: 'value' });
  });

  it('returns empty object when labels is undefined', () => {
    expect(parseLabels(undefined)).toEqual({});
  });
});

describe('endpointMeta', () => {
  it('returns placeholders when endpoint is missing', () => {
    expect(endpointMeta(undefined)).toEqual({
      name: undefined,
      namespace: undefined,
    });
  });

  it('prefers workload name, then pod name, then component, then namespace', () => {
    expect(
      endpointMeta({
        namespace: 'ns',
        pod_name: 'pod-1',
        workloads: [{ name: 'svc', kind: 'Deployment' }],
        labels: ['k8s:openchoreo.dev/component=comp'],
      }),
    ).toEqual({
      name: 'svc',
      namespace: 'ns',
      component: 'comp',
      project: undefined,
      environment: undefined,
    });

    expect(
      endpointMeta({
        namespace: 'ns',
        pod_name: 'pod-1',
        labels: ['k8s:openchoreo.dev/component=comp'],
      }).name,
    ).toBe('pod-1');

    expect(
      endpointMeta({
        namespace: 'ns',
        labels: ['k8s:openchoreo.dev/component=comp'],
      }).name,
    ).toBe('comp');

    expect(endpointMeta({ namespace: 'ns' }).name).toBe('ns');
  });

  it('exposes project and environment labels when present', () => {
    expect(
      endpointMeta({
        namespace: 'ns',
        pod_name: 'pod-1',
        labels: [
          'k8s:openchoreo.dev/project=proj',
          'k8s:openchoreo.dev/environment=dev',
        ],
      }),
    ).toMatchObject({ project: 'proj', environment: 'dev' });
  });
});

describe('isResponse', () => {
  it('returns true when l7.type is RESPONSE', () => {
    expect(isResponse({ l7: { type: 'RESPONSE' } } as WirelogFlow)).toBe(true);
  });

  it('returns false when l7.type is REQUEST', () => {
    expect(isResponse({ l7: { type: 'REQUEST' } } as WirelogFlow)).toBe(false);
  });

  it('uses is_reply as fallback', () => {
    expect(isResponse({ is_reply: true } as WirelogFlow)).toBe(true);
  });

  it('returns true when http has a code but no method', () => {
    expect(isResponse({ l7: { http: { code: 200 } } } as WirelogFlow)).toBe(
      true,
    );
  });

  it('returns false when http has both method and code', () => {
    expect(
      isResponse({
        l7: { http: { method: 'GET', code: 200 } },
      } as WirelogFlow),
    ).toBe(false);
  });
});

describe('flowSummary / flowTitle', () => {
  it('summarises an L7 HTTP request', () => {
    const flow = {
      l7: {
        type: 'REQUEST',
        http: { method: 'GET', url: 'http://x/path?q=1' },
      },
    } as WirelogFlow;
    expect(flowSummary(flow)).toEqual({
      kind: 'l7-request',
      method: 'GET',
      path: '/path?q=1',
    });
    expect(flowTitle(flow)).toBe('GET http://x/path?q=1');
  });

  it('summarises an L7 HTTP response with code + latency', () => {
    const flow = {
      l7: { type: 'RESPONSE', latency_ns: 5_000_000, http: { code: 503 } },
    } as WirelogFlow;
    expect(flowSummary(flow)).toEqual({
      kind: 'l7-response',
      code: 503,
      latency: '5ms',
    });
    expect(flowTitle(flow)).toBe('HTTP 503 response · 5ms');
  });

  it('falls back to HTTP request title when method/url are absent', () => {
    expect(
      flowTitle({ l7: { http: {} }, is_reply: false } as WirelogFlow),
    ).toBe('HTTP request');
  });

  it('summarises an L4 TCP flow', () => {
    const flow = {
      l4: {
        TCP: {
          source_port: 5000,
          destination_port: 80,
          flags: { SYN: true },
        },
      },
    } as WirelogFlow;
    expect(flowSummary(flow)).toEqual({
      kind: 'l4',
      protocol: 'TCP',
      port: 80,
      flags: ['SYN'],
    });
    expect(flowTitle(flow)).toBe('TCP on port 80 [SYN]');
  });

  it('uses source port in L4 title when destination is unset', () => {
    expect(
      flowTitle({
        l4: { TCP: { source_port: 5000 } },
      } as WirelogFlow),
    ).toBe('TCP on port 5000');
  });

  it('falls back to raw Summary for unknown flows', () => {
    expect(flowSummary({ Summary: 'rawline' } as WirelogFlow)).toEqual({
      kind: 'raw',
      text: 'rawline',
    });
    expect(flowTitle({ Summary: 'rawline' } as WirelogFlow)).toBe('rawline');
    expect(flowTitle({} as WirelogFlow)).toBe('Flow');
  });
});

describe('dropReasonText', () => {
  it('maps known drop reasons to a friendly string', () => {
    expect(
      dropReasonText({ drop_reason_desc: 'POLICY_DENIED' } as WirelogFlow),
    ).toBe('Policy denied by L3 (CiliumNetworkPolicy)');
  });

  it('humanises unknown SCREAMING_SNAKE drop reasons', () => {
    expect(
      dropReasonText({ drop_reason_desc: 'INVALID_PACKET' } as WirelogFlow),
    ).toBe('Invalid packet');
  });

  it('falls back to a generic message when no reason is supplied', () => {
    expect(dropReasonText({} as WirelogFlow)).toBe('Flow dropped');
  });
});
