/** The part of a workload endpoint that decides how it can be exposed. */
export interface ExposableEndpoint {
  protocol?: string;
  type?: string;
  visibility?: string[];
}

/** A workload endpoint's protocol, falling back to the deprecated type. */
export function endpointProtocol(endpoint: ExposableEndpoint): string {
  return endpoint.protocol || endpoint.type || '';
}
