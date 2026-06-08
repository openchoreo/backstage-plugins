import type { WirelogEndpoint, WirelogFlow, WirelogL4 } from './types';

const OPENCHOREO_LABEL_PREFIX = 'openchoreo.dev/';

/** Hubble flag-set objects key flags by name; pick the ones set to true. */
const TCP_FLAG_ORDER = ['SYN', 'ACK', 'PSH', 'FIN', 'RST', 'URG', 'ECE', 'CWR'];

export function getSourcePort(l4: WirelogL4 | undefined): number | undefined {
  return l4?.TCP?.source_port ?? l4?.UDP?.source_port;
}

export function getDestinationPort(
  l4: WirelogL4 | undefined,
): number | undefined {
  return l4?.TCP?.destination_port ?? l4?.UDP?.destination_port;
}

export function l4Protocol(l4: WirelogL4 | undefined): string | undefined {
  if (l4?.TCP) return 'TCP';
  if (l4?.UDP) return 'UDP';
  return undefined;
}

export function tcpFlags(l4: WirelogL4 | undefined): string[] {
  const flags = l4?.TCP?.flags;
  if (!flags) return [];
  const set = Object.entries(flags)
    .filter(([, on]) => on)
    .map(([name]) => name.toUpperCase());
  return set.sort((a, b) => {
    const ai = TCP_FLAG_ORDER.indexOf(a);
    const bi = TCP_FLAG_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export function isL7(flow: WirelogFlow): boolean {
  return Boolean(flow.l7?.http);
}

export function typeLabel(flow: WirelogFlow): string {
  if (flow.l7) return 'L7';
  if (flow.Type === 'L3_L4') return 'L3/L4';
  if (flow.Type === 'L7') return 'L7';
  return flow.Type || 'L3/L4';
}

export type FlowDirection = 'in' | 'out' | 'unknown';

export function directionInfo(flow: WirelogFlow): {
  label: string;
  direction: FlowDirection;
} {
  switch (flow.traffic_direction) {
    case 'EGRESS':
      return { label: 'out', direction: 'out' };
    case 'INGRESS':
      return { label: 'in', direction: 'in' };
    default:
      return { label: '—', direction: 'unknown' };
  }
}

export function formatTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function formatAddress(
  ip: string | undefined,
  port: number | undefined,
): string {
  if (!ip) return '—';
  return port ? `${ip}:${port}` : ip;
}

export function formatLatency(ns: number | undefined): string | undefined {
  if (ns === undefined || ns === null) return undefined;
  const ms = ns / 1e6;
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function urlPath(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/**
 * Splits Cilium labels (`<source>:<key>=<value>`) into a key→value map, dropping
 * the source prefix (`k8s:`, `reserved:`, …) so callers can look up by bare key.
 */
export function parseLabels(
  labels: string[] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of labels ?? []) {
    const eq = raw.indexOf('=');
    if (eq === -1) continue;
    let key = raw.slice(0, eq);
    const value = raw.slice(eq + 1);
    const colon = key.indexOf(':');
    if (colon !== -1) key = key.slice(colon + 1);
    out[key] = value;
  }
  return out;
}

export interface EndpointMeta {
  name: string | undefined;
  namespace: string | undefined;
  component?: string;
  project?: string;
  environment?: string;
}

export function endpointMeta(
  endpoint: WirelogEndpoint | undefined,
): EndpointMeta {
  if (!endpoint) {
    return { name: undefined, namespace: undefined };
  }
  const labels = parseLabels(endpoint.labels);
  const component = labels[`${OPENCHOREO_LABEL_PREFIX}component`];
  const project = labels[`${OPENCHOREO_LABEL_PREFIX}project`];
  const environment = labels[`${OPENCHOREO_LABEL_PREFIX}environment`];
  const name =
    endpoint.workloads?.[0]?.name ||
    endpoint.pod_name ||
    component ||
    endpoint.namespace;
  return {
    name,
    namespace: endpoint.namespace,
    component,
    project,
    environment,
  };
}

export type FlowSummary =
  | { kind: 'l7-request'; method?: string; path?: string }
  | { kind: 'l7-response'; code?: number; latency?: string }
  | { kind: 'l4'; protocol?: string; port?: number; flags: string[] }
  | { kind: 'raw'; text?: string };

export function isResponse(flow: WirelogFlow): boolean {
  if (flow.l7?.type === 'RESPONSE') return true;
  if (flow.l7?.type === 'REQUEST') return false;
  if (flow.is_reply) return true;
  const http = flow.l7?.http;
  return Boolean(http && http.code !== undefined && !http.method);
}

export function flowSummary(flow: WirelogFlow): FlowSummary {
  const http = flow.l7?.http;
  if (http) {
    if (isResponse(flow)) {
      return {
        kind: 'l7-response',
        code: http.code,
        latency: formatLatency(flow.l7?.latency_ns),
      };
    }
    return { kind: 'l7-request', method: http.method, path: urlPath(http.url) };
  }
  const protocol = l4Protocol(flow.l4);
  if (protocol) {
    return {
      kind: 'l4',
      protocol,
      port: getDestinationPort(flow.l4),
      flags: tcpFlags(flow.l4),
    };
  }
  return { kind: 'raw', text: flow.Summary };
}

export function flowTitle(flow: WirelogFlow): string {
  const http = flow.l7?.http;
  if (http) {
    if (isResponse(flow)) {
      const latency = formatLatency(flow.l7?.latency_ns);
      const code = http.code !== undefined ? ` ${http.code}` : '';
      return `HTTP${code} response${latency ? ` · ${latency}` : ''}`;
    }
    return `${http.method ?? ''} ${http.url ?? ''}`.trim() || 'HTTP request';
  }
  const protocol = l4Protocol(flow.l4);
  if (protocol) {
    const port = getDestinationPort(flow.l4) ?? getSourcePort(flow.l4);
    const flags = tcpFlags(flow.l4);
    const flagPart = flags.length ? ` [${flags.join(',')}]` : '';
    return `${protocol} on port ${port ?? '?'}${flagPart}`;
  }
  return flow.Summary || 'Flow';
}

const DROP_REASON_TEXT: Record<string, string> = {
  POLICY_DENIED: 'Policy denied by L3 (CiliumNetworkPolicy)',
};

export function dropReasonText(flow: WirelogFlow): string {
  const desc = flow.drop_reason_desc;
  if (desc && DROP_REASON_TEXT[desc]) return DROP_REASON_TEXT[desc];
  if (desc) {
    return desc
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  }
  return 'Flow dropped';
}
