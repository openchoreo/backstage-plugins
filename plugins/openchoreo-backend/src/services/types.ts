import type {
  APIResponse,
  ListResponse,
} from '@openchoreo/backstage-plugin-common';

/**
 * Shared response wrappers for the *InfoService BFF services.
 *
 * The OpenChoreo API returns the same envelope shapes across resource kinds, so
 * these generics replace the per-service copies that used to be redeclared in
 * each service file.
 */

/** Envelope for a JSON-schema fetch: `data` is an opaque schema object. */
export type ApiSchemaResponse = APIResponse & {
  data?: {
    [key: string]: unknown;
  };
};

/** Envelope for a paginated list of `T`. */
export type ApiListResponse<T> = APIResponse & {
  data?: ListResponse & {
    items?: T[];
  };
};

/**
 * An output entry declared on a (Cluster)ResourceType. The "kind" is implicit
 * in which of value / secretKeyRef / configMapKeyRef is set.
 */
export type ResourceTypeOutput = {
  name: string;
  value?: string;
  secretKeyRef?: { name: string; key: string };
  configMapKeyRef?: { name: string; key: string };
};

/**
 * Envelope for a (Cluster)ResourceType outputs fetch. `data` is array-shaped
 * (unlike the record-shaped {@link ApiSchemaResponse}), so this is declared as a
 * sibling rather than extending APIResponse.
 */
export interface ResourceTypeOutputsResponse {
  success: boolean;
  data?: ResourceTypeOutput[];
  error?: string;
  code?: string;
}
