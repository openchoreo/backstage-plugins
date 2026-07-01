import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { AuthService, LoggerService } from '@backstage/backend-plugin-api';
import {
  CatalogService,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { type OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  createAuthenticatedOpenChoreoApiClient,
  OpenChoreoApiClient,
} from '../utils/openChoreoApiClient';
import { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import {
  createApiEntitiesFromNewWorkload,
  buildComponentDependsOnRefs,
  extractAllWorkloadEndpoints,
  extractSchemaEndpoints,
  extractWorkloadDependencies,
  extractWorkloadResourceDependencies,
  filterDependenciesWithSchema,
  resolveComponentOwner,
  resolveProvidesAndConsumes,
} from '../utils/helpers';
import { WorkloadEndpoint } from '../utils/types';
import {
  NewApiTranslatorContext,
  translateNewClusterComponentTypeToEntity,
  translateNewClusterResourceTypeToEntity,
  translateNewClusterDataplaneToEntity,
  translateNewClusterObservabilityPlaneToEntity,
  translateNewClusterTraitToEntity,
  translateNewClusterWorkflowPlaneToEntity,
  translateNewClusterWorkflowToEntity,
  translateNewComponentToEntity,
  translateNewComponentTypeToEntity,
  translateNewDataplaneToEntity,
  translateNewDeploymentPipelineToEntity,
  translateNewEnvironmentToEntity,
  translateNewNamespaceToDomainEntity,
  translateNewNotificationChannelToEntity,
  translateNewObservabilityPlaneToEntity,
  translateNewProjectToEntity,
  translateNewClusterProjectTypeToEntity,
  translateNewProjectTypeToEntity,
  translateNewResourceToEntity,
  translateNewResourceTypeToEntity,
  translateNewTraitToEntity,
  translateNewWorkflowPlaneToEntity,
  translateNewWorkflowToEntity,
} from '../utils/entityTranslation';
import {
  getCreatedAt,
  getDescription,
  getDisplayName,
  getName,
} from '@openchoreo/openchoreo-client-node';
import { CtdToTemplateConverter } from '../converters/CtdToTemplateConverter';
import { RtdToTemplateConverter } from '../converters/RtdToTemplateConverter';
import {
  PtdToTemplateConverter,
  ProjectTypeCRD,
} from '../converters/PtdToTemplateConverter';

type NewProject = OpenChoreoComponents['schemas']['Project'];
type NewComponent = OpenChoreoComponents['schemas']['Component'];
type NewWorkload = OpenChoreoComponents['schemas']['Workload'];
type NewEnvironment = OpenChoreoComponents['schemas']['Environment'];
type NewNotificationChannel =
  OpenChoreoComponents['schemas']['ObservabilityAlertsNotificationChannel'];
type NewDataPlane = OpenChoreoComponents['schemas']['DataPlane'];
type NewWorkflowPlane = OpenChoreoComponents['schemas']['WorkflowPlane'];
type NewObservabilityPlane =
  OpenChoreoComponents['schemas']['ObservabilityPlane'];
type NewDeploymentPipeline =
  OpenChoreoComponents['schemas']['DeploymentPipeline'];
type NewComponentType = OpenChoreoComponents['schemas']['ComponentType'];
type NewResourceType = OpenChoreoComponents['schemas']['ResourceType'];
type NewProjectType = OpenChoreoComponents['schemas']['ProjectType'];
type NewClusterProjectType =
  OpenChoreoComponents['schemas']['ClusterProjectType'];
type NewResource = OpenChoreoComponents['schemas']['ResourceInstance'];
type NewTrait = OpenChoreoComponents['schemas']['Trait'];
type NewWorkflow = OpenChoreoComponents['schemas']['Workflow'];
type NewClusterComponentType =
  OpenChoreoComponents['schemas']['ClusterComponentType'];
type NewClusterResourceType =
  OpenChoreoComponents['schemas']['ClusterResourceType'];
type NewClusterTrait = OpenChoreoComponents['schemas']['ClusterTrait'];
type NewClusterWorkflow = OpenChoreoComponents['schemas']['ClusterWorkflow'];
type NewClusterDataPlane = OpenChoreoComponents['schemas']['ClusterDataPlane'];
type NewClusterObservabilityPlane =
  OpenChoreoComponents['schemas']['ClusterObservabilityPlane'];
type NewClusterWorkflowPlane =
  OpenChoreoComponents['schemas']['ClusterWorkflowPlane'];
type NewNamespace = OpenChoreoComponents['schemas']['Namespace'];

/**
 * Subsystem of `OpenChoreoEntityProvider` that handles webhook events from
 * the OpenChoreo event-forwarder. For each event it does the minimum work needed
 * to converge the catalog: fetch the affected resource(s), translate them
 * into Backstage entities (using the same translators the periodic full
 * sync uses), and apply a delta mutation.
 *
 * Cross-entity wiring (relations like `usesPipeline`, `consumesApi`,
 * `instanceOf`, etc.) is emitted by the existing `CatalogProcessor`
 * implementations and the built-in `BuiltinKindsEntityProcessor` from
 * the entity content itself. The Project↔DeploymentPipeline relation in
 * particular is owned by `SystemEntityProcessor`, which reads
 * `System.spec.deploymentPipelineRef` (the foreign key now lives on the
 * Project side, not the pipeline). So re-processing a Project after an
 * event-driven update naturally produces relations against the new
 * pipeline and discards relations to the previous one.
 */
export class EventDeltaApplier {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;
  private readonly tokenService?: OpenChoreoTokenService;
  private readonly defaultOwner: string;
  private readonly translatorContext: NewApiTranslatorContext;
  private readonly getConnection: () => EntityProviderConnection | undefined;
  private readonly ctdConverter: CtdToTemplateConverter;
  private readonly rtdConverter: RtdToTemplateConverter;
  private readonly ptdConverter: PtdToTemplateConverter;
  private readonly catalogService?: CatalogService;
  private readonly auth?: AuthService;

  constructor(opts: {
    logger: LoggerService;
    baseUrl: string;
    tokenService?: OpenChoreoTokenService;
    defaultOwner: string;
    translatorContext: NewApiTranslatorContext;
    getConnection: () => EntityProviderConnection | undefined;
    ctdConverter: CtdToTemplateConverter;
    rtdConverter: RtdToTemplateConverter;
    ptdConverter: PtdToTemplateConverter;
    /**
     * Optional catalog read-side. Used by the workload-deletion handler
     * to find entities annotated with the deleted workload's name and
     * remove them. When omitted (legacy callers, tests), the deletion
     * path falls back to convention-based name resolution.
     */
    catalogService?: CatalogService;
    /**
     * Required when `catalogService` is provided — used to mint backend
     * service credentials for the catalog query.
     */
    auth?: AuthService;
  }) {
    this.logger = opts.logger;
    this.baseUrl = opts.baseUrl;
    this.tokenService = opts.tokenService;
    this.defaultOwner = opts.defaultOwner;
    this.translatorContext = opts.translatorContext;
    this.ctdConverter = opts.ctdConverter;
    this.rtdConverter = opts.rtdConverter;
    this.ptdConverter = opts.ptdConverter;
    this.getConnection = opts.getConnection;
    this.catalogService = opts.catalogService;
    this.auth = opts.auth;
  }

  // -------------------------- Mutation helpers ---------------------------

  private locationKey(): string {
    return `provider:${this.translatorContext.providerName}`;
  }

  private toDeferred(entities: Entity[]): {
    entity: Entity;
    locationKey: string;
  }[] {
    const lk = this.locationKey();
    return entities.map(entity => ({ entity, locationKey: lk }));
  }

  /**
   * Stringified entity refs in the form `<kind>:<namespace>/<name>` used
   * for the `removed` side of delta mutations. The mapping mirrors the
   * translateNew*ToEntity functions: each OC CR kind has a fixed Backstage
   * kind, and the Backstage entity is namespaced by the Kubernetes
   * namespace the CR lives in (or the cluster pseudo-namespace
   * `openchoreo-cluster` for cluster-scoped kinds).
   */
  private buildEntityRef(
    backstageKind: string,
    backstageNamespace: string,
    name: string,
  ): string {
    return `${backstageKind.toLowerCase()}:${backstageNamespace}/${name}`;
  }

  private async removeEntityRefs(refs: string[]): Promise<void> {
    const connection = this.getConnection();
    if (!connection || refs.length === 0) {
      return;
    }
    await connection.applyMutation({
      type: 'delta',
      added: [],
      removed: refs.map(entityRef => ({
        entityRef,
        locationKey: this.locationKey(),
      })),
    });
  }

  private async upsertEntities(entities: Entity[]): Promise<void> {
    const connection = this.getConnection();
    if (!connection || entities.length === 0) {
      return;
    }
    await connection.applyMutation({
      type: 'delta',
      added: this.toDeferred(entities),
      removed: [],
    });
  }

  private async createApiClient(): Promise<OpenChoreoApiClient> {
    return createAuthenticatedOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      logger: this.logger,
      tokenService: this.tokenService,
    });
  }

  // -------------------------- Fetch helpers ------------------------------

  /**
   * Standard "fetch one resource by name" path. Returns undefined on 404
   * (signals "the resource is gone, remove from catalog"); throws on any
   * other error so the caller's try/catch in `onEvent` reports it without
   * incorrectly deleting the entity. The `kind` argument is only used for
   * the error message.
   */
  private async fetchOne<T>(
    res: Promise<{
      data?: T;
      error?: unknown;
      response?: { status?: number };
    }>,
    kind: string,
    ref: string,
  ): Promise<T | undefined> {
    const r = await res;
    if (r.response?.status === 404) return undefined;
    if (r.error || !r.data) {
      throw new Error(`Failed to fetch ${kind} ${ref}`);
    }
    return r.data;
  }

  private fetchNamespace(client: OpenChoreoApiClient, name: string) {
    return this.fetchOne<NewNamespace>(
      client.GET('/api/v1/namespaces/{namespaceName}', {
        params: { path: { namespaceName: name } },
      }) as any,
      'namespace',
      name,
    );
  }

  private fetchProject(client: OpenChoreoApiClient, ns: string, name: string) {
    return this.fetchOne<NewProject>(
      client.GET('/api/v1/namespaces/{namespaceName}/projects/{projectName}', {
        params: { path: { namespaceName: ns, projectName: name } },
      }) as any,
      'project',
      `${ns}/${name}`,
    );
  }

  private fetchComponent(
    client: OpenChoreoApiClient,
    ns: string,
    name: string,
  ) {
    return this.fetchOne<NewComponent>(
      client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        { params: { path: { namespaceName: ns, componentName: name } } },
      ) as any,
      'component',
      `${ns}/${name}`,
    );
  }

  /**
   * Fetches a single Workload CR by its own metadata.name. Used by the
   * workload-event dispatch path to discover the workload's owning
   * component (`spec.owner.componentName`), which is the only reliable
   * way to map a workload event to the right Component entity — workload
   * name and component name are not required to match (the convention is
   * `<componentName>-workload` but it's not enforced).
   */
  private fetchWorkloadByName(
    client: OpenChoreoApiClient,
    ns: string,
    name: string,
  ) {
    return this.fetchOne<NewWorkload>(
      client.GET(
        '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}',
        { params: { path: { namespaceName: ns, workloadName: name } } },
      ) as any,
      'workload',
      `${ns}/${name}`,
    );
  }

  /**
   * The workload endpoint is a *list* query filtered by component name —
   * unlike the get-by-name helpers above, "no results" is a 200 with an
   * empty `items` array, not a 404. So we still need to distinguish a real
   * fetch error (5xx etc.) from a legitimate "this component has no
   * workload yet". The previous implementation swallowed both as undefined,
   * which silently dropped the providesApis/consumesApis on transient
   * errors.
   */
  private async fetchWorkloadForComponent(
    client: OpenChoreoApiClient,
    ns: string,
    componentName: string,
  ): Promise<NewWorkload | undefined> {
    const res = await client.GET(
      '/api/v1/namespaces/{namespaceName}/workloads',
      {
        params: {
          path: { namespaceName: ns },
          query: { component: componentName },
        },
      },
    );
    if (res.error) {
      throw new Error(
        `Failed to fetch workload for component ${ns}/${componentName}: ${JSON.stringify(
          res.error,
        )}`,
      );
    }
    return res.data?.items?.[0] as NewWorkload | undefined;
  }

  private fetchEnvironment(
    client: OpenChoreoApiClient,
    ns: string,
    name: string,
  ) {
    return this.fetchOne<NewEnvironment>(
      client.GET('/api/v1/namespaces/{namespaceName}/environments/{envName}', {
        params: { path: { namespaceName: ns, envName: name } },
      }) as any,
      'environment',
      `${ns}/${name}`,
    );
  }

  private fetchNotificationChannel(
    client: OpenChoreoApiClient,
    ns: string,
    name: string,
  ) {
    return this.fetchOne<NewNotificationChannel>(
      client.GET(
        '/api/v1/namespaces/{namespaceName}/observabilityalertsnotificationchannels/{observabilityAlertsNotificationChannelName}',
        {
          params: {
            path: {
              namespaceName: ns,
              observabilityAlertsNotificationChannelName: name,
            },
          },
        },
      ) as any,
      'observabilityalertsnotificationchannel',
      `${ns}/${name}`,
    );
  }

  private fetchDataPlane(
    client: OpenChoreoApiClient,
    ns: string,
    name: string,
  ) {
    return this.fetchOne<NewDataPlane>(
      client.GET('/api/v1/namespaces/{namespaceName}/dataplanes/{dpName}', {
        params: { path: { namespaceName: ns, dpName: name } },
      }) as any,
      'dataplane',
      `${ns}/${name}`,
    );
  }

  private fetchWorkflowPlane(
    client: OpenChoreoApiClient,
    ns: string,
    name: string,
  ) {
    return this.fetchOne<NewWorkflowPlane>(
      client.GET(
        '/api/v1/namespaces/{namespaceName}/workflowplanes/{workflowPlaneName}',
        { params: { path: { namespaceName: ns, workflowPlaneName: name } } },
      ) as any,
      'workflowplane',
      `${ns}/${name}`,
    );
  }

  private fetchObservabilityPlane(
    client: OpenChoreoApiClient,
    ns: string,
    name: string,
  ) {
    return this.fetchOne<NewObservabilityPlane>(
      client.GET(
        '/api/v1/namespaces/{namespaceName}/observabilityplanes/{observabilityPlaneName}',
        {
          params: {
            path: { namespaceName: ns, observabilityPlaneName: name },
          },
        },
      ) as any,
      'observabilityplane',
      `${ns}/${name}`,
    );
  }

  private fetchComponentType(
    client: OpenChoreoApiClient,
    ns: string,
    name: string,
  ) {
    return this.fetchOne<NewComponentType>(
      client.GET('/api/v1/namespaces/{namespaceName}/componenttypes/{ctName}', {
        params: { path: { namespaceName: ns, ctName: name } },
      }) as any,
      'componenttype',
      `${ns}/${name}`,
    );
  }

  private fetchTrait(client: OpenChoreoApiClient, ns: string, name: string) {
    return this.fetchOne<NewTrait>(
      client.GET('/api/v1/namespaces/{namespaceName}/traits/{traitName}', {
        params: { path: { namespaceName: ns, traitName: name } },
      }) as any,
      'trait',
      `${ns}/${name}`,
    );
  }

  private fetchResourceType(
    client: OpenChoreoApiClient,
    ns: string,
    name: string,
  ) {
    return this.fetchOne<NewResourceType>(
      client.GET('/api/v1/namespaces/{namespaceName}/resourcetypes/{rtName}', {
        params: { path: { namespaceName: ns, rtName: name } },
      }) as any,
      'resourcetype',
      `${ns}/${name}`,
    );
  }

  private fetchProjectType(
    client: OpenChoreoApiClient,
    ns: string,
    name: string,
  ) {
    return this.fetchOne<NewProjectType>(
      client.GET('/api/v1/namespaces/{namespaceName}/projecttypes/{ptName}', {
        params: { path: { namespaceName: ns, ptName: name } },
      }) as any,
      'projecttype',
      `${ns}/${name}`,
    );
  }

  private fetchResource(client: OpenChoreoApiClient, ns: string, name: string) {
    return this.fetchOne<NewResource>(
      client.GET(
        '/api/v1/namespaces/{namespaceName}/resources/{resourceName}',
        {
          params: { path: { namespaceName: ns, resourceName: name } },
        },
      ) as any,
      'resource',
      `${ns}/${name}`,
    );
  }

  private fetchWorkflow(client: OpenChoreoApiClient, ns: string, name: string) {
    return this.fetchOne<NewWorkflow>(
      client.GET(
        '/api/v1/namespaces/{namespaceName}/workflows/{workflowName}',
        { params: { path: { namespaceName: ns, workflowName: name } } },
      ) as any,
      'workflow',
      `${ns}/${name}`,
    );
  }

  private fetchDeploymentPipeline(
    client: OpenChoreoApiClient,
    ns: string,
    name: string,
  ) {
    return this.fetchOne<NewDeploymentPipeline>(
      client.GET(
        '/api/v1/namespaces/{namespaceName}/deploymentpipelines/{deploymentPipelineName}',
        {
          params: {
            path: { namespaceName: ns, deploymentPipelineName: name },
          },
        },
      ) as any,
      'deployment pipeline',
      `${ns}/${name}`,
    );
  }

  private fetchClusterComponentType(client: OpenChoreoApiClient, name: string) {
    return this.fetchOne<NewClusterComponentType>(
      client.GET('/api/v1/clustercomponenttypes/{cctName}', {
        params: { path: { cctName: name } },
      }) as any,
      'clustercomponenttype',
      name,
    );
  }

  private fetchClusterResourceType(client: OpenChoreoApiClient, name: string) {
    return this.fetchOne<NewClusterResourceType>(
      client.GET('/api/v1/clusterresourcetypes/{crtName}', {
        params: { path: { crtName: name } },
      }) as any,
      'clusterresourcetype',
      name,
    );
  }

  private fetchClusterProjectType(client: OpenChoreoApiClient, name: string) {
    return this.fetchOne<NewClusterProjectType>(
      client.GET('/api/v1/clusterprojecttypes/{cptName}', {
        params: { path: { cptName: name } },
      }) as any,
      'clusterprojecttype',
      name,
    );
  }

  private fetchClusterTrait(client: OpenChoreoApiClient, name: string) {
    return this.fetchOne<NewClusterTrait>(
      client.GET('/api/v1/clustertraits/{clusterTraitName}', {
        params: { path: { clusterTraitName: name } },
      }) as any,
      'clustertrait',
      name,
    );
  }

  private fetchClusterWorkflow(client: OpenChoreoApiClient, name: string) {
    return this.fetchOne<NewClusterWorkflow>(
      client.GET('/api/v1/clusterworkflows/{clusterWorkflowName}', {
        params: { path: { clusterWorkflowName: name } },
      }) as any,
      'clusterworkflow',
      name,
    );
  }

  private fetchClusterDataPlane(client: OpenChoreoApiClient, name: string) {
    return this.fetchOne<NewClusterDataPlane>(
      client.GET('/api/v1/clusterdataplanes/{cdpName}', {
        params: { path: { cdpName: name } },
      }) as any,
      'clusterdataplane',
      name,
    );
  }

  private fetchClusterObservabilityPlane(
    client: OpenChoreoApiClient,
    name: string,
  ) {
    return this.fetchOne<NewClusterObservabilityPlane>(
      client.GET(
        '/api/v1/clusterobservabilityplanes/{clusterObservabilityPlaneName}',
        { params: { path: { clusterObservabilityPlaneName: name } } },
      ) as any,
      'clusterobservabilityplane',
      name,
    );
  }

  private fetchClusterWorkflowPlane(client: OpenChoreoApiClient, name: string) {
    return this.fetchOne<NewClusterWorkflowPlane>(
      client.GET('/api/v1/clusterworkflowplanes/{clusterWorkflowPlaneName}', {
        params: { path: { clusterWorkflowPlaneName: name } },
      }) as any,
      'clusterworkflowplane',
      name,
    );
  }

  // -------------------------- Refresh methods ----------------------------

  /**
   * Refreshes the Backstage Domain entity that mirrors a single
   * OpenChoreo Organization (a Kubernetes Namespace marked with
   * `openchoreo.dev/control-plane=true`).
   *
   * On 404 from the OC API (namespace deleted, or label removed so OC
   * no longer treats it as an organization), the Domain entity is
   * removed from the catalog. Domains live under Backstage namespace
   * `default`.
   */
  private async refreshDomain(name: string): Promise<void> {
    const client = await this.createApiClient();
    const ns = await this.fetchNamespace(client, name);
    if (!ns) {
      await this.removeEntityRefs([
        this.buildEntityRef('domain', 'default', name),
      ]);
      return;
    }
    await this.upsertEntities([
      translateNewNamespaceToDomainEntity(ns, this.translatorContext),
    ]);
  }

  private async refreshProject(ns: string, name: string): Promise<void> {
    const client = await this.createApiClient();
    const project = await this.fetchProject(client, ns, name);
    if (!project) {
      await this.removeEntityRefs([this.buildEntityRef('system', ns, name)]);
      return;
    }
    await this.upsertEntities([
      translateNewProjectToEntity(project, ns, this.translatorContext),
    ]);
  }

  private async refreshComponent(
    ns: string,
    name: string,
    // The workload-event dispatch path fetches the workload by name to
    // discover its `spec.owner.componentName`; passing it through here
    // avoids a redundant `fetchWorkloadForComponent` lookup on the same
    // resource. When omitted (component-event path), we look the
    // workload up by component name as before.
    preFetchedWorkload?: NewWorkload,
  ): Promise<void> {
    const client = await this.createApiClient();
    const component = await this.fetchComponent(client, ns, name);
    if (!component) {
      await this.removeEntityRefs([this.buildEntityRef('component', ns, name)]);
      return;
    }

    const projectName = (
      component.spec as { owner?: { projectName?: string } } | undefined
    )?.owner?.projectName;
    if (!projectName) {
      // A Component CR without owner.projectName violates the OpenChoreo
      // schema. Throw so the event-loop's catch logs it as an error rather
      // than silently dropping the entity from the catalog until the next
      // periodic sync surfaces the same broken resource.
      throw new Error(
        `Component ${ns}/${name} has no owner.projectName; cannot translate`,
      );
    }

    // Owner-resolution fallback chain: component annotation > project
    // annotation > defaultOwner. Only fetch the project if the component
    // has no annotation of its own.
    let project: NewProject | undefined;
    if (
      !(
        component.metadata?.annotations?.['backstage.io/owner'] as
          | string
          | undefined
      )?.trim()
    ) {
      project = await this.fetchProject(client, ns, projectName);
    }
    const resolvedOwner = resolveComponentOwner(
      component,
      project,
      this.defaultOwner,
    );

    const workload =
      preFetchedWorkload ??
      (await this.fetchWorkloadForComponent(client, ns, name));

    const allEndpoints = workload ? extractAllWorkloadEndpoints(workload) : {};
    const schemaEndpoints = extractSchemaEndpoints(allEndpoints);
    const dependencies = workload ? extractWorkloadDependencies(workload) : [];
    const resourceDependencies = workload
      ? extractWorkloadResourceDependencies(workload)
      : [];

    // Filter `consumesApis` down to deps whose target endpoint actually
    // exposes a schema. Without this, refs in `spec.consumesApis` point
    // at API entities that don't exist (schema-less endpoints don't
    // produce API entities), surfacing in the UI as "Some related
    // entities could not be found".
    //
    // Dependencies are assumed intra-namespace: a workload's
    // `dep.project` is the *owning OC Project* (a CR label), not a
    // separate K8s namespace, and component names are unique within a
    // namespace anyway. The periodic full sync makes the same
    // assumption (its componentWorkloadMap is populated per-namespace
    // and keyed by `<project>:<component>`), so both paths resolve
    // dependencies the same way. Cross-namespace dependencies aren't
    // currently part of the OC data model.
    //
    // Cache by `<ns>/<targetComponent>` since multiple deps may point
    // at the same workload — one fetch each.
    const targetWorkloadCache = new Map<string, NewWorkload | undefined>();
    const fetchTargetWorkload = async (
      targetComponent: string,
    ): Promise<NewWorkload | undefined> => {
      const key = `${ns}/${targetComponent}`;
      if (targetWorkloadCache.has(key)) {
        return targetWorkloadCache.get(key);
      }
      let target: NewWorkload | undefined;
      try {
        target = await this.fetchWorkloadForComponent(
          client,
          ns,
          targetComponent,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to fetch workload for ${ns}/${targetComponent} while resolving consumesApis: ${err}`,
        );
        target = undefined;
      }
      targetWorkloadCache.set(key, target);
      return target;
    };
    const filteredDependencies = await filterDependenciesWithSchema(
      dependencies,
      projectName,
      async (_targetProject, targetComponent, endpointName) => {
        const targetWorkload = await fetchTargetWorkload(targetComponent);
        const endpoint = (
          targetWorkload?.spec as
            | { endpoints?: Record<string, WorkloadEndpoint> }
            | undefined
        )?.endpoints?.[endpointName];
        return Boolean(endpoint?.schema?.content?.trim());
      },
    );

    const { providesApis, consumesApis } = resolveProvidesAndConsumes(
      schemaEndpoints,
      filteredDependencies,
      projectName,
      name,
    );

    const workloadName = workload?.metadata?.name;

    const componentEntity = translateNewComponentToEntity(
      component,
      ns,
      projectName,
      resolvedOwner,
      this.translatorContext,
      providesApis,
      consumesApis,
      workloadName,
      buildComponentDependsOnRefs(resourceDependencies, ns),
    );

    // API entities exist only because a Workload exposes schema-bearing
    // endpoints — so when we get here without a workload there's nothing
    // to emit. Otherwise stamp the workload-name annotation so the
    // workload-deletion handler can find these later by catalog query.
    const apiEntities =
      workloadName && Object.keys(schemaEndpoints).length > 0
        ? createApiEntitiesFromNewWorkload({
            componentName: name,
            endpoints: schemaEndpoints,
            namespaceName: ns,
            projectName,
            owner: resolvedOwner,
            locationKey: this.locationKey(),
            workloadName,
          })
        : [];

    await this.upsertEntities([componentEntity, ...apiEntities]);
  }

  private async refreshEnvironment(ns: string, name: string): Promise<void> {
    const client = await this.createApiClient();
    const env = await this.fetchEnvironment(client, ns, name);
    if (!env) {
      await this.removeEntityRefs([
        this.buildEntityRef('environment', ns, name),
      ]);
      return;
    }
    await this.upsertEntities([
      translateNewEnvironmentToEntity(env, ns, this.translatorContext),
    ]);
  }

  private async refreshNotificationChannel(
    ns: string,
    name: string,
  ): Promise<void> {
    const client = await this.createApiClient();
    const channel = await this.fetchNotificationChannel(client, ns, name);
    if (!channel) {
      await this.removeEntityRefs([
        this.buildEntityRef('observabilityalertsnotificationchannel', ns, name),
      ]);
      return;
    }
    await this.upsertEntities([
      translateNewNotificationChannelToEntity(
        channel,
        ns,
        this.translatorContext,
      ),
    ]);
  }

  private async refreshDataPlane(ns: string, name: string): Promise<void> {
    const client = await this.createApiClient();
    const dp = await this.fetchDataPlane(client, ns, name);
    if (!dp) {
      await this.removeEntityRefs([this.buildEntityRef('dataplane', ns, name)]);
      return;
    }
    await this.upsertEntities([
      translateNewDataplaneToEntity(dp, ns, this.translatorContext),
    ]);
  }

  private async refreshWorkflowPlane(ns: string, name: string): Promise<void> {
    const client = await this.createApiClient();
    const wp = await this.fetchWorkflowPlane(client, ns, name);
    if (!wp) {
      await this.removeEntityRefs([
        this.buildEntityRef('workflowplane', ns, name),
      ]);
      return;
    }
    await this.upsertEntities([
      translateNewWorkflowPlaneToEntity(wp, ns, this.translatorContext),
    ]);
  }

  private async refreshObservabilityPlane(
    ns: string,
    name: string,
  ): Promise<void> {
    const client = await this.createApiClient();
    const op = await this.fetchObservabilityPlane(client, ns, name);
    if (!op) {
      await this.removeEntityRefs([
        this.buildEntityRef('observabilityplane', ns, name),
      ]);
      return;
    }
    await this.upsertEntities([
      translateNewObservabilityPlaneToEntity(op, ns, this.translatorContext),
    ]);
  }

  /**
   * Fetches the ComponentType's input-parameters schema and produces the
   * derived Backstage Template entity. Returns `undefined` if the schema
   * fetch fails or the conversion throws — the caller should still
   * upsert the ComponentType entity in that case.
   *
   * Mirrors the ctd-with-schema combination in `runNew()` so the
   * periodic and event-driven paths produce identical Template
   * entities.
   */
  private async buildComponentTypeTemplateEntity(
    client: OpenChoreoApiClient,
    ns: string,
    ct: NewComponentType,
  ): Promise<Entity | undefined> {
    const ctName = getName(ct);
    if (!ctName) return undefined;

    try {
      const { data: schemaData, error: schemaError } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/componenttypes/{ctName}/schema',
        { params: { path: { namespaceName: ns, ctName } } },
      );
      if (schemaError || !schemaData) {
        this.logger.warn(
          `Failed to fetch schema for ComponentType ${ctName} in ns ${ns}; Template entity will not be refreshed`,
        );
        return undefined;
      }

      const fullComponentType = {
        metadata: {
          name: ctName,
          displayName: getDisplayName(ct),
          description: getDescription(ct),
          workloadType: ct.spec?.workloadType ?? 'deployment',
          allowedWorkflows: ct.spec?.allowedWorkflows,
          allowedTraits: ct.spec?.allowedTraits,
          createdAt: getCreatedAt(ct) || '',
        },
        spec: {
          inputParametersSchema: schemaData as any,
        },
      };

      const templateEntity = this.ctdConverter.convertCtdToTemplateEntity(
        fullComponentType,
        ns,
      );
      if (!templateEntity.metadata.annotations) {
        templateEntity.metadata.annotations = {};
      }
      templateEntity.metadata.annotations['backstage.io/managed-by-location'] =
        this.locationKey();
      templateEntity.metadata.annotations[
        'backstage.io/managed-by-origin-location'
      ] = this.locationKey();
      return templateEntity;
    } catch (error) {
      this.logger.warn(
        `Failed to build Template entity for ComponentType ${ns}/${ctName}: ${error}`,
      );
      return undefined;
    }
  }

  /**
   * Same as `buildComponentTypeTemplateEntity` but for a cluster-scoped
   * ComponentType. The derived Template entity is namespaced under
   * `openchoreo-cluster`.
   */
  private async buildClusterComponentTypeTemplateEntity(
    client: OpenChoreoApiClient,
    cct: NewClusterComponentType,
  ): Promise<Entity | undefined> {
    const cctName = getName(cct);
    if (!cctName) return undefined;

    try {
      const { data: schemaData, error: schemaError } = await client.GET(
        '/api/v1/clustercomponenttypes/{cctName}/schema',
        { params: { path: { cctName } } },
      );
      if (schemaError || !schemaData) {
        this.logger.warn(
          `Failed to fetch schema for ClusterComponentType ${cctName}; Template entity will not be refreshed`,
        );
        return undefined;
      }

      const fullClusterComponentType = {
        metadata: {
          name: cctName,
          displayName: getDisplayName(cct),
          description: getDescription(cct),
          workloadType: cct.spec?.workloadType ?? 'deployment',
          allowedWorkflows: cct.spec?.allowedWorkflows?.map(w => w.name),
          allowedTraits: cct.spec?.allowedTraits?.map(t => ({
            kind: 'ClusterTrait' as const,
            name: t.name,
          })),
          createdAt: getCreatedAt(cct) || '',
        },
        spec: {
          inputParametersSchema: schemaData as any,
        },
      };

      const templateEntity =
        this.ctdConverter.convertClusterCtdToTemplateEntity(
          fullClusterComponentType,
        );
      if (!templateEntity.metadata.annotations) {
        templateEntity.metadata.annotations = {};
      }
      templateEntity.metadata.annotations['backstage.io/managed-by-location'] =
        this.locationKey();
      templateEntity.metadata.annotations[
        'backstage.io/managed-by-origin-location'
      ] = this.locationKey();
      return templateEntity;
    } catch (error) {
      this.logger.warn(
        `Failed to build Template entity for ClusterComponentType ${cctName}: ${error}`,
      );
      return undefined;
    }
  }

  /**
   * Fetches the ResourceType's parameters schema and produces the derived
   * Backstage Template entity via `RtdToTemplateConverter`. Mirrors
   * `buildComponentTypeTemplateEntity` so the periodic and event-driven
   * paths emit identical Template entities for the Resource family.
   */
  private async buildResourceTypeTemplateEntity(
    client: OpenChoreoApiClient,
    ns: string,
    rt: NewResourceType,
  ): Promise<Entity | undefined> {
    const rtName = getName(rt);
    if (!rtName) return undefined;

    try {
      const { data: schemaData, error: schemaError } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/resourcetypes/{rtName}/schema',
        { params: { path: { namespaceName: ns, rtName } } },
      );
      if (schemaError || !schemaData) {
        this.logger.warn(
          `Failed to fetch schema for ResourceType ${rtName} in ns ${ns}; Template entity will not be refreshed`,
        );
        return undefined;
      }

      const fullResourceType = {
        metadata: {
          name: rtName,
          displayName: getDisplayName(rt),
          description: getDescription(rt),
          createdAt: getCreatedAt(rt) || '',
        },
        spec: {
          parameters: { openAPIV3Schema: schemaData as any },
          retainPolicy: rt.spec?.retainPolicy as
            | 'Delete'
            | 'Retain'
            | undefined,
        },
      };

      const templateEntity = this.rtdConverter.convertRtdToTemplateEntity(
        fullResourceType,
        ns,
      );
      if (!templateEntity.metadata.annotations) {
        templateEntity.metadata.annotations = {};
      }
      templateEntity.metadata.annotations['backstage.io/managed-by-location'] =
        this.locationKey();
      templateEntity.metadata.annotations[
        'backstage.io/managed-by-origin-location'
      ] = this.locationKey();
      return templateEntity;
    } catch (error) {
      this.logger.warn(
        `Failed to build Template entity for ResourceType ${ns}/${rtName}: ${error}`,
      );
      return undefined;
    }
  }

  /**
   * Same as `buildResourceTypeTemplateEntity` but for a cluster-scoped
   * ResourceType. Template entity lives in `openchoreo-cluster`.
   */
  private async buildClusterResourceTypeTemplateEntity(
    client: OpenChoreoApiClient,
    crt: NewClusterResourceType,
  ): Promise<Entity | undefined> {
    const crtName = getName(crt);
    if (!crtName) return undefined;

    try {
      const { data: schemaData, error: schemaError } = await client.GET(
        '/api/v1/clusterresourcetypes/{crtName}/schema',
        { params: { path: { crtName } } },
      );
      if (schemaError || !schemaData) {
        this.logger.warn(
          `Failed to fetch schema for ClusterResourceType ${crtName}; Template entity will not be refreshed`,
        );
        return undefined;
      }

      const fullClusterResourceType = {
        metadata: {
          name: crtName,
          displayName: getDisplayName(crt),
          description: getDescription(crt),
          createdAt: getCreatedAt(crt) || '',
        },
        spec: {
          parameters: { openAPIV3Schema: schemaData as any },
          retainPolicy: crt.spec?.retainPolicy as
            | 'Delete'
            | 'Retain'
            | undefined,
        },
      };

      const templateEntity =
        this.rtdConverter.convertClusterRtdToTemplateEntity(
          fullClusterResourceType,
        );
      if (!templateEntity.metadata.annotations) {
        templateEntity.metadata.annotations = {};
      }
      templateEntity.metadata.annotations['backstage.io/managed-by-location'] =
        this.locationKey();
      templateEntity.metadata.annotations[
        'backstage.io/managed-by-origin-location'
      ] = this.locationKey();
      return templateEntity;
    } catch (error) {
      this.logger.warn(
        `Failed to build Template entity for ClusterResourceType ${crtName}: ${error}`,
      );
      return undefined;
    }
  }

  /**
   * Produces the derived Project-creation Template entity for a ProjectType
   * via `PtdToTemplateConverter`. Unlike the Resource family, the
   * (Cluster)ProjectType already carries its parameters schema inline, so the
   * schema is read straight off the fetched CR (no extra `/schema` fetch).
   */
  private buildProjectTypeTemplateEntity(
    ns: string,
    pt: NewProjectType,
  ): Entity | undefined {
    const ptName = getName(pt);
    if (!ptName) return undefined;
    try {
      const templateEntity = this.ptdConverter.convertPtdToTemplateEntity(
        this.toProjectTypeCRD(pt, ptName),
        ns,
      );
      this.stampManagedByLocation(templateEntity);
      return templateEntity;
    } catch (error) {
      this.logger.warn(
        `Failed to build Template entity for ProjectType ${ns}/${ptName}: ${error}`,
      );
      return undefined;
    }
  }

  /**
   * Same as `buildProjectTypeTemplateEntity` but for a cluster-scoped
   * ProjectType. Template entity lives in `openchoreo-cluster`.
   */
  private buildClusterProjectTypeTemplateEntity(
    cpt: NewClusterProjectType,
  ): Entity | undefined {
    const cptName = getName(cpt);
    if (!cptName) return undefined;
    try {
      const templateEntity =
        this.ptdConverter.convertClusterPtdToTemplateEntity(
          this.toProjectTypeCRD(cpt, cptName),
        );
      this.stampManagedByLocation(templateEntity);
      return templateEntity;
    } catch (error) {
      this.logger.warn(
        `Failed to build Template entity for ClusterProjectType ${cptName}: ${error}`,
      );
      return undefined;
    }
  }

  /** Map a fetched (Cluster)ProjectType to the converter's `ProjectTypeCRD` shape. */
  private toProjectTypeCRD(
    pt: NewProjectType | NewClusterProjectType,
    name: string,
  ): ProjectTypeCRD {
    return {
      metadata: {
        name,
        displayName: getDisplayName(pt),
        description: getDescription(pt),
        createdAt: getCreatedAt(pt) || '',
      },
      spec: {
        parameters: pt.spec?.parameters?.openAPIV3Schema
          ? { openAPIV3Schema: pt.spec.parameters.openAPIV3Schema as any }
          : undefined,
      },
    };
  }

  /** Stamp the provider's managed-by-location annotations on a generated entity. */
  private stampManagedByLocation(entity: Entity): void {
    if (!entity.metadata.annotations) {
      entity.metadata.annotations = {};
    }
    entity.metadata.annotations['backstage.io/managed-by-location'] =
      this.locationKey();
    entity.metadata.annotations['backstage.io/managed-by-origin-location'] =
      this.locationKey();
  }

  private async refreshComponentType(ns: string, name: string): Promise<void> {
    const client = await this.createApiClient();
    const ct = await this.fetchComponentType(client, ns, name);
    if (!ct) {
      // Both the ComponentType entity and its derived Template entity
      // need to disappear. The Template name is `template-<ctName>`.
      await this.removeEntityRefs([
        this.buildEntityRef('componenttype', ns, name),
        this.buildEntityRef('template', ns, `template-${name}`),
      ]);
      return;
    }
    const ctEntity = translateNewComponentTypeToEntity(
      ct,
      ns,
      this.translatorContext,
    );
    const templateEntity = await this.buildComponentTypeTemplateEntity(
      client,
      ns,
      ct,
    );
    const entities: Entity[] = templateEntity
      ? [ctEntity, templateEntity]
      : [ctEntity];
    await this.upsertEntities(entities);
  }

  private async refreshTrait(ns: string, name: string): Promise<void> {
    const client = await this.createApiClient();
    const trait = await this.fetchTrait(client, ns, name);
    if (!trait) {
      await this.removeEntityRefs([this.buildEntityRef('traittype', ns, name)]);
      return;
    }
    await this.upsertEntities([
      translateNewTraitToEntity(trait, ns, this.translatorContext),
    ]);
  }

  private async refreshResourceType(ns: string, name: string): Promise<void> {
    const client = await this.createApiClient();
    const rt = await this.fetchResourceType(client, ns, name);
    if (!rt) {
      // Both the ResourceType entity and its derived Template entity
      // need to disappear. The Template name is `template-resource-<rtName>`.
      await this.removeEntityRefs([
        this.buildEntityRef('resourcetype', ns, name),
        this.buildEntityRef('template', ns, `template-resource-${name}`),
      ]);
      return;
    }
    const rtEntity = translateNewResourceTypeToEntity(
      rt,
      ns,
      this.translatorContext,
    ) as Entity;
    const templateEntity = await this.buildResourceTypeTemplateEntity(
      client,
      ns,
      rt,
    );
    const entities: Entity[] = templateEntity
      ? [rtEntity, templateEntity]
      : [rtEntity];
    await this.upsertEntities(entities);
  }

  private async refreshProjectType(ns: string, name: string): Promise<void> {
    const client = await this.createApiClient();
    const pt = await this.fetchProjectType(client, ns, name);
    if (!pt) {
      // Both the ProjectType entity and its derived Template entity need to
      // disappear. The Template name is `template-project-<ptName>`.
      await this.removeEntityRefs([
        this.buildEntityRef('projecttype', ns, name),
        this.buildEntityRef('template', ns, `template-project-${name}`),
      ]);
      return;
    }
    const ptEntity = translateNewProjectTypeToEntity(
      pt,
      ns,
      this.translatorContext,
    ) as Entity;
    const templateEntity = this.buildProjectTypeTemplateEntity(ns, pt);
    await this.upsertEntities(
      templateEntity ? [ptEntity, templateEntity] : [ptEntity],
    );
  }

  private async refreshResource(ns: string, name: string): Promise<void> {
    const client = await this.createApiClient();
    const resource = await this.fetchResource(client, ns, name);
    if (!resource) {
      await this.removeEntityRefs([this.buildEntityRef('resource', ns, name)]);
      return;
    }
    await this.upsertEntities([
      translateNewResourceToEntity(resource, ns, this.translatorContext),
    ]);
  }

  private async refreshWorkflow(ns: string, name: string): Promise<void> {
    const client = await this.createApiClient();
    const wf = await this.fetchWorkflow(client, ns, name);
    if (!wf) {
      await this.removeEntityRefs([this.buildEntityRef('workflow', ns, name)]);
      return;
    }
    await this.upsertEntities([
      translateNewWorkflowToEntity(wf, ns, this.translatorContext),
    ]);
  }

  private async refreshDeploymentPipeline(
    ns: string,
    name: string,
  ): Promise<void> {
    const client = await this.createApiClient();
    const pipeline = await this.fetchDeploymentPipeline(client, ns, name);
    if (!pipeline) {
      await this.removeEntityRefs([
        this.buildEntityRef('deploymentpipeline', ns, name),
      ]);
      return;
    }
    // The DP entity is a faithful translation of the DP CR. The
    // Project↔Pipeline relation is emitted by SystemEntityProcessor from
    // the Project side using `System.spec.deploymentPipelineRef`, so no
    // cross-resource lookup is needed here.
    await this.upsertEntities([
      translateNewDeploymentPipelineToEntity(
        pipeline,
        ns,
        this.translatorContext,
      ),
    ]);
  }

  private async refreshClusterComponentType(name: string): Promise<void> {
    const client = await this.createApiClient();
    const cct = await this.fetchClusterComponentType(client, name);
    if (!cct) {
      await this.removeEntityRefs([
        this.buildEntityRef('clustercomponenttype', 'openchoreo-cluster', name),
        this.buildEntityRef(
          'template',
          'openchoreo-cluster',
          `template-${name}`,
        ),
      ]);
      return;
    }
    const cctEntity = translateNewClusterComponentTypeToEntity(
      cct,
      this.translatorContext,
    ) as Entity;
    const templateEntity = await this.buildClusterComponentTypeTemplateEntity(
      client,
      cct,
    );
    const entities: Entity[] = templateEntity
      ? [cctEntity, templateEntity]
      : [cctEntity];
    await this.upsertEntities(entities);
  }

  private async refreshClusterResourceType(name: string): Promise<void> {
    const client = await this.createApiClient();
    const crt = await this.fetchClusterResourceType(client, name);
    if (!crt) {
      await this.removeEntityRefs([
        this.buildEntityRef('clusterresourcetype', 'openchoreo-cluster', name),
        this.buildEntityRef(
          'template',
          'openchoreo-cluster',
          `template-resource-${name}`,
        ),
      ]);
      return;
    }
    const crtEntity = translateNewClusterResourceTypeToEntity(
      crt,
      this.translatorContext,
    ) as Entity;
    const templateEntity = await this.buildClusterResourceTypeTemplateEntity(
      client,
      crt,
    );
    const entities: Entity[] = templateEntity
      ? [crtEntity, templateEntity]
      : [crtEntity];
    await this.upsertEntities(entities);
  }

  private async refreshClusterProjectType(name: string): Promise<void> {
    const client = await this.createApiClient();
    const cpt = await this.fetchClusterProjectType(client, name);
    if (!cpt) {
      await this.removeEntityRefs([
        this.buildEntityRef('clusterprojecttype', 'openchoreo-cluster', name),
        this.buildEntityRef(
          'template',
          'openchoreo-cluster',
          `template-project-${name}`,
        ),
      ]);
      return;
    }
    const cptEntity = translateNewClusterProjectTypeToEntity(
      cpt,
      this.translatorContext,
    ) as Entity;
    const templateEntity = this.buildClusterProjectTypeTemplateEntity(cpt);
    await this.upsertEntities(
      templateEntity ? [cptEntity, templateEntity] : [cptEntity],
    );
  }

  private async refreshClusterTrait(name: string): Promise<void> {
    const client = await this.createApiClient();
    const ct = await this.fetchClusterTrait(client, name);
    if (!ct) {
      await this.removeEntityRefs([
        this.buildEntityRef('clustertraittype', 'openchoreo-cluster', name),
      ]);
      return;
    }
    await this.upsertEntities([
      translateNewClusterTraitToEntity(ct, this.translatorContext) as Entity,
    ]);
  }

  private async refreshClusterWorkflow(name: string): Promise<void> {
    const client = await this.createApiClient();
    const cw = await this.fetchClusterWorkflow(client, name);
    if (!cw) {
      await this.removeEntityRefs([
        this.buildEntityRef('clusterworkflow', 'openchoreo-cluster', name),
      ]);
      return;
    }
    await this.upsertEntities([
      translateNewClusterWorkflowToEntity(cw, this.translatorContext) as Entity,
    ]);
  }

  private async refreshClusterDataPlane(name: string): Promise<void> {
    const client = await this.createApiClient();
    const cdp = await this.fetchClusterDataPlane(client, name);
    if (!cdp) {
      await this.removeEntityRefs([
        this.buildEntityRef('clusterdataplane', 'openchoreo-cluster', name),
      ]);
      return;
    }
    await this.upsertEntities([
      translateNewClusterDataplaneToEntity(
        cdp,
        this.translatorContext,
      ) as Entity,
    ]);
  }

  private async refreshClusterObservabilityPlane(name: string): Promise<void> {
    const client = await this.createApiClient();
    const cop = await this.fetchClusterObservabilityPlane(client, name);
    if (!cop) {
      await this.removeEntityRefs([
        this.buildEntityRef(
          'clusterobservabilityplane',
          'openchoreo-cluster',
          name,
        ),
      ]);
      return;
    }
    await this.upsertEntities([
      translateNewClusterObservabilityPlaneToEntity(
        cop,
        this.translatorContext,
      ) as Entity,
    ]);
  }

  private async refreshClusterWorkflowPlane(name: string): Promise<void> {
    const client = await this.createApiClient();
    const cwp = await this.fetchClusterWorkflowPlane(client, name);
    if (!cwp) {
      await this.removeEntityRefs([
        this.buildEntityRef('clusterworkflowplane', 'openchoreo-cluster', name),
      ]);
      return;
    }
    await this.upsertEntities([
      translateNewClusterWorkflowPlaneToEntity(
        cwp,
        this.translatorContext,
      ) as Entity,
    ]);
  }

  // -------------------------- Dispatch -----------------------------------

  /**
   * Handle one OpenChoreo webhook event by refreshing only the affected
   * entity. All translators and processors used here are the same ones
   * the periodic full sync uses, so both paths converge to the same
   * catalog state.
   *
   * Note: a Project's `deploymentPipelineRef` change does not need any
   * fan-out. The DP↔Project relation pair is emitted by
   * `SystemEntityProcessor` from the Project side, so re-processing the
   * System entity after a refresh naturally produces relations against
   * the new pipeline and discards the previous one.
   */
  async handleEvent(
    kind: string,
    name: string,
    namespace: string | undefined,
    action: string,
  ): Promise<void> {
    void action;
    const ns = namespace ?? 'default';
    switch (kind.toLowerCase()) {
      case 'namespace':
        // Kubernetes Namespace events from the event-forwarder are
        // already filtered server-side to OC-managed organizations. The
        // event payload's namespace field is empty (Namespaces are
        // cluster-scoped); the namespace name is in `name`.
        await this.refreshDomain(name);
        return;
      case 'project':
        await this.refreshProject(ns, name);
        return;
      case 'component':
        await this.refreshComponent(ns, name);
        return;
      case 'workload':
        await this.handleWorkloadEvent(ns, name, action);
        return;
      case 'environment':
        await this.refreshEnvironment(ns, name);
        return;
      case 'observabilityalertsnotificationchannel':
        await this.refreshNotificationChannel(ns, name);
        return;
      case 'dataplane':
        await this.refreshDataPlane(ns, name);
        return;
      case 'workflowplane':
        await this.refreshWorkflowPlane(ns, name);
        return;
      case 'observabilityplane':
        await this.refreshObservabilityPlane(ns, name);
        return;
      case 'deploymentpipeline':
        await this.refreshDeploymentPipeline(ns, name);
        return;
      case 'componenttype':
        await this.refreshComponentType(ns, name);
        return;
      case 'trait':
        await this.refreshTrait(ns, name);
        return;
      case 'resourcetype':
        await this.refreshResourceType(ns, name);
        return;
      case 'projecttype':
        await this.refreshProjectType(ns, name);
        return;
      case 'resource':
        await this.refreshResource(ns, name);
        return;
      case 'workflow':
        await this.refreshWorkflow(ns, name);
        return;
      case 'clustercomponenttype':
        await this.refreshClusterComponentType(name);
        return;
      case 'clusterresourcetype':
        await this.refreshClusterResourceType(name);
        return;
      case 'clusterprojecttype':
        await this.refreshClusterProjectType(name);
        return;
      case 'clustertrait':
        await this.refreshClusterTrait(name);
        return;
      case 'clusterworkflow':
        await this.refreshClusterWorkflow(name);
        return;
      case 'clusterdataplane':
        await this.refreshClusterDataPlane(name);
        return;
      case 'clusterobservabilityplane':
        await this.refreshClusterObservabilityPlane(name);
        return;
      case 'clusterworkflowplane':
        await this.refreshClusterWorkflowPlane(name);
        return;
      default:
        this.logger.warn(`Unknown OpenChoreo event kind "${kind}", ignoring`);
    }
  }

  /**
   * Handle a Workload event by resolving its owning Component and
   * refreshing that component (not the Workload itself — Workloads
   * don't map to Backstage entities; they only contribute providesApis,
   * consumesApis, and the derived API entities to their owning
   * Component).
   *
   * Resolution: fetch the Workload by its own name, read
   * `spec.owner.componentName` (canonical, immutable schema field), or
   * fall back to the `openchoreo.dev/component` label which OC's
   * controllers project for selector convenience. The fetched workload
   * is passed straight through to refreshComponent so it isn't fetched
   * a second time inside.
   *
   * Deletion: query the catalog for entities annotated with this
   * workload's name (`openchoreo.io/workload`), remove the API entities,
   * and refresh the parent Component so its `spec.providesApis` array
   * stops referencing the now-deleted entities. If the catalog has no
   * record of the workload yet (cold-start race), log and let the
   * periodic full sync reconcile.
   */
  private async handleWorkloadEvent(
    ns: string,
    name: string,
    action: string,
  ): Promise<void> {
    if (action === 'deleted') {
      await this.handleWorkloadDeleted(ns, name);
      return;
    }

    const client = await this.createApiClient();
    const workload = await this.fetchWorkloadByName(client, ns, name);
    if (!workload) {
      // Race: workload deleted between event dispatch and our fetch.
      // Defer to the next full sync rather than guessing the component.
      this.logger.warn(
        `Workload ${ns}/${name} not found at fetch time (likely deleted); deferring to periodic full sync`,
      );
      return;
    }

    const componentName =
      (workload.spec as { owner?: { componentName?: string } } | undefined)
        ?.owner?.componentName ??
      workload.metadata?.labels?.['openchoreo.dev/component'];
    if (!componentName) {
      this.logger.warn(
        `Workload ${ns}/${name} has no spec.owner.componentName or openchoreo.dev/component label; cannot link to a component`,
      );
      return;
    }

    await this.refreshComponent(ns, componentName, workload);
  }

  /**
   * Workload-deletion handler. Two-step reconciliation:
   *
   *   1. Query the catalog for entities annotated with
   *      `openchoreo.io/workload=<workloadName>`. The full-sync and
   *      event-driven paths both stamp this annotation when emitting
   *      Component and API entities, so the result set contains the
   *      parent Component plus every API entity derived from this
   *      workload's schema-bearing endpoints.
   *
   *   2. Remove the API entities by entity-ref, and refresh the
   *      Component so its `spec.providesApis`/`consumesApis` get
   *      recomputed (they'll come back empty, since the workload is
   *      gone) and any dangling refs disappear.
   *
   * If the catalog returns nothing (cold-start race: workload events
   * arrived before the first periodic full sync had a chance to
   * populate annotations), log and defer to the next full sync — the
   * `type: 'full'` mutation will reconcile any drift.
   */
  private async handleWorkloadDeleted(
    ns: string,
    workloadName: string,
  ): Promise<void> {
    if (!this.catalogService || !this.auth) {
      this.logger.warn(
        `Workload ${ns}/${workloadName} deleted, but no CatalogService is wired; periodic full sync will reconcile.`,
      );
      return;
    }

    const credentials = await this.auth.getOwnServiceCredentials();
    const annotationKey = `metadata.annotations.${CHOREO_ANNOTATIONS.WORKLOAD}`;
    let response;
    try {
      response = await this.catalogService.getEntities(
        { filter: { [annotationKey]: workloadName } },
        { credentials },
      );
    } catch (err) {
      this.logger.warn(
        `Catalog query for workload ${ns}/${workloadName} failed; deferring to periodic full sync: ${err}`,
      );
      return;
    }

    const apiRefs = response.items
      .filter(e => e.kind === 'API')
      .map(e => stringifyEntityRef(e));
    const component = response.items.find(e => e.kind === 'Component');

    if (apiRefs.length === 0 && !component) {
      this.logger.info(
        `Workload ${ns}/${workloadName} deleted; no annotated entities in catalog yet (cold-start race). Periodic full sync will reconcile.`,
      );
      return;
    }

    if (apiRefs.length > 0) {
      await this.removeEntityRefs(apiRefs);
    }

    if (component) {
      await this.refreshComponent(
        component.metadata.namespace ?? 'default',
        component.metadata.name,
      );
    }

    this.logger.info(
      `Workload ${ns}/${workloadName} deleted; removed ${
        apiRefs.length
      } API entity(ies)${
        component
          ? ` and refreshed parent component ${
              component.metadata.namespace ?? 'default'
            }/${component.metadata.name}`
          : ''
      }`,
    );
  }
}
