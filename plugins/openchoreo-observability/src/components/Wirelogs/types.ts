export type WirelogVerdict = 'FORWARDED' | 'DROPPED' | string;

export type WirelogDirection = 'INGRESS' | 'EGRESS' | string;

export interface WirelogEndpoint {
  cluster_name?: string;
  namespace?: string;
  labels?: string[];
  pod_name?: string;
  workloads?: Array<{ name: string; kind: string }>;
}

export interface WirelogIP {
  source?: string;
  destination?: string;
  source_xlated?: string;
  ipVersion?: string;
}

export interface WirelogL4TCPUDP {
  source_port?: number;
  destination_port?: number;
  flags?: Record<string, boolean>;
}

export interface WirelogL4 {
  TCP?: WirelogL4TCPUDP;
  UDP?: WirelogL4TCPUDP;
}

export interface WirelogL7Http {
  method?: string;
  url?: string;
  protocol?: string;
  code?: number;
  headers?: Array<{ key: string; value: string }>;
}

export interface WirelogL7 {
  type?: string;
  latency_ns?: number;
  http?: WirelogL7Http;
}

export interface WirelogFlow {
  time?: string;
  uuid?: string;
  verdict?: WirelogVerdict;
  drop_reason?: number;
  drop_reason_desc?: string;
  IP?: WirelogIP;
  l4?: WirelogL4;
  l7?: WirelogL7;
  source?: WirelogEndpoint;
  destination?: WirelogEndpoint;
  Type?: string;
  traffic_direction?: WirelogDirection;
  is_reply?: boolean;
  proxy_port?: number;
  Summary?: string;
}

export interface WirelogEvent {
  flow: WirelogFlow;
  time?: string;
  __id?: string;
}

import type { Environment } from '@openchoreo/backstage-plugin-react';

export interface WirelogsFilters {
  environment: Environment | null;
  searchQuery: string;
}

export type WirelogStreamStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'error'
  | 'closed';
