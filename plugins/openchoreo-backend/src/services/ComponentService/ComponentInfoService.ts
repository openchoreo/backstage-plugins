import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
  fetchAllPages,
  getDescription,
} from '@openchoreo/openchoreo-client-node';
import {
  isMainReleaseLine,
  toStoredReleaseLine,
  type APIResponse,
  type ComponentResponse,
  type ComponentTraitRequest,
  type ReleaseLineSummary,
  type ReleaseLineResource,
} from '@openchoreo/backstage-plugin-common';
import { transformComponent } from '../transformers';

export type ModelsCompleteComponent = ComponentResponse;

export class ComponentInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  /**
   * Fetches component details from OpenChoreo API.
   *
   * @param namespaceName - Namespace name
   * @param projectName - Project name
   * @param componentName - Component name
   * @param token - Optional user token (overrides default token if provided)
   */
  async fetchComponentDetails(
    namespaceName: string,
    _projectName: string,
    componentName: string,
    token?: string,
  ): Promise<ModelsCompleteComponent> {
    this.logger.debug(
      `Fetching component details for: ${componentName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // New API: components are at namespace level, not nested under projects
      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: {
            path: { namespaceName, componentName },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch component');

      this.logger.debug(
        `Successfully fetched component details for: ${componentName}`,
      );
      return transformComponent(data!);
    } catch (error) {
      this.logger.error(
        `Failed to fetch component details for ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Fetches the lines of a component: its implicit main line first, then its
   * release lines by name.
   */
  async fetchReleaseLines(
    namespaceName: string,
    componentName: string,
    token?: string,
  ): Promise<ReleaseLineSummary[]> {
    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const items = await fetchAllPages(cursor =>
      client
        .GET(
          '/api/v1/namespaces/{namespaceName}/components/{componentName}/releaselines',
          {
            params: {
              path: { namespaceName, componentName },
              query: { limit: 100, cursor },
            },
          },
        )
        .then(res => {
          assertApiResponse(res, 'fetch release lines');
          return res.data;
        }),
    );

    return items
      .map(line => ({
        name: line.metadata.name,
        description: getDescription(line),
        latestRelease: line.status?.latestRelease?.name,
        environments: (line.status?.environments ?? []).map(env => ({
          environment: env.environment,
          releaseBinding: env.releaseBinding,
          release: env.release,
          ready: env.ready,
        })),
        createdAt: line.metadata.creationTimestamp,
        autoDeploy: line.spec?.autoDeploy,
        parameterOverrides: Object.keys(line.spec?.parameters ?? {}),
        traitOverrides: (line.spec?.traits ?? []).map(
          trait => trait.instanceName,
        ),
        workflowOverride:
          Object.keys(line.spec?.workflow?.parameters ?? {}).length > 0,
        ...(isMainReleaseLine(line.metadata.name) && { isMain: true }),
      }))
      .sort(
        (a, b) =>
          Number(Boolean(b.isMain)) - Number(Boolean(a.isMain)) ||
          a.name.localeCompare(b.name),
      );
  }

  /** Fetches one release line of a component. */
  async fetchReleaseLine(
    namespaceName: string,
    componentName: string,
    releaseLineName: string,
    token?: string,
  ): Promise<ReleaseLineResource> {
    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/components/{componentName}/releaselines/{releaseLineName}',
      {
        params: {
          path: { namespaceName, componentName, releaseLineName },
        },
      },
    );

    assertApiResponse({ data, error, response }, 'fetch release line');
    return data as ReleaseLineResource;
  }

  /** Creates a release line of a component. The owner is taken from the path. */
  async createReleaseLine(
    namespaceName: string,
    componentName: string,
    releaseLine: ReleaseLineResource,
    token?: string,
  ): Promise<ReleaseLineResource> {
    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.POST(
      '/api/v1/namespaces/{namespaceName}/components/{componentName}/releaselines',
      {
        params: {
          path: { namespaceName, componentName },
        },
        body: releaseLine as any,
      },
    );

    assertApiResponse({ data, error, response }, 'create release line');
    return data as ReleaseLineResource;
  }

  /** Replaces the spec of a release line. */
  async updateReleaseLine(
    namespaceName: string,
    componentName: string,
    releaseLineName: string,
    releaseLine: ReleaseLineResource,
    token?: string,
  ): Promise<ReleaseLineResource> {
    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    // An update replaces the line. A caller that sends only new overrides
    // (no annotations) keeps the line's annotations, e.g. its description; a
    // caller that sends annotations, like the YAML editor, sets them.
    let body = releaseLine;
    if (releaseLine.metadata.annotations === undefined) {
      const existing = await this.fetchReleaseLine(
        namespaceName,
        componentName,
        releaseLineName,
        token,
      );
      body = {
        ...releaseLine,
        metadata: {
          ...releaseLine.metadata,
          annotations: existing.metadata.annotations,
        },
      };
    }

    const { data, error, response } = await client.PUT(
      '/api/v1/namespaces/{namespaceName}/components/{componentName}/releaselines/{releaseLineName}',
      {
        params: {
          path: { namespaceName, componentName, releaseLineName },
        },
        body: body as any,
      },
    );

    assertApiResponse({ data, error, response }, 'update release line');
    return data as ReleaseLineResource;
  }

  /**
   * Deletes a release line, which undeploys it from every environment and
   * removes its releases and Workload.
   */
  async deleteReleaseLine(
    namespaceName: string,
    componentName: string,
    releaseLineName: string,
    token?: string,
  ): Promise<void> {
    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { error, response } = await client.DELETE(
      '/api/v1/namespaces/{namespaceName}/components/{componentName}/releaselines/{releaseLineName}',
      {
        params: {
          path: { namespaceName, componentName, releaseLineName },
        },
      },
    );

    assertApiResponse(
      { data: undefined, error, response },
      'delete release line',
    );
  }

  /**
   * Starts a build of a release line. The API applies the line's workflow
   * parameter overrides and labels the run with the line.
   */
  async triggerReleaseLineBuild(
    namespaceName: string,
    componentName: string,
    releaseLine: string,
    token?: string,
  ): Promise<{ name?: string }> {
    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.POST(
      '/api/v1/namespaces/{namespaceName}/components/{componentName}/workflowruns',
      {
        params: {
          path: { namespaceName, componentName },
        },
        body: { releaseLine: toStoredReleaseLine(releaseLine) },
      },
    );

    assertApiResponse({ data, error, response }, 'trigger release line build');

    return { name: data?.metadata?.name };
  }

  /**
   * Patches a component in OpenChoreo API.
   *
   * @param namespaceName - Namespace name
   * @param projectName - Project name
   * @param componentName - Component name
   * @param autoDeploy - Auto deploy setting
   * @param token - Optional user token (overrides default token if provided)
   */
  async patchComponent(
    namespaceName: string,
    _projectName: string,
    componentName: string,
    autoDeploy: boolean,
    token?: string,
  ): Promise<ModelsCompleteComponent> {
    this.logger.debug(
      `Patching component: ${componentName} in namespace: ${namespaceName} with autoDeploy: ${autoDeploy}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // New API uses PUT for full update. First GET the component, then PUT with modified autoDeploy.
      const {
        data: existing,
        error: getError,
        response: getResponse,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: { path: { namespaceName, componentName } },
        },
      );

      assertApiResponse(
        { data: existing, error: getError, response: getResponse },
        'fetch component for patch',
      );

      const updated = {
        ...existing!,
        spec: {
          ...existing!.spec!,
          autoDeploy,
        },
      };

      const { data, error, response } = await client.PUT(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: { path: { namespaceName, componentName } },
          body: updated,
        },
      );

      assertApiResponse({ data, error, response }, 'patch component');

      this.logger.debug(`Successfully patched component: ${componentName}`);
      return transformComponent(data!);
    } catch (error) {
      this.logger.error(`Failed to patch component ${componentName}: ${error}`);
      throw error;
    }
  }

  /**
   * Deletes a component in OpenChoreo API.
   *
   * @param namespaceName - Namespace name
   * @param projectName - Project name
   * @param componentName - Component name
   * @param token - Optional user token (overrides default token if provided)
   */
  /**
   * Updates component configuration (traits and/or parameters).
   * Fetches the current component, merges in the provided traits/parameters, and PUTs back.
   */
  async updateComponentConfig(
    namespaceName: string,
    componentName: string,
    traits?: ComponentTraitRequest[],
    parameters?: Record<string, unknown>,
    token?: string,
  ): Promise<ModelsCompleteComponent> {
    this.logger.debug(
      `Updating component config for: ${componentName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // Fetch the current component
      const {
        data: component,
        error: getError,
        response: getResponse,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: { path: { namespaceName, componentName } },
        },
      );

      if (getError || !getResponse.ok) {
        throw new Error(
          `Failed to fetch component: ${getResponse.status} ${getResponse.statusText}`,
        );
      }

      if (!component.spec?.owner) {
        throw new Error(`Component ${componentName} is missing spec.owner`);
      }

      // Merge in traits and/or parameters
      const updatedComponent = {
        metadata: component.metadata,
        spec: {
          ...component.spec,
          owner: component.spec.owner,
          ...(traits !== undefined && { traits }),
          ...(parameters !== undefined && { parameters }),
        },
      } as typeof component;

      const { data, error, response } = await client.PUT(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: { path: { namespaceName, componentName } },
          body: updatedComponent,
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to update component config: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(
        `Successfully updated component config for: ${componentName}`,
      );
      return transformComponent(data);
    } catch (error) {
      this.logger.error(
        `Failed to update component config for ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Fetches the input parameter schema for a namespace-scoped ComponentType.
   */
  async fetchComponentTypeSchema(
    namespaceName: string,
    ctName: string,
    token?: string,
  ): Promise<APIResponse & { data?: { [key: string]: unknown } }> {
    this.logger.debug(
      `Fetching schema for component type: ${ctName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/componenttypes/{ctName}/schema',
        {
          params: {
            path: { namespaceName, ctName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component type schema: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(
        `Successfully fetched schema for component type: ${ctName}`,
      );

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for component type ${ctName}: ${error}`,
      );
      throw error;
    }
  }

  async deleteComponent(
    namespaceName: string,
    projectName: string,
    componentName: string,
    token?: string,
  ): Promise<void> {
    this.logger.info(
      `Deleting component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
    );

    try {
      // New API: components at namespace level
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { error, response } = await client.DELETE(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: {
            path: { namespaceName, componentName },
          },
        },
      );

      assertApiResponse({ error, response }, 'delete component');

      this.logger.info(`Successfully deleted component: ${componentName}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete component ${componentName}: ${error}`,
      );
      throw error;
    }
  }
}
