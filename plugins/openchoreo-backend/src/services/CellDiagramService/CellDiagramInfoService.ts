import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

import {
  Project,
  Component,
  Connection as CellDiagramConnection,
} from '@wso2/cell-diagram';
import { CellDiagramService } from '../../types';
import {
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
  ObservabilityUrlResolver,
  fetchAllPages,
  type ObservabilityComponents,
} from '@openchoreo/openchoreo-client-node';
import { ComponentTypeUtils } from '@openchoreo/backstage-plugin-common';
import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

// Use generated OpenAPI schemas directly. CellDiagramInfoService previously
// cast workload.spec through the hand-rolled `bff-types.WorkloadResponse`,
// which had drifted behind the API (it never gained `dependencies.resources`).
// The rest of the codebase — WorkloadEditor, resource-dependency editor,
// per-CRD services — already reads workload data through these generated
// schemas, so we follow the same pattern here.
type WorkloadSpec = OpenChoreoComponents['schemas']['WorkloadSpec'];
type WorkloadEndpoint = OpenChoreoComponents['schemas']['WorkloadEndpoint'];
type EndpointDependency = OpenChoreoComponents['schemas']['WorkloadConnection'];
type ResourceDependency =
  OpenChoreoComponents['schemas']['WorkloadResourceDependency'];

type HttpMetrics = ObservabilityComponents['schemas']['HttpMetricsTimeSeries'];
type RuntimeTopologyMetrics =
  ObservabilityComponents['schemas']['RuntimeTopologyMetrics'];
type RuntimeTopologyEdge =
  ObservabilityComponents['schemas']['RuntimeTopologyEdge'];

interface ObservationEntry {
  sourceNodeId: number;
  destinationNodeId: number;
  requestCount: number;
  errorCount: number;
  avgLatency: number;
  p50Latency: number;
  p90Latency: number;
  p99Latency: number;
}

function avgSeries(series?: { value?: number }[]): number {
  const points = (series ?? []).filter(p => typeof p.value === 'number');
  if (points.length === 0) return 0;
  return points.reduce((s, p) => s + (p.value ?? 0), 0) / points.length;
}

// Cell diagram lib (v1 model) interprets latency as nanoseconds (lib divides by 1e6 for ms).
// Observer returns latency in seconds, so convert.
const NS_PER_SEC = 1_000_000_000;

function aggregateHttpMetrics(
  http: HttpMetrics,
  durationSec: number,
): ObservationEntry | undefined {
  // Observer returns rates (req/s) at each timestamp.
  // Total = mean(rate) * window duration in seconds.
  const requestCount = Math.round(avgSeries(http.requestCount) * durationSec);
  if (requestCount === 0) return undefined;
  const errorCount = Math.round(
    avgSeries(http.unsuccessfulRequestCount) * durationSec,
  );
  return {
    sourceNodeId: 0,
    destinationNodeId: 0,
    requestCount,
    errorCount,
    avgLatency: avgSeries(http.meanLatency) * NS_PER_SEC,
    p50Latency: avgSeries(http.latencyP50) * NS_PER_SEC,
    p90Latency: avgSeries(http.latencyP90) * NS_PER_SEC,
    p99Latency: avgSeries(http.latencyP99) * NS_PER_SEC,
  };
}

// Convert a RuntimeTopologyMetrics (already-aggregated scalars in seconds)
// into the cell-diagram lib's Observation shape (latency in nanoseconds).
function adaptRuntimeTopologyMetrics(
  metrics?: RuntimeTopologyMetrics,
): ObservationEntry | undefined {
  if (!metrics) return undefined;
  const requestCount = Math.round(metrics.requestCount ?? 0);
  if (requestCount <= 0) return undefined;
  return {
    sourceNodeId: 0,
    destinationNodeId: 0,
    requestCount,
    errorCount: Math.round(metrics.unsuccessfulRequestCount ?? 0),
    avgLatency: (metrics.meanLatency ?? 0) * NS_PER_SEC,
    p50Latency: (metrics.latencyP50 ?? 0) * NS_PER_SEC,
    p90Latency: (metrics.latencyP90 ?? 0) * NS_PER_SEC,
    p99Latency: (metrics.latencyP99 ?? 0) * NS_PER_SEC,
  };
}

// Local shape carried through buildProject / generateConnections. Narrower
// than `ComponentResponse` so the workload field can use the generated
// `WorkloadSpec` (which includes `dependencies.resources`) instead of the
// hand-rolled bff-types `WorkloadResponse`.
interface CompleteComponent {
  name: string;
  type: string;
  workload?: WorkloadSpec;
}

enum ComponentType {
  SERVICE = 'service',
  WEB_APP = 'web-app',
  SCHEDULED_TASK = 'scheduled-task',
  MANUAL_TASK = 'manual-task',
  API_PROXY = 'api-proxy',
  WEB_HOOK = 'web-hook',
  EVENT_HANDLER = 'event-handler',
  TEST = 'test',
  EXTERNAL_CONSUMER = 'external-consumer',
  SYSTEM_COMPONENT = 'system',
}

enum ConnectionType {
  HTTP = 'http',
  GRPC = 'grpc',
  WebSocket = 'web-socket',
  Connector = 'connector',
  Datastore = 'datastore',
}

/**
 * Service implementation for fetching and managing Cell Diagram information.
 * @implements {CellDiagramService}
 */
export class CellDiagramInfoService implements CellDiagramService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;
  private readonly componentTypeUtils: ComponentTypeUtils;
  private readonly resolver: ObservabilityUrlResolver;

  public constructor(logger: LoggerService, baseUrl: string, config: Config) {
    this.baseUrl = baseUrl;
    this.logger = logger;
    this.componentTypeUtils = ComponentTypeUtils.fromConfig(config);
    this.resolver = new ObservabilityUrlResolver({ baseUrl, logger });
  }

  async fetchProjectInfo(
    {
      projectName,
      namespaceName,
      environmentName,
      startTime,
      endTime,
    }: {
      projectName: string;
      namespaceName: string;
      environmentName?: string;
      startTime?: string;
      endTime?: string;
    },
    token?: string,
  ): Promise<Project | undefined> {
    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // Fetch components and workloads in parallel (2 calls instead of N+1).
      // We don't need to fetch Resources here: the cell-diagram lib synthesizes
      // resource nodes from each Datastore connection a workload declares.
      // Resources that aren't consumed by any workload are not part of the
      // wired topology and won't appear in the diagram.
      const [componentItems, workloadItems] = await Promise.all([
        fetchAllPages(cursor =>
          client
            .GET('/api/v1/namespaces/{namespaceName}/components', {
              params: {
                path: { namespaceName },
                query: { project: projectName, limit: 100, cursor },
              },
            })
            .then(res => {
              if (res.error || !res.response.ok) {
                throw new Error(
                  `Failed to fetch components: ${res.response.status} ${res.response.statusText}`,
                );
              }
              return res.data;
            }),
        ),
        fetchAllPages(cursor =>
          client
            .GET('/api/v1/namespaces/{namespaceName}/workloads', {
              params: {
                path: { namespaceName },
                query: { project: projectName, limit: 100, cursor },
              },
            })
            .then(res => {
              if (res.error || !res.response.ok) {
                throw new Error(
                  `Failed to fetch workloads: ${res.response.status} ${res.response.statusText}`,
                );
              }
              return res.data;
            }),
        ),
      ]);

      if (!componentItems.length) {
        this.logger.warn('No components found in API response');
        return undefined;
      }

      // Build a map from component name to workload spec
      // Key by owner.componentName (not workload metadata name, which differs)
      const workloadMap = new Map<string, WorkloadSpec>();
      for (const workload of workloadItems) {
        const componentName = (
          workload.spec?.owner as { componentName?: string } | undefined
        )?.componentName;
        if (componentName && workload.spec) {
          workloadMap.set(componentName, workload.spec as WorkloadSpec);
        }
      }

      const completeComponents: CompleteComponent[] = componentItems
        .map(comp => {
          const name = comp.metadata?.name ?? '';
          const componentTypeRef = comp.spec?.componentType;
          const componentType =
            typeof componentTypeRef === 'string'
              ? componentTypeRef
              : componentTypeRef?.name ?? '';
          const workloadSpec = workloadMap.get(name);

          return {
            name,
            type: componentType,
            workload: workloadSpec,
          } as CompleteComponent;
        })
        .filter(comp => comp.name);

      const project = this.buildProject(
        projectName,
        namespaceName,
        completeComponents,
      );

      if (environmentName) {
        await this.enrichWithObservations(project, {
          namespaceName,
          projectName,
          environmentName,
          startTime,
          endTime,
          token,
        });
      }

      return project;
    } catch (error: unknown) {
      this.logger.error(
        `Error fetching project info for ${projectName}: ${error}`,
      );
      return undefined;
    }
  }

  /**
   * Top-level enrichment: resolves the observer URL once, then fetches gateway
   * and connection observations in parallel:
   *   - Gateway observations: per-component HTTP metrics from /api/v1/metrics/query.
   *     Populates gateway observations on services with exposed gateways.
   *   - Connection observations: per-edge HTTP metrics from /api/v1alpha1/metrics/runtime-topology.
   *     Populates component-to-component connection observations. Component
   *     names come directly from the response (pod labels via Prometheus).
   */
  private async enrichWithObservations(
    project: Project,
    params: {
      namespaceName: string;
      projectName: string;
      environmentName: string;
      startTime?: string;
      endTime?: string;
      token?: string;
    },
  ): Promise<void> {
    const { namespaceName, environmentName, token } = params;
    try {
      const { observerUrl } = await this.resolver.resolveForEnvironment(
        namespaceName,
        environmentName,
        token,
      );
      if (!observerUrl) {
        this.logger.info(
          `No observer URL for environment '${environmentName}', skipping runtime observations`,
        );
        return;
      }
      this.logger.info(
        `Using observer URL '${observerUrl}' for environment '${environmentName}'`,
      );

      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        token,
        this.logger,
      );

      const startTime =
        params.startTime ?? new Date(Date.now() - 3_600_000).toISOString();
      const endTime = params.endTime ?? new Date().toISOString();

      await Promise.all([
        this.enrichGatewaysFromHttpMetrics(project, obsClient, {
          ...params,
          startTime,
          endTime,
        }),
        this.enrichConnectionsFromRuntimeTopology(project, obsClient, {
          ...params,
          startTime,
          endTime,
        }),
      ]);
    } catch (error) {
      // observability errors must not break the cell diagram
      this.logger.warn(
        `Failed to enrich cell diagram with observations: ${error}`,
      );
    }
  }

  /**
   * Per-component HTTP metrics → gateway observations.
   * Sums per-component request rates from /api/v1/metrics/query and attaches
   * the result to any exposed gateway (internet/intranet).
   */
  private async enrichGatewaysFromHttpMetrics(
    project: Project,
    obsClient: ReturnType<typeof createObservabilityClientWithUrl>,
    params: {
      namespaceName: string;
      projectName: string;
      environmentName: string;
      startTime: string;
      endTime: string;
    },
  ): Promise<void> {
    const { namespaceName, projectName, environmentName, startTime, endTime } =
      params;
    const step = '5m';
    const durationSec = Math.max(
      1,
      (Date.parse(endTime) - Date.parse(startTime)) / 1000,
    );

    let attachedCount = 0;
    let zeroTrafficCount = 0;
    let noGatewayCount = 0;

    await Promise.all(
      project.components.map(async component => {
        try {
          const { data, error, response } = await obsClient.POST(
            '/api/v1/metrics/query',
            {
              body: {
                metric: 'http',
                startTime,
                endTime,
                step,
                searchScope: {
                  namespace: namespaceName,
                  project: projectName,
                  component: component.id,
                  environment: environmentName,
                },
              },
            },
          );
          if (error || !response.ok) {
            this.logger.warn(
              `HTTP metrics query failed for component '${component.id}': ${response.status} ${response.statusText}`,
            );
            return;
          }
          if (!data) return;

          const observation = aggregateHttpMetrics(
            data as HttpMetrics,
            durationSec,
          );
          if (!observation) {
            zeroTrafficCount += 1;
            return;
          }

          let attached = false;
          for (const service of Object.values(component.services ?? {})) {
            const gateways = (service as any)?.deploymentMetadata?.gateways;
            if (!gateways) continue;
            if (gateways.internet?.isExposed) {
              gateways.internet.observations = [observation];
              attached = true;
            }
            if (gateways.intranet?.isExposed) {
              gateways.intranet.observations = [observation];
              attached = true;
            }
          }
          if (attached) {
            attachedCount += 1;
          } else {
            noGatewayCount += 1;
          }
        } catch (err) {
          this.logger.warn(
            `Failed to enrich component '${component.id}': ${err}`,
          );
        }
      }),
    );

    this.logger.info(
      `Gateway observations for '${projectName}/${environmentName}': ${attachedCount} attached, ${zeroTrafficCount} zero-traffic, ${noGatewayCount} no-exposed-gateway`,
    );
  }

  /**
   * Per-edge HTTP metrics → connection observations.
   * Calls /api/v1alpha1/metrics/runtime-topology and merges the resulting edges
   * onto Project.components[].connections. Connection IDs use the format
   *   ${ns}:${project}:${dstComponent}:${endpoint}
   * but the runtime topology endpoint only knows components (not endpoints), so
   * we match by prefix and attach to all connections from src -> dst.
   *
   * If a runtime edge has no matching static connection, a runtime-only
   * connection is added with observationOnly=true so the diff layer can
   * highlight drift. Adapter currently only emits component->component edges;
   * gateway and external edges are skipped (TODO at the adapter side).
   */
  private async enrichConnectionsFromRuntimeTopology(
    project: Project,
    obsClient: ReturnType<typeof createObservabilityClientWithUrl>,
    params: {
      namespaceName: string;
      projectName: string;
      environmentName: string;
      startTime: string;
      endTime: string;
    },
  ): Promise<void> {
    const { namespaceName, projectName, environmentName, startTime, endTime } =
      params;
    let attached = 0;
    let runtimeOnly = 0;
    let skipped = 0;

    try {
      const { data, error, response } = await obsClient.POST(
        '/api/v1alpha1/metrics/runtime-topology',
        {
          body: {
            searchScope: {
              namespace: namespaceName,
              project: projectName,
              environment: environmentName,
            },
            startTime,
            endTime,
            includeGateways: true,
            includeExternal: true,
          },
        },
      );

      if (error || !response.ok) {
        // 404 likely means an older observer without the endpoint — log info,
        // not warn, so this isn't noisy during the rollout.
        if (response.status === 404) {
          this.logger.info(
            `runtime-topology endpoint not available (HTTP 404); skipping connection observations`,
          );
          return;
        }
        this.logger.warn(
          `runtime-topology query failed: ${response.status} ${response.statusText}`,
        );
        return;
      }
      const edges = (data?.edges ?? []) as RuntimeTopologyEdge[];
      if (edges.length === 0) {
        this.logger.info(
          `Runtime topology: no edges returned for '${projectName}/${environmentName}'`,
        );
        return;
      }

      for (const edge of edges) {
        this.logger.debug(
          `Runtime topology edge: src={kind=${edge.source.kind}, component=${
            edge.source.component ?? '-'
          }, uid=${edge.source.componentUid ?? '-'}} ` +
            `dst={kind=${edge.target.kind}, component=${
              edge.target.component ?? '-'
            }, uid=${edge.target.componentUid ?? '-'}} ` +
            `requestCount=${edge.metrics?.requestCount ?? 0}`,
        );

        // Adapter currently only emits component->component. Gateway and
        // external edges land here too once the adapter implements them; for
        // now, count them as skipped so logs reflect what was ignored.
        if (
          edge.source.kind !== 'component' ||
          edge.target.kind !== 'component'
        ) {
          this.logger.info(
            `Runtime topology skip (kind mismatch): src.kind=${edge.source.kind} dst.kind=${edge.target.kind}`,
          );
          skipped += 1;
          continue;
        }

        const srcName = edge.source.component;
        const dstName = edge.target.component;
        if (!srcName || !dstName) {
          this.logger.info(
            `Runtime topology skip (no component name): src=${JSON.stringify(
              edge.source,
            )} dst=${JSON.stringify(edge.target)}`,
          );
          skipped += 1;
          continue;
        }

        const observation = adaptRuntimeTopologyMetrics(edge.metrics);
        if (!observation) {
          this.logger.info(
            `Runtime topology skip (zero traffic): ${srcName} -> ${dstName} requestCount=${
              edge.metrics?.requestCount ?? 0
            }`,
          );
          skipped += 1;
          continue;
        }

        const srcComponent = project.components.find(c => c.id === srcName);
        if (!srcComponent) {
          this.logger.info(
            `Runtime topology skip (src component not found): srcName='${srcName}' available=[${project.components
              .map(c => c.id)
              .join(', ')}]`,
          );
          skipped += 1;
          continue;
        }

        const connectionPrefix = `${namespaceName}:${projectName}:${dstName}:`;
        const matching = (srcComponent.connections ?? []).filter(c =>
          (c.id ?? '').startsWith(connectionPrefix),
        );

        if (matching.length > 0) {
          for (const conn of matching) {
            const c = conn as CellDiagramConnection;
            c.observations = [observation];
            // The cell-diagram lib renders ObservationLabel only when !link.tooltip.
            // Clear the static text tooltip so the rich metrics panel takes over.
            c.tooltip = undefined;
          }
          attached += 1;
          this.logger.info(
            `Attached runtime observations to ${matching.length} connection(s) ` +
              `${srcName} -> ${dstName} (requestCount=${observation.requestCount})`,
          );
        } else {
          // Runtime-only edge — declared dependency missing in workload spec
          // but traffic was observed. Surfaced as observationOnly so the diff
          // layer can highlight drift.
          const conn: CellDiagramConnection = {
            id: `${namespaceName}:${projectName}:${dstName}:runtime`,
            label: `${dstName} (runtime)`,
            type: ConnectionType.HTTP,
            onPlatform: true,
            observationOnly: true,
            observations: [observation],
          };
          srcComponent.connections = [
            ...(srcComponent.connections ?? []),
            conn,
          ];
          runtimeOnly += 1;
          this.logger.info(
            `Added runtime-only connection ${srcName} -> ${dstName} ` +
              `(requestCount=${observation.requestCount})`,
          );
        }
      }

      this.logger.info(
        `Runtime topology for '${projectName}/${environmentName}': ${attached} attached, ${runtimeOnly} runtime-only, ${skipped} skipped (of ${edges.length} edges)`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to enrich connections from runtime cell graph: ${err}`,
      );
    }
  }

  private buildProject(
    projectName: string,
    namespaceName: string,
    completeComponents: CompleteComponent[],
  ): Project {
    const components: Component[] = completeComponents
      .filter(component => {
        if (!component.type) return false;
        // Exclude one-off jobs from the cell diagram
        return !component.type.startsWith('job/');
      })
      .map(component => {
        // Get dependencies from workload data included in component response
        const connections = this.generateConnections(
          component.workload?.dependencies?.endpoints,
          component.workload?.dependencies?.resources,
          namespaceName,
          projectName,
          completeComponents,
        );

        // cronjob/* components render as scheduled tasks
        if (component.type!.startsWith('cronjob/')) {
          return {
            id: component.name || '',
            label: component.name || '',
            version: '1.0.0',
            type: ComponentType.SCHEDULED_TASK,
            services: {
              main: {
                id: component.name || '',
                label: component.name || '',
                type: 'ScheduledTask',
                dependencyIds: [],
              },
            },
            connections: connections,
          } as Component;
        }

        // proxy/* components render as API proxies
        if (component.type!.startsWith('proxy/')) {
          return {
            id: component.name || '',
            label: component.name || '',
            version: '1.0.0',
            type: ComponentType.API_PROXY,
            services: {
              main: {
                id: component.name || '',
                label: component.name || '',
                type: 'ApiProxy',
                dependencyIds: [],
              },
            },
            connections: connections,
          } as Component;
        }

        // deployment/* and statefulset/*:
        // build service entries from workload endpoints
        const endpoints = (component.workload?.endpoints || {}) as {
          [key: string]: WorkloadEndpoint;
        };
        const services: { [key: string]: any } = {};
        let hasHttpEndpoint = false;

        if (Object.keys(endpoints).length > 0) {
          Object.entries(endpoints).forEach(([endpointName, endpoint]) => {
            const visibility = endpoint.visibility ?? [];
            if (endpoint.type === 'HTTP') {
              hasHttpEndpoint = true;
            }
            services[endpointName] = {
              id: component.name || '',
              label: component.name || '',
              type: endpoint.type || 'SERVICE',
              dependencyIds: [],
              deploymentMetadata: {
                gateways: {
                  internet: {
                    isExposed: visibility.includes('external'),
                  },
                  intranet: {
                    isExposed: visibility.includes('internal'),
                  },
                },
              },
            };
          });
        } else {
          // Fallback: create a default service entry so the component renders
          services.main = {
            id: component.name || '',
            label: component.name || '',
            type: 'SERVICE',
            dependencyIds: [],
            deploymentMetadata: {
              gateways: {
                internet: { isExposed: false },
                intranet: { isExposed: false },
              },
            },
          };
        }

        const pageVariant = this.componentTypeUtils.getPageVariant(
          component.type!,
        );
        const isWebApp = pageVariant === 'website' || hasHttpEndpoint;

        return {
          id: component.name || '',
          label: component.name || '',
          version: '1.0.0',
          type: isWebApp ? ComponentType.WEB_APP : ComponentType.SERVICE,
          services: services,
          connections: connections,
        } as Component;
      })
      .filter((component): component is Component => component !== null);

    return {
      id: projectName,
      name: projectName,
      modelVersion: '1.0.0',
      components,
      connections: [],
      configurations: [],
    };
  }

  private generateConnections(
    endpointDependencies: EndpointDependency[] | undefined,
    resourceDependencies: ResourceDependency[] | undefined,
    namespaceName: string,
    projectName: string,
    completeComponents: CompleteComponent[],
  ): CellDiagramConnection[] {
    const endpointConnections =
      endpointDependencies && endpointDependencies.length > 0
        ? this.buildEndpointConnections(
            endpointDependencies,
            namespaceName,
            projectName,
            completeComponents,
          )
        : [];

    const resourceConnections =
      resourceDependencies && resourceDependencies.length > 0
        ? this.buildResourceConnections(
            resourceDependencies,
            namespaceName,
            projectName,
          )
        : [];

    return [...endpointConnections, ...resourceConnections];
  }

  private buildResourceConnections(
    resourceDependencies: ResourceDependency[],
    namespaceName: string,
    projectName: string,
  ): CellDiagramConnection[] {
    // Emit one Datastore connection per resource dependency. The cell-diagram
    // lib auto-synthesizes a node from each connection (DatabaseIcon-styled),
    // shared across consumers that emit the same connection id. We don't need
    // to model the Resource as its own node — the lib does it for us.
    return resourceDependencies.map(dep => ({
      // 4-token id keeps the lib's getConnectionMetadata happy (splits on `:`,
      // expects 3 or 4 tokens). The label is what gets displayed on the node.
      id: `${namespaceName}:${projectName}:${dep.ref}:resource`,
      label: dep.ref,
      type: ConnectionType.Datastore,
      onPlatform: true,
      tooltip: `Resource: ${dep.ref}`,
    }));
  }

  private buildEndpointConnections(
    dependencies: EndpointDependency[],
    namespaceName: string,
    projectName: string,
    completeComponents: CompleteComponent[],
  ): CellDiagramConnection[] {
    return dependencies.map(dependency => {
      const dependentComponentName = dependency.component;
      const dependentProjectName = dependency.project || projectName;

      // Check if dependent component is within the same project
      const isInternal = dependentProjectName === projectName;
      const dependentComponent = completeComponents.find(
        comp => comp.name === dependentComponentName,
      );

      const connectionId =
        isInternal && dependentComponent
          ? `${namespaceName}:${projectName}:${dependentComponent.name}:${dependency.name}`
          : `${namespaceName}:${dependentProjectName}:${dependentComponentName}:${dependency.name}`;

      return {
        id: connectionId,
        label: `${dependentComponentName}/${dependency.name}`,
        type: ConnectionType.HTTP, // TODO Infer based on api response
        onPlatform: isInternal,
        tooltip: `Dependency on ${dependentComponentName} in ${dependentProjectName}`,
      };
    });
  }
}
