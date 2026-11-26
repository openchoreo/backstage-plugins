import type { LoggerService } from '@backstage/backend-plugin-api';
import type {
  FactRetriever,
  TechInsightFact,
} from '@backstage-community/plugin-tech-insights-node';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import {
  createObservabilityClientWithUrl,
  fetchAllPages,
} from '@openchoreo/openchoreo-client-node';
import {
  collectOpenChoreoFacts,
  createServiceClient,
  isReleaseLine,
  type OpenChoreoApiClient,
} from './collectOpenChoreoFacts';
import {
  componentPath,
  grantsUnconditionally,
  namespacePath,
  type ActionCapability,
} from './capabilities';
import {
  activeBindings,
  lineBindings,
  type ReleaseBinding,
} from './deploymentFacts';
import {
  alertCountsResolved,
  alertWindow,
  configuredTraits,
  createsAlertRule,
  environmentAlerts,
  OBSERVER_QUERY_LIMIT,
  type AlertsResult,
  type EnvironmentAlerts,
  type IncidentsResult,
  type TraitInstance,
  type TraitReference,
  type TraitSpec,
} from './alertingFacts';
import { observabilityResolver, perRun } from './observabilityPlanes';

export const OPENCHOREO_ALERTING_FACT_RETRIEVER_ID =
  'openchoreoAlertingFactRetriever';

interface ComponentSpec {
  owner?: { projectName?: string };
  componentType?: { kind?: string; name?: string };
  traits?: TraitReference[];
}

interface ComponentTypeSpec {
  traits?: TraitReference[];
}

type ObserverClient = ReturnType<typeof createObservabilityClientWithUrl>;

interface SearchScope {
  namespace: string;
  project: string;
  component: string;
  environment: string;
  releaseLine?: string;
}

type ObserverQuery = <T>(
  kind: 'alerts' | 'incidents',
  observerUrl: string,
  searchScope: SearchScope,
  signal: AbortSignal,
) => Promise<T | undefined>;

/**
 * Runs one observer query over the run's window. Resolves to undefined when
 * the observer doesn't answer, so only that entry's counts are left out.
 * A 401 (token rejected) and a 403 (grant missing) concern the service
 * credentials rather than one observer, so each is warned about once per run;
 * other failures once per run per observer.
 */
function observerQueries(
  token: string | undefined,
  logger: LoggerService,
  window: { startTime: string; endTime: string },
): ObserverQuery {
  const clients = new Map<string, ObserverClient>();
  const failingObservers = new Set<string>();
  let warnedUnauthenticated = false;
  let warnedForbidden = false;

  const clientFor = (observerUrl: string) => {
    let client = clients.get(observerUrl);
    if (!client) {
      client = createObservabilityClientWithUrl(observerUrl, token, logger);
      clients.set(observerUrl, client);
    }
    return client;
  };

  const failed = (observerUrl: string, reason: string) => {
    if (failingObservers.has(observerUrl)) {
      logger.debug(`Observer ${observerUrl} failed again: ${reason}`);
      return;
    }
    failingObservers.add(observerUrl);
    logger.warn(
      `Leaving out the alert or incident counts that observer ${observerUrl} can't provide: ${reason}. Further failures from it are logged at debug level until the next run.`,
    );
  };

  return async <T>(
    kind: 'alerts' | 'incidents',
    observerUrl: string,
    searchScope: SearchScope,
    signal: AbortSignal,
  ) => {
    const subject = `${kind} query for ${searchScope.namespace}/${
      searchScope.component
    }${searchScope.releaseLine ? `:${searchScope.releaseLine}` : ''} in ${
      searchScope.environment
    }`;
    try {
      const { data, error, response } = await clientFor(observerUrl).POST(
        kind === 'alerts'
          ? '/api/v1alpha1/alerts/query'
          : '/api/v1alpha1/incidents/query',
        {
          body: {
            ...window,
            limit: OBSERVER_QUERY_LIMIT,
            sortOrder: 'desc',
            searchScope,
          },
          signal,
        },
      );
      if (data) {
        return data as T;
      }
      const { status } = response;
      if (status === 401) {
        if (!warnedUnauthenticated) {
          warnedUnauthenticated = true;
          logger.warn(
            `Leaving out alert and incident counts the observer rejects: observer ${observerUrl} didn't accept the portal's service token for an ${subject} (HTTP 401). Check that openchoreo.auth has service credentials and that the observer accepts their issuer and audience.`,
          );
        }
        return undefined;
      }
      if (status === 403) {
        if (!warnedForbidden) {
          warnedForbidden = true;
          logger.warn(
            `Leaving out alert and incident counts the observer refuses: the portal service credentials need alerts:view and incidents:view on components (observer ${observerUrl} returned HTTP 403 for an ${subject})`,
          );
        }
        return undefined;
      }
      if (status === 400 && error?.errorCode === 'SCOPE_NOT_FOUND') {
        logger.debug(
          `Observer ${observerUrl} doesn't know the scope of the ${subject} yet`,
        );
        return undefined;
      }
      failed(observerUrl, `the ${subject} returned HTTP ${status}`);
    } catch (error) {
      failed(observerUrl, `the ${subject} failed: ${(error as Error).message}`);
    }
    return undefined;
  };
}

/**
 * Counts the configured trait instances whose trait creates an
 * ObservabilityAlertRule. A trait or component type that doesn't exist
 * contributes nothing; any other failed read throws.
 */
function alertRuleCounter(client: OpenChoreoApiClient) {
  const types = perRun<ComponentTypeSpec | null>();
  const traits = perRun<boolean>();

  function componentType(
    namespaceName: string,
    ref: ComponentSpec['componentType'],
    signal: AbortSignal,
  ): Promise<ComponentTypeSpec | null> {
    // The reference is {workloadType}/{componentTypeName}.
    const name = ref?.name?.slice(ref.name.indexOf('/') + 1);
    if (!name) {
      return Promise.resolve(null);
    }
    const clusterScoped = ref?.kind === 'ClusterComponentType';
    return types(
      clusterScoped
        ? `ClusterComponentType/${name}`
        : `ComponentType/${namespaceName}/${name}`,
      async () => {
        const { data, response } = clusterScoped
          ? await client.GET('/api/v1/clustercomponenttypes/{cctName}', {
              params: { path: { cctName: name } },
              signal,
            })
          : await client.GET(
              '/api/v1/namespaces/{namespaceName}/componenttypes/{ctName}',
              { params: { path: { namespaceName, ctName: name } }, signal },
            );
        if (response.status === 404) {
          return null;
        }
        if (!data) {
          throw new Error(
            `GET ${ref?.kind ?? 'ComponentType'} ${name} returned HTTP ${
              response.status
            }`,
          );
        }
        return (data.spec ?? {}) as ComponentTypeSpec;
      },
    );
  }

  function isAlertRule(
    namespaceName: string,
    trait: TraitInstance,
    signal: AbortSignal,
  ): Promise<boolean> {
    const clusterScoped = trait.kind === 'ClusterTrait';
    return traits(
      clusterScoped
        ? `ClusterTrait/${trait.name}`
        : `Trait/${namespaceName}/${trait.name}`,
      async () => {
        const { data, response } = clusterScoped
          ? await client.GET('/api/v1/clustertraits/{clusterTraitName}', {
              params: { path: { clusterTraitName: trait.name } },
              signal,
            })
          : await client.GET(
              '/api/v1/namespaces/{namespaceName}/traits/{traitName}',
              {
                params: { path: { namespaceName, traitName: trait.name } },
                signal,
              },
            );
        if (response.status === 404) {
          return false;
        }
        if (!data) {
          throw new Error(
            `GET ${trait.kind} ${trait.name} returned HTTP ${response.status}`,
          );
        }
        return createsAlertRule((data.spec ?? {}) as TraitSpec);
      },
    );
  }

  return async (
    namespaceName: string,
    component: ComponentSpec,
    lineTraits: TraitReference[] | undefined,
    signal: AbortSignal,
  ): Promise<number> => {
    const type = await componentType(
      namespaceName,
      component.componentType,
      signal,
    );
    let count = 0;
    for (const trait of configuredTraits({
      componentTraits: component.traits,
      typeTraits: type?.traits,
      clusterScopedType:
        component.componentType?.kind === 'ClusterComponentType',
      lineTraits,
    })) {
      if (await isAlertRule(namespaceName, trait, signal)) {
        count++;
      }
    }
    return count;
  };
}

/** The release bindings of every line of a component, read once per run. */
function bindingLoader(client: OpenChoreoApiClient) {
  const loads = perRun<ReleaseBinding[]>();
  return (namespaceName: string, componentName: string, signal: AbortSignal) =>
    loads(`${namespaceName}/${componentName}`, async () => {
      const bindings = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/namespaces/{namespaceName}/releasebindings', {
            params: {
              path: { namespaceName },
              query: { component: componentName, cursor },
            },
            signal,
          })
          .then(({ data, response }) => {
            if (!data) {
              throw new Error(
                `GET release bindings returned HTTP ${response.status}`,
              );
            }
            return data;
          }),
      );
      return bindings as ReleaseBinding[];
    });
}

/**
 * A component's spec, read once per run and shared by its main line and its
 * release lines. Null when the component doesn't exist.
 */
function componentLoader(client: OpenChoreoApiClient) {
  const loads = perRun<ComponentSpec | null>();
  return (namespaceName: string, componentName: string, signal: AbortSignal) =>
    loads(`${namespaceName}/${componentName}`, async () => {
      const { data, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        { params: { path: { namespaceName, componentName } }, signal },
      );
      if (response.status === 404) {
        return null;
      }
      if (!data) {
        throw new Error(
          `GET component ${componentName} returned HTTP ${response.status}`,
        );
      }
      return (data.spec ?? {}) as ComponentSpec;
    });
}

/** The authz profile of a namespace, read once per run. */
function profileLoader(client: OpenChoreoApiClient) {
  const loads = perRun<Record<string, ActionCapability>>();
  return (namespaceName: string, signal: AbortSignal) =>
    loads(namespaceName, async () => {
      const { data, response } = await client.GET('/api/v1/authz/profile', {
        params: { query: { namespace: namespaceName } },
        signal,
      });
      if (!data) {
        throw new Error(
          `GET authz profile for namespace ${namespaceName} returned HTTP ${response.status}`,
        );
      }
      return (data.capabilities ?? {}) as Record<string, ActionCapability>;
    });
}

const COUNT_LEFT_OUT =
  "Left out when the environment has no observer, or the observer refuses or fails the query or doesn't know the component or line yet";

const ENVIRONMENT_ALERT_ENTRIES = {
  environment: { type: 'string', description: 'Environment name' },
  isProduction: {
    type: 'boolean',
    description:
      "Whether the environment is marked as production, false when the Environment doesn't exist. Left out when the Environment can't be read.",
  },
  hasObservability: {
    type: 'boolean',
    description:
      "Whether an observer serves the environment, through its DataPlane's ObservabilityPlane, false when the Environment doesn't exist. Left out when the Environment or a plane can't be read.",
  },
  alertsFiredLast30Days: {
    type: 'integer',
    description: `Alerts fired in the last 30 days. ${COUNT_LEFT_OUT}.`,
  },
  criticalAlertsLast30Days: {
    type: 'integer',
    description: `Alerts fired in the last 30 days by a rule with critical severity. ${COUNT_LEFT_OUT}, or returns fewer alerts than it counts (more than 1000).`,
  },
  incidentsLast30Days: {
    type: 'integer',
    description: `Incidents triggered in the last 30 days. ${COUNT_LEFT_OUT}.`,
  },
  openIncidentsLast30Days: {
    type: 'integer',
    description: `Incidents triggered in the last 30 days that are still active or acknowledged. ${COUNT_LEFT_OUT}, or returns fewer incidents than it counts (more than 1000).`,
  },
  unacknowledgedIncidentsLast30Days: {
    type: 'integer',
    description: `Incidents triggered in the last 30 days that are still active, not yet acknowledged. Left out as openIncidentsLast30Days is.`,
  },
};

const schema: FactRetriever['schema'] = {
  openchoreoAlertingResolved: {
    type: 'boolean',
    description:
      'Whether the component, and for a release line the line, was found in OpenChoreo. When false, every other fact is left out. Components the OpenChoreo catalog provider did not create get no facts.',
  },
  openchoreoConfiguredAlertRuleCount: {
    type: 'integer',
    description:
      "Alert rule trait instances configured on the component, embedded in its component type and, for a release line, added by the line: instances of a Trait or ClusterTrait that creates an ObservabilityAlertRule. Counts configuration, not rules that render in an environment. Left out when a trait or the component type can't be read.",
  },
  openchoreoEnvironmentAlerts: {
    type: 'set',
    description:
      "One entry per environment the line, the main line for a component, has an active release binding in, with alert and incident counts over the trailing 30 days. Select entries with a condition's path and the everyFact: or someFact: operators, e.g. path $[?(@.isProduction)].unacknowledgedIncidentsLast30Days with everyFact:equal 0. Reported only when the portal service credentials can read every binding of the component and every environment in its namespace. Left out for a line with no active binding, so its checks show no result, and when the release bindings or the namespace's authz profile can't be read. A field that can't be determined is left out of its entry.",
    metadata: { entries: ENVIRONMENT_ALERT_ENTRIES },
  },
  openchoreoAlertCountsResolved: {
    type: 'boolean',
    description:
      "True when every openchoreoEnvironmentAlerts entry with observability holds all its alert and incident counts and at least one entry has observability. Never false: left out when any count of such an entry is missing (the observer refused or failed a query, doesn't know the component or line yet, or returned fewer items than it counts), when an entry's hasObservability is unknown, when no entry has observability, and whenever openchoreoEnvironmentAlerts is left out. Entries without observability don't count against it. Pair it, with equal true, with a condition whose path reads the count fields, so an incomplete count skips the check instead of passing it on the environments that returned counts.",
  },
};

const UNRESOLVED_FACTS = { openchoreoAlertingResolved: false };

export function createOpenChoreoAlertingFactRetriever(
  tokenService: OpenChoreoTokenService,
): FactRetriever {
  return {
    id: OPENCHOREO_ALERTING_FACT_RETRIEVER_ID,
    version: '0.1.0',
    title: 'OpenChoreo Alerts and Incidents',
    description:
      "The alert rules configured on an OpenChoreo component's main line or a release line, and the alerts and incidents of the last 30 days in each environment it's bound to, read from the OpenChoreo API and each environment's observer.",
    entityFilter: [{ kind: 'component' }, { kind: 'releaseline' }],
    schema,
    handler: context =>
      collectOpenChoreoFacts(
        context,
        async () => {
          const client = await createServiceClient(context, tokenService);
          const token = tokenService.hasServiceCredentials()
            ? await tokenService.getServiceToken()
            : undefined;
          return {
            client,
            componentOf: componentLoader(client),
            profileOf: profileLoader(client),
            bindingsOf: bindingLoader(client),
            countAlertRules: alertRuleCounter(client),
            observabilityOf: observabilityResolver(client, context.logger),
            query: observerQueries(
              token,
              context.logger,
              alertWindow(new Date()),
            ),
          };
        },
        async (
          entity,
          {
            client,
            componentOf,
            profileOf,
            bindingsOf,
            countAlertRules,
            observabilityOf,
            query,
          },
          signal,
        ) => {
          const annotations = entity.metadata.annotations ?? {};
          const namespaceName = annotations[CHOREO_ANNOTATIONS.NAMESPACE];
          const componentName = annotations[CHOREO_ANNOTATIONS.COMPONENT];
          const releaseLine = isReleaseLine(entity)
            ? annotations[CHOREO_ANNOTATIONS.RELEASE_LINE]
            : undefined;
          // Not an OpenChoreo component or release line, so not this
          // retriever's to judge.
          if (!componentName || (isReleaseLine(entity) && !releaseLine)) {
            return undefined;
          }
          if (!namespaceName) {
            return UNRESOLVED_FACTS;
          }
          const subject = releaseLine
            ? `${componentName}:${releaseLine}`
            : componentName;

          const component = await componentOf(
            namespaceName,
            componentName,
            signal,
          );
          if (!component) {
            return UNRESOLVED_FACTS;
          }
          let lineTraits: TraitReference[] | undefined;
          if (releaseLine) {
            const line = await client.GET(
              '/api/v1/namespaces/{namespaceName}/components/{componentName}/releaselines/{releaseLineName}',
              {
                params: {
                  path: {
                    namespaceName,
                    componentName,
                    releaseLineName: releaseLine,
                  },
                },
                signal,
              },
            );
            if (line.response.status === 404) {
              return UNRESOLVED_FACTS;
            }
            if (!line.data) {
              throw new Error(
                `GET release line ${releaseLine} returned HTTP ${line.response.status}`,
              );
            }
            lineTraits = line.data.spec?.traits;
          }

          const facts: TechInsightFact['facts'] = {
            openchoreoAlertingResolved: true,
          };
          try {
            facts.openchoreoConfiguredAlertRuleCount = await countAlertRules(
              namespaceName,
              component,
              lineTraits,
              signal,
            );
          } catch (error) {
            context.logger.warn(
              `Leaving out openchoreoConfiguredAlertRuleCount for ${subject}: ${
                (error as Error).message
              }`,
            );
          }

          const projectName =
            component.owner?.projectName ??
            annotations[CHOREO_ANNOTATIONS.PROJECT];
          let capabilities: Record<string, ActionCapability>;
          try {
            capabilities = await profileOf(namespaceName, signal);
          } catch (error) {
            context.logger.warn(
              `Leaving out openchoreoEnvironmentAlerts for ${subject}: ${
                (error as Error).message
              }`,
            );
            return facts;
          }
          // The binding list comes back as 200 with only the bindings the
          // caller may see, so under a narrower grant a hidden environment
          // would be missing from the entries and everyFact would pass
          // without it.
          if (
            !projectName ||
            !grantsUnconditionally(
              capabilities,
              'environment:view',
              namespacePath(namespaceName),
            ) ||
            !grantsUnconditionally(
              capabilities,
              'releasebinding:view',
              componentPath(namespaceName, projectName, componentName),
            )
          ) {
            return facts;
          }

          let environments: string[];
          try {
            environments = [
              ...new Set(
                activeBindings(
                  lineBindings(
                    await bindingsOf(namespaceName, componentName, signal),
                    releaseLine,
                  ),
                ).map(binding => binding.spec!.environment),
              ),
            ];
          } catch (error) {
            context.logger.warn(
              `Leaving out openchoreoEnvironmentAlerts for ${subject}: ${
                (error as Error).message
              }`,
            );
            return facts;
          }
          // everyFact fails on an empty list, so a line bound nowhere gets
          // no result rather than failing every environment check.
          if (environments.length === 0) {
            return facts;
          }

          const entries: EnvironmentAlerts[] = [];
          for (const environment of environments) {
            const observability = await observabilityOf(
              namespaceName,
              environment,
              signal,
            );
            const { observerUrl } = observability;
            let alerts: AlertsResult | undefined;
            let incidents: IncidentsResult | undefined;
            if (observerUrl) {
              const searchScope: SearchScope = {
                namespace: namespaceName,
                project: projectName,
                component: componentName,
                environment,
                ...(releaseLine && { releaseLine }),
              };
              alerts = await query<AlertsResult>(
                'alerts',
                observerUrl,
                searchScope,
                signal,
              );
              incidents = await query<IncidentsResult>(
                'incidents',
                observerUrl,
                searchScope,
                signal,
              );
            }
            entries.push(
              environmentAlerts({
                environment,
                isProduction: observability.isProduction,
                hasObservability: observability.hasObservability,
                alerts,
                incidents,
              }),
            );
          }
          return {
            ...facts,
            openchoreoEnvironmentAlerts: entries,
            ...(alertCountsResolved(entries) && {
              openchoreoAlertCountsResolved: true,
            }),
          };
        },
      ),
  };
}
