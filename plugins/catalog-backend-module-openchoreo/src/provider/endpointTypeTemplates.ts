import { Entity } from '@backstage/catalog-model';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  getDescription,
  getDisplayName,
  getName,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import { EtdToTemplateConverter } from '../converters/EtdToTemplateConverter';
import type { OpenChoreoApiClient } from '../utils/openChoreoApiClient';

type NewEndpointType = OpenChoreoComponents['schemas']['EndpointType'];
type NewClusterEndpointType =
  OpenChoreoComponents['schemas']['ClusterEndpointType'];

/**
 * Builds the create-Endpoint scaffolder Template for a (Cluster)EndpointType:
 * fetches the type's parameters schema and converts it. Shared by the periodic
 * sync and the event path so both emit identical templates. Returns undefined
 * (after logging) when the schema cannot be read.
 *
 * Pass `namespaceName` for a namespaced EndpointType; omit it for a
 * ClusterEndpointType.
 */
export async function buildEndpointTypeTemplate(opts: {
  client: OpenChoreoApiClient;
  converter: EtdToTemplateConverter;
  type: NewEndpointType | NewClusterEndpointType;
  namespaceName?: string;
  locationKey: string;
  logger: LoggerService;
}): Promise<Entity | undefined> {
  const { client, converter, type, namespaceName, locationKey, logger } = opts;
  const name = getName(type);
  if (!name) return undefined;
  const label = namespaceName
    ? `EndpointType ${namespaceName}/${name}`
    : `ClusterEndpointType ${name}`;

  try {
    const { data: schema, error } = namespaceName
      ? await client.GET(
          '/api/v1/namespaces/{namespaceName}/endpointtypes/{etName}/schema',
          { params: { path: { namespaceName, etName: name } } },
        )
      : await client.GET('/api/v1/clusterendpointtypes/{cetName}/schema', {
          params: { path: { cetName: name } },
        });
    if (error || !schema) {
      logger.warn(`Failed to fetch schema for ${label}; skipping its template`);
      return undefined;
    }

    const crd = {
      metadata: {
        name,
        displayName: getDisplayName(type),
        description: getDescription(type),
      },
      spec: { parameters: { openAPIV3Schema: schema as any } },
    };
    const template = namespaceName
      ? converter.convertEtdToTemplateEntity(crd, namespaceName)
      : converter.convertClusterEtdToTemplateEntity(crd);
    template.metadata.annotations = {
      ...template.metadata.annotations,
      'backstage.io/managed-by-location': locationKey,
      'backstage.io/managed-by-origin-location': locationKey,
    };
    return template;
  } catch (err) {
    logger.warn(`Failed to build template for ${label}: ${err}`);
    return undefined;
  }
}
