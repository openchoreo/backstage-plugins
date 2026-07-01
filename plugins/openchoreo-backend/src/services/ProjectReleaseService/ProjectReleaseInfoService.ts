import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import type { APIResponse } from '@openchoreo/backstage-plugin-common';

type ProjectReleaseSchemaResponse = APIResponse & {
  data?: {
    [key: string]: unknown;
  };
};

export type ProjectReleaseSchemaSection = 'parameters' | 'environmentConfigs';

/**
 * BFF service for ProjectRelease reads. Frozen snapshots that the Project
 * controller cuts whenever Project.spec.parameters or the referenced
 * (Cluster)ProjectType.spec change. Reads here surface the snapshot
 * (Cluster)ProjectType schemas so the override wizard can validate against
 * what a release was actually cut against, not the live type which may have
 * drifted.
 */
export class ProjectReleaseInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  /**
   * Returns the full ProjectRelease CR. Used by the Deploy tab so users can
   * inspect the frozen snapshot pinned to an env without dropping to kubectl.
   */
  async fetchProjectRelease(
    namespaceName: string,
    releaseName: string,
    token?: string,
  ): Promise<APIResponse & { data?: Record<string, unknown> }> {
    this.logger.debug(
      `Fetching project release: ${releaseName} in namespace: ${namespaceName}`,
    );

    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/projectreleases/{projectReleaseName}',
      {
        params: {
          path: { namespaceName, projectReleaseName: releaseName },
        },
      },
    );

    assertApiResponse({ data, error, response }, 'fetch project release');

    return {
      success: true,
      data: data as Record<string, unknown>,
    };
  }

  /**
   * Returns the requested schema section from the frozen snapshot stored on a
   * ProjectRelease. `parameters` is the developer-facing schema bound to
   * Project.spec.parameters; `environmentConfigs` is the per-env override
   * schema bound to ProjectReleaseBinding.spec.environmentConfigs.
   */
  async fetchProjectReleaseSchema(
    namespaceName: string,
    releaseName: string,
    section: ProjectReleaseSchemaSection,
    token?: string,
  ): Promise<ProjectReleaseSchemaResponse> {
    this.logger.debug(
      `Fetching snapshot schema (${section}) for project release: ${releaseName} in namespace: ${namespaceName}`,
    );

    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/projectreleases/{projectReleaseName}',
      {
        params: {
          path: { namespaceName, projectReleaseName: releaseName },
        },
      },
    );

    assertApiResponse({ data, error, response }, 'fetch project release');

    const release = data as Record<string, unknown> | undefined;
    const spec = (release?.spec as Record<string, unknown>) || {};
    const projectType = (spec.projectType as Record<string, unknown>) || {};
    const typeSpec = (projectType.spec as Record<string, unknown>) || {};
    const sectionBlock = typeSpec[section] as
      | { openAPIV3Schema?: Record<string, unknown> }
      | undefined;
    const schema = sectionBlock?.openAPIV3Schema;

    return {
      success: true,
      // Empty schema when the section isn't defined — keeps the caller's form
      // code uniform; it renders an empty-state message in that case.
      data: (schema ?? {}) as ProjectReleaseSchemaResponse['data'],
    };
  }
}
