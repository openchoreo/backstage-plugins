import { LoggerService } from '@backstage/backend-plugin-api';
import {
  ConflictError,
  InputError,
  NotFoundError,
  NotImplementedError,
} from '@backstage/errors';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
  fetchAllPages,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import {
  effectiveBackends,
  capabilityProblems,
  heededOverrides,
  backendMatchProblems,
  keptOverrides,
  prunedOverrides,
  sameTarget,
  matchProblem,
  overridesFor,
  ownMatches,
  splitProblem,
  uniqueBackendName,
  type DeployEndpointReleaseRequest,
  type EndpointBackendMatch,
  type EndpointCapability,
  type EndpointTrafficBackend,
  type EndpointTrafficInfo,
  type EndpointTrafficOverride,
  type EndpointTrafficResult,
  type RemoveEndpointBackendRequest,
  type SaveEndpointBackendRequest,
  type SetEndpointSplitRequest,
  type SetEnvironmentSplitRequest,
} from '@openchoreo/backstage-plugin-common';

type Endpoint = OpenChoreoComponents['schemas']['Endpoint'];
type EndpointReleaseBinding =
  OpenChoreoComponents['schemas']['EndpointReleaseBinding'];
type EndpointBackendRef = OpenChoreoComponents['schemas']['EndpointBackendRef'];
type ApiMatch = OpenChoreoComponents['schemas']['EndpointMatch'];
type ApiClient = ReturnType<typeof createOpenChoreoApiClient>;

const MAX_BACKENDS = 16;
const RELEASE_WAIT_MS = 10_000;
const POLL_MS = 500;
/** When to tidy overrides after a change, as autoDeploy pins its release. */
const TIDY_AFTER_MS = [5_000, 15_000];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function toMatch(m: ApiMatch | undefined): EndpointBackendMatch | undefined {
  if (!m) return undefined;
  return {
    ...(m.path && { path: m.path }),
    ...(m.headers?.length && { headers: m.headers }),
    ...(m.cookies?.length && { cookies: m.cookies }),
  };
}

function toApiMatch(m: EndpointBackendMatch): ApiMatch {
  return {
    ...(m.path && {
      path: { type: m.path.type ?? 'PathPrefix', value: m.path.value },
    }),
    ...(m.headers?.length && {
      headers: m.headers.map(h => ({
        name: h.name,
        type: h.type ?? 'Exact',
        value: h.value,
      })),
    }),
    ...(m.cookies?.length && { cookies: m.cookies }),
  };
}

/** An Endpoint's or release's backendRefs in the wire shape. A missing weight means 1, as in the CRD. */
export function toTrafficBackends(
  refs: EndpointBackendRef[] | undefined,
): EndpointTrafficBackend[] {
  return (refs ?? []).map(ref => {
    const match = toMatch(ref.match);
    return {
      name: ref.name,
      componentName: ref.component?.name ?? ref.name,
      endpoint: ref.component?.endpoint ?? '',
      ...(ref.component?.releaseLine && {
        releaseLine: ref.component.releaseLine,
      }),
      weight: ref.mirror ? 0 : ref.weight ?? 1,
      ...(match && { match }),
      ...(ref.mirror && { mirror: { percent: ref.mirror.percent } }),
    };
  });
}

function toOverrides(
  binding: EndpointReleaseBinding | undefined,
): EndpointTrafficOverride[] {
  return (binding?.spec?.backendOverrides ?? [])
    .filter(o => o.weight !== undefined || o.mirror || o.match)
    .map(o => {
      const match = toMatch(o.match);
      return {
        name: o.name,
        ...(o.weight !== undefined && { weight: o.weight }),
        ...(match && { match }),
        ...(o.mirror && { mirror: { percent: o.mirror.percent } }),
      };
    });
}

type ApiOverride = OpenChoreoComponents['schemas']['EndpointBackendOverride'];

function toApiOverrides(overrides: EndpointTrafficOverride[]): ApiOverride[] {
  return overrides.map(o => ({
    name: o.name,
    ...(o.weight !== undefined && { weight: o.weight }),
    ...(o.match && { match: toApiMatch(o.match) }),
    ...(o.mirror && { mirror: o.mirror }),
  }));
}

const hasSplit = (overrides: EndpointTrafficOverride[]) =>
  overrides.some(o => o.weight !== undefined || o.mirror);

/**
 * An Endpoint's traffic: how each backend gets requests, the default split
 * in its backendRefs and each environment's own split in its binding's
 * backendOverrides. Every call uses the caller's token; openchoreo-api
 * enforces authorization.
 */
export class EndpointTrafficService {
  constructor(
    private readonly logger: LoggerService,
    private readonly baseUrl: string,
    private readonly releaseWaitMs = RELEASE_WAIT_MS,
    private readonly tidyAfterMs = TIDY_AFTER_MS,
  ) {}

  private client(token?: string): ApiClient {
    return createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });
  }

  private async getEndpoint(
    client: ApiClient,
    namespaceName: string,
    endpointName: string,
  ): Promise<Endpoint> {
    const res = await client.GET(
      '/api/v1/namespaces/{namespaceName}/endpoints/{endpointName}',
      { params: { path: { namespaceName, endpointName } } },
    );
    assertApiResponse(res, 'get endpoint');
    return res.data!;
  }

  private async listBindings(
    client: ApiClient,
    namespaceName: string,
    endpointName: string,
  ): Promise<EndpointReleaseBinding[]> {
    return fetchAllPages(cursor =>
      client
        .GET('/api/v1/namespaces/{namespaceName}/endpointreleasebindings', {
          params: {
            path: { namespaceName },
            query: { endpoint: endpointName, limit: 100, cursor },
          },
        })
        .then(res => {
          assertApiResponse(res, 'list endpoint release bindings');
          return res.data!;
        }),
    );
  }

  private async findBinding(
    client: ApiClient,
    namespaceName: string,
    endpointName: string,
    environment: string,
  ): Promise<EndpointReleaseBinding | undefined> {
    return (await this.listBindings(client, namespaceName, endpointName)).find(
      b => b.spec?.environment === environment,
    );
  }

  /** The backends a release froze; undefined when there is no such release. */
  private async releaseBackends(
    client: ApiClient,
    namespaceName: string,
    releaseName: string,
  ): Promise<EndpointTrafficBackend[] | undefined> {
    return (await this.readRelease(client, namespaceName, releaseName))
      ?.backends;
  }

  /**
   * The backends a release froze and what its type snapshot can render;
   * undefined when there is no such release. Any other failure throws.
   */
  private async readRelease(
    client: ApiClient,
    namespaceName: string,
    releaseName: string,
  ): Promise<
    | {
        backends: EndpointTrafficBackend[];
        capabilities?: EndpointCapability[];
      }
    | undefined
  > {
    const res = await client.GET(
      '/api/v1/namespaces/{namespaceName}/endpointreleases/{endpointReleaseName}',
      { params: { path: { namespaceName, endpointReleaseName: releaseName } } },
    );
    if (res.response.status === 404) return undefined;
    assertApiResponse(res, 'read endpoint release');
    if (!res.data) return undefined;
    const capabilities = res.data.spec?.endpointType?.spec?.capabilities;
    return {
      backends: toTrafficBackends(res.data.spec?.backendRefs),
      ...(capabilities?.length && { capabilities }),
    };
  }

  /** The routing features the Endpoint's type renders, or undefined when it declares none. */
  private async typeCapabilities(
    client: ApiClient,
    namespaceName: string,
    endpoint: Endpoint,
  ): Promise<EndpointCapability[] | undefined> {
    const ref = endpoint.spec?.type;
    if (!ref?.name) return undefined;
    try {
      const res =
        ref.kind === 'ClusterEndpointType'
          ? await client.GET('/api/v1/clusterendpointtypes/{cetName}', {
              params: { path: { cetName: ref.name } },
            })
          : await client.GET(
              '/api/v1/namespaces/{namespaceName}/endpointtypes/{etName}',
              { params: { path: { namespaceName, etName: ref.name } } },
            );
      const capabilities = res.response.ok
        ? res.data?.spec?.capabilities
        : undefined;
      return capabilities?.length ? capabilities : undefined;
    } catch (err: unknown) {
      this.logger.debug(
        `Endpoint ${endpoint.metadata.name}: couldn't read its type: ${err}`,
      );
      return undefined;
    }
  }

  private async putBinding(
    client: ApiClient,
    namespaceName: string,
    binding: EndpointReleaseBinding,
    spec: Omit<
      NonNullable<EndpointReleaseBinding['spec']>,
      'backendOverrides'
    > & {
      backendOverrides?: EndpointTrafficOverride[];
    },
  ): Promise<EndpointReleaseBinding | undefined> {
    const body = {
      metadata: binding.metadata,
      spec: {
        ...spec,
        backendOverrides: toApiOverrides(spec.backendOverrides ?? []),
      },
    };
    const res = await client.PUT(
      '/api/v1/namespaces/{namespaceName}/endpointreleasebindings/{endpointReleaseBindingName}',
      {
        params: {
          path: {
            namespaceName,
            endpointReleaseBindingName: binding.metadata.name,
          },
        },
        body,
      },
    );
    if (res.response.status === 409) {
      throw new ConflictError(
        'The split changed since you opened it. Reload and try again.',
      );
    }
    assertApiResponse(res, 'update endpoint release binding');
    return res.data;
  }

  /** Saves the Endpoint and waits briefly for the release it cuts. */
  private async putEndpoint(
    client: ApiClient,
    namespaceName: string,
    endpoint: Endpoint,
    backendRefs: EndpointBackendRef[],
  ): Promise<EndpointTrafficResult> {
    const previous = endpoint.status?.latestRelease?.name;
    const res = await client.PUT(
      '/api/v1/namespaces/{namespaceName}/endpoints/{endpointName}',
      {
        params: {
          path: { namespaceName, endpointName: endpoint.metadata.name },
        },
        // openchoreo-api widens the Endpoint's owner to cover the backends.
        body: {
          metadata: endpoint.metadata,
          spec: { ...endpoint.spec!, backendRefs },
        },
      },
    );
    if (res.response.status === 409) {
      throw new ConflictError(
        'The Endpoint changed since you opened it. Reload and try again.',
      );
    }
    assertApiResponse(res, 'update endpoint');
    const deadline = Date.now() + this.releaseWaitMs;
    for (;;) {
      // The edit is saved; failing to see its release only means the caller
      // refreshes without it, rather than saving the edit again.
      let current: Endpoint;
      try {
        current = await this.getEndpoint(
          client,
          namespaceName,
          endpoint.metadata.name,
        );
      } catch (err: unknown) {
        this.logger.warn(
          `Endpoint ${endpoint.metadata.name}: saved, but couldn't read its new release: ${err}`,
        );
        break;
      }
      const latest = current.status?.latestRelease?.name;
      if (latest && latest !== previous) return { latestRelease: latest };
      if (Date.now() >= deadline) break;
      await sleep(POLL_MS);
    }
    return {};
  }

  /** The Endpoint's backends, the routing its type renders and each environment. */
  async fetchTraffic(
    namespaceName: string,
    endpointName: string,
    token?: string,
  ): Promise<EndpointTrafficInfo> {
    const client = this.client(token);
    const endpoint = await this.getEndpoint(
      client,
      namespaceName,
      endpointName,
    );
    const [bindings, capabilities] = await Promise.all([
      this.listBindings(client, namespaceName, endpointName),
      this.typeCapabilities(client, namespaceName, endpoint),
    ]);
    const environments = await Promise.all(
      bindings
        .filter(b => b.spec)
        .map(async b => {
          const pinned = b.spec!.endpointRelease;
          let read: Awaited<ReturnType<typeof this.readRelease>>;
          let unknown = false;
          try {
            read = pinned
              ? await this.readRelease(client, namespaceName, pinned)
              : undefined;
            unknown = Boolean(pinned) && !read;
          } catch (err: unknown) {
            unknown = true;
            this.logger.warn(
              `Endpoint ${endpointName}: couldn't read release ${pinned}: ${err}`,
            );
          }
          const release = read?.backends ?? [];
          return {
            environment: b.spec!.environment,
            bindingName: b.metadata.name,
            ...(pinned && { endpointRelease: pinned }),
            release,
            ...(unknown && { releaseUnknown: true }),
            overrides: heededOverrides(toOverrides(b), release),
            ...(read?.capabilities && { capabilities: read.capabilities }),
          };
        }),
    );
    return {
      backends: toTrafficBackends(endpoint.spec?.backendRefs),
      ...(capabilities && { capabilities }),
      environments,
    };
  }

  /**
   * Adds a backend, or changes how one gets traffic when `editing` names it.
   * A new backend, or one switched to a share, starts at 0% so nothing moves
   * until a split gives it traffic; a condition keeps its share; a mirror
   * gets only copies. One Endpoint update, one release.
   */
  async saveBackend(
    request: SaveEndpointBackendRequest,
    token?: string,
  ): Promise<EndpointTrafficResult & { backendName: string }> {
    const client = this.client(token);
    const endpoint = await this.getEndpoint(
      client,
      request.namespaceName,
      request.endpointName,
    );
    const refs = endpoint.spec?.backendRefs ?? [];
    const backends = toTrafficBackends(refs);
    const { traffic } = request;
    if (
      traffic.kind === 'mirror' &&
      (!Number.isInteger(traffic.percent) ||
        traffic.percent < 0 ||
        traffic.percent > 100)
    ) {
      throw new InputError('Give the copy as a whole percentage from 0 to 100');
    }

    const existing = request.editing
      ? refs.find(r => r.name === request.editing)
      : undefined;
    if (request.editing && !existing) {
      throw new NotFoundError(
        `${request.endpointName} has no backend ${request.editing}`,
      );
    }
    const target = {
      componentName: request.componentName,
      endpoint: request.endpoint,
      releaseLine: request.releaseLine,
    };
    const routesThere = refs.find(
      r =>
        r.name !== request.editing &&
        r.component?.name === target.componentName &&
        r.component?.endpoint === target.endpoint &&
        (r.component?.releaseLine ?? '') === (target.releaseLine ?? ''),
    );
    if (routesThere) {
      throw new InputError(
        `${request.endpointName} already routes to ${target.componentName}/${target.endpoint} as ${routesThere.name}`,
      );
    }
    if (!existing && refs.length >= MAX_BACKENDS) {
      throw new InputError(
        `${request.endpointName} already has the maximum of ${MAX_BACKENDS} backends`,
      );
    }
    const name =
      existing?.name ?? request.name ?? uniqueBackendName(backends, target);
    if (traffic.kind === 'match') {
      const problem = matchProblem(backends, name, traffic.match);
      if (problem) throw new InputError(problem);
    }

    const wasShared = existing && !existing.mirror;
    const weight =
      traffic.kind !== 'mirror' && wasShared ? existing.weight ?? 1 : 0;
    const ref: EndpointBackendRef = {
      name,
      kind: 'Component',
      component: {
        name: target.componentName,
        endpoint: target.endpoint,
        ...(target.releaseLine && { releaseLine: target.releaseLine }),
      },
      weight,
      ...(traffic.kind === 'match' && { match: toApiMatch(traffic.match) }),
      ...(traffic.kind === 'mirror' && {
        mirror: { percent: traffic.percent },
      }),
    };
    let backendRefs = existing
      ? refs.map(r => (r.name === existing.name ? ref : r))
      : [...refs, ref];
    if (request.split) {
      const shares = Object.fromEntries(
        Object.entries(request.split).filter(([k]) =>
          backendRefs.some(r => r.name === k && !r.mirror),
        ),
      );
      const problem = splitProblem(toTrafficBackends(backendRefs), shares);
      if (problem) throw new InputError(problem);
      backendRefs = backendRefs.map(r =>
        shares[r.name] === undefined ? r : { ...r, weight: shares[r.name] },
      );
    }
    if (backendRefs.every(r => (r.weight ?? 1) === 0)) {
      throw new InputError(
        'At least one backend needs a share; give one a share before changing this one',
      );
    }
    // A backend added under the name of one removed earlier must not
    // inherit the overrides that one left.
    await this.tidyOverrides(
      request.namespaceName,
      request.endpointName,
      token,
    );
    const result = await this.putEndpoint(
      client,
      request.namespaceName,
      endpoint,
      backendRefs,
    );
    this.tidyOverridesLater(request.namespaceName, request.endpointName, token);
    return { ...result, backendName: name };
  }

  /**
   * Removes a backend. Refused for the last one, and for one whose removal
   * would leave no backend with a share. Environments keep serving it until
   * they get the release that drops it; their overrides for it go once they
   * do.
   */
  async removeBackend(
    request: RemoveEndpointBackendRequest,
    token?: string,
  ): Promise<EndpointTrafficResult> {
    const client = this.client(token);
    const endpoint = await this.getEndpoint(
      client,
      request.namespaceName,
      request.endpointName,
    );
    const refs = endpoint.spec?.backendRefs ?? [];
    if (!refs.some(r => r.name === request.backendName)) {
      throw new NotFoundError(
        `${request.endpointName} has no backend ${request.backendName}`,
      );
    }
    if (refs.length === 1) {
      throw new InputError(
        `${request.endpointName} needs at least one backend; delete the Endpoint instead`,
      );
    }
    const backendRefs = refs.filter(r => r.name !== request.backendName);
    const shared = backendRefs.filter(r => !r.mirror);
    if (shared.length === 0 || shared.every(r => (r.weight ?? 1) === 0)) {
      throw new InputError(
        `Removing ${request.backendName} leaves no backend with a share. Give another backend a share with Edit split first.`,
      );
    }
    await this.tidyOverrides(
      request.namespaceName,
      request.endpointName,
      token,
    );
    const result = await this.putEndpoint(
      client,
      request.namespaceName,
      endpoint,
      backendRefs,
    );
    this.tidyOverridesLater(request.namespaceName, request.endpointName, token);
    return result;
  }

  /**
   * Drops the overrides that change nothing, without moving traffic: ones
   * naming a backend the environment's release doesn't have, which the
   * controller ignores but a backend added later under that name would
   * inherit, and an own split that now equals the release's, such as after
   * the release that drops a replaced backend. Best effort: a binding that
   * can't be saved is logged.
   */
  async tidyOverrides(
    namespaceName: string,
    endpointName: string,
    token?: string,
  ): Promise<void> {
    const client = this.client(token);
    let bindings: EndpointReleaseBinding[];
    try {
      bindings = await this.listBindings(client, namespaceName, endpointName);
    } catch (err: unknown) {
      this.logger.warn(
        `Endpoint ${endpointName}: couldn't list bindings to tidy: ${err}`,
      );
      return;
    }
    for (const binding of bindings) {
      const current = toOverrides(binding);
      const pinned = binding.spec?.endpointRelease;
      if (current.length === 0 || !pinned || !binding.spec) continue;
      try {
        const release = await this.releaseBackends(
          client,
          namespaceName,
          pinned,
        );
        if (!release) continue;
        const kept = prunedOverrides(release, current);
        if (!kept) continue;
        const ignored =
          heededOverrides(current, release).length < current.length;
        const changed =
          ignored ||
          kept.length === 0 ||
          (hasSplit(current) && !hasSplit(kept)) ||
          Object.keys(ownMatches(release, kept)).length !==
            Object.keys(ownMatches(release, current)).length;
        if (changed) {
          await this.putBinding(client, namespaceName, binding, {
            ...binding.spec,
            backendOverrides: kept,
          });
        }
      } catch (err: unknown) {
        this.logger.warn(
          `Endpoint ${endpointName}: couldn't tidy the overrides of ${binding.metadata.name}: ${err}`,
        );
      }
    }
  }

  /** Tidies overrides once autoDeploy has had time to pin the release a change cuts. */
  private tidyOverridesLater(
    namespaceName: string,
    endpointName: string,
    token?: string,
  ): void {
    for (const ms of this.tidyAfterMs) {
      const timer = setTimeout(() => {
        this.tidyOverrides(namespaceName, endpointName, token).catch(err =>
          this.logger.warn(
            `Endpoint ${endpointName}: couldn't tidy overrides: ${err}`,
          ),
        );
      }, ms);
      timer.unref?.();
    }
  }

  /** Saves the Endpoint's default split in one update, which cuts a release. */
  async setDefaultSplit(
    request: SetEndpointSplitRequest,
    token?: string,
  ): Promise<EndpointTrafficResult> {
    const client = this.client(token);
    const endpoint = await this.getEndpoint(
      client,
      request.namespaceName,
      request.endpointName,
    );
    const refs = endpoint.spec?.backendRefs ?? [];
    const problem = splitProblem(toTrafficBackends(refs), request.split);
    if (problem) throw new InputError(problem);
    const backendRefs = refs.map(r => {
      const v = request.split[r.name];
      if (v === undefined) return r;
      return r.mirror ? { ...r, mirror: { percent: v } } : { ...r, weight: v };
    });
    const result = await this.putEndpoint(
      client,
      request.namespaceName,
      endpoint,
      backendRefs,
    );
    this.tidyOverridesLater(request.namespaceName, request.endpointName, token);
    return result;
  }

  /**
   * Saves an environment's own traffic on its binding, which applies there
   * right away, or drops it with `split: null`: its shares and copies, and
   * its own condition for backends that have one in the release. A split
   * that keeps the release's ratio, and a condition equal to the release's,
   * store nothing; a condition not given keeps what the environment has.
   */
  async setEnvironmentSplit(
    request: SetEnvironmentSplitRequest,
    token?: string,
  ): Promise<{ bindingName: string }> {
    const client = this.client(token);
    const binding = await this.findBinding(
      client,
      request.namespaceName,
      request.endpointName,
      request.environment,
    );
    const pinned = binding?.spec?.endpointRelease;
    if (!binding?.spec || !pinned) {
      throw new NotFoundError(
        `${request.endpointName} is not deployed in ${request.environment}; deploy a release there first`,
      );
    }
    let backendOverrides: EndpointTrafficOverride[] = [];
    if (request.split) {
      const read = await this.readRelease(
        client,
        request.namespaceName,
        pinned,
      );
      if (!read) {
        throw new NotFoundError(`Release ${pinned} can't be read`);
      }
      const release = read.backends;
      const current = effectiveBackends(
        release,
        heededOverrides(toOverrides(binding), release),
      );
      for (const [name, match] of Object.entries(request.matches ?? {})) {
        const shape = backendMatchProblems(match);
        if (shape.length > 0) {
          throw new InputError(`${name}: ${shape.join('; ')}`);
        }
      }
      // Copies not given keep what the environment copies now.
      const split = { ...request.split };
      for (const b of current) {
        if (
          b.mirror &&
          !Object.prototype.hasOwnProperty.call(request.split, b.name)
        ) {
          split[b.name] = b.mirror.percent;
        }
      }
      const problem = splitProblem(release, split);
      if (problem) throw new InputError(problem);
      const matches = {
        ...ownMatches(release, heededOverrides(toOverrides(binding), release)),
        ...request.matches,
      };
      for (const [name, match] of Object.entries(request.matches ?? {})) {
        const b = release.find(x => x.name === name);
        if (!b?.match) {
          throw new InputError(
            `${name} has no condition in ${pinned}; an environment can change a condition, not add one`,
          );
        }
        const matchError = matchProblem(
          effectiveBackends(release, overridesFor(release, {}, matches)),
          name,
          match,
        );
        if (matchError) throw new InputError(`${name}: ${matchError}`);
      }
      backendOverrides = overridesFor(release, split, matches);
      const unsupported = capabilityProblems(
        effectiveBackends(release, backendOverrides),
        read.capabilities,
      );
      if (unsupported.length > 0) {
        throw new InputError(
          `The type of ${pinned} can't render this: ${unsupported.join('; ')}`,
        );
      }
    }
    const saved = await this.putBinding(
      client,
      request.namespaceName,
      binding,
      { ...binding.spec, backendOverrides },
    );
    // A control plane from before environments could set their own
    // conditions drops them without an error; say so instead of claiming
    // they were saved.
    const asked = backendOverrides.filter(o => o.match).map(o => o.name);
    const kept = new Set(
      (saved?.spec?.backendOverrides ?? [])
        .filter(o => o.match)
        .map(o => o.name),
    );
    if (saved?.spec && asked.some(name => !kept.has(name))) {
      throw new NotImplementedError(
        `${request.environment}'s shares and copies are saved, but this OpenChoreo control plane doesn't keep an environment's own conditions yet. Upgrade it to change conditions per environment.`,
      );
    }
    return { bindingName: binding.metadata.name };
  }

  /**
   * Pins a release in an environment, creating its binding when there is
   * none. The environment keeps its own split where the release still has
   * those backends; an own split that now equals the release's, or would
   * route nothing, is dropped.
   */
  async deployRelease(
    request: DeployEndpointReleaseRequest,
    token?: string,
  ): Promise<{ bindingName: string }> {
    const client = this.client(token);
    const release = await this.releaseBackends(
      client,
      request.namespaceName,
      request.releaseName,
    );
    if (!release) {
      throw new NotFoundError(`Release ${request.releaseName} can't be read`);
    }
    const binding = await this.findBinding(
      client,
      request.namespaceName,
      request.endpointName,
      request.environment,
    );
    if (!binding?.spec) {
      const name = `${request.endpointName}-${request.environment}`;
      const res = await client.POST(
        '/api/v1/namespaces/{namespaceName}/endpointreleasebindings',
        {
          params: { path: { namespaceName: request.namespaceName } },
          body: {
            metadata: { name },
            spec: {
              owner: {
                projectName: request.projectName,
                endpointName: request.endpointName,
              },
              environment: request.environment,
              endpointRelease: request.releaseName,
            },
          },
        },
      );
      assertApiResponse(res, 'create endpoint release binding');
      return { bindingName: name };
    }
    // An override follows a backend by name; one whose name now routes
    // somewhere else would carry its share to the new target, so it goes.
    let current = toOverrides(binding);
    let shareLeft = false;
    const pinned = binding.spec.endpointRelease;
    if (pinned && pinned !== request.releaseName && current.length > 0) {
      const before = await this.releaseBackends(
        client,
        request.namespaceName,
        pinned,
      ).catch(() => undefined);
      const retargeted = current.filter(o => {
        const was = before?.find(b => b.name === o.name);
        const now = release.find(b => b.name === o.name);
        return was && now && !sameTarget(was, now);
      });
      current = current.filter(o => !retargeted.includes(o));
      // A retargeted backend that had a share left the split as a removed
      // one does, so the environment takes the release's split.
      shareLeft = retargeted.some(o => (o.weight ?? 0) > 0);
    }
    const backendOverrides = keptOverrides(release, current, shareLeft);
    await this.putBinding(client, request.namespaceName, binding, {
      ...binding.spec,
      endpointRelease: request.releaseName,
      backendOverrides,
    });
    return { bindingName: binding.metadata.name };
  }
}
