import { Entity } from '@backstage/catalog-model';
import { LoggerService, UrlReaderService } from '@backstage/backend-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { parseAllDocuments } from 'yaml';

/**
 * Context describing the OpenChoreo (Cluster)ComponentType that a remote
 * scaffolder Template is being fetched for. Used to stamp the linkage
 * annotations the portal's component-creation view relies on for discovery.
 */
export interface RemoteTemplateContext {
  /** The (Cluster)ComponentType name this template is associated with. */
  ctdName: string;
  /**
   * Backstage namespace the emitted Template should live in when the authored
   * template does not declare one. Namespaced types pass the CT's namespace;
   * cluster-scoped types pass `openchoreo-cluster`.
   */
  namespace: string;
  /** Workload type of the source ComponentType (parity with generated templates). */
  workloadType?: string;
  /** Display name of the source ComponentType. */
  displayName?: string;
  /** `ClusterComponentType` for cluster-scoped types; omit for namespaced ones. */
  ctdKind?: 'ComponentType' | 'ClusterComponentType';
}

/**
 * Fetches a hand-authored Backstage scaffolder Template from a remote URL and
 * turns it into a catalog Entity that stands in for the auto-generated
 * component-creation wizard.
 *
 * Fetching goes through Backstage's {@link UrlReaderService}, so the set of
 * reachable URLs (public GitHub out of the box, private GitHub / S3 / others)
 * is governed entirely by the `integrations` config. Any failure — unreachable
 * URL, non-YAML body, or a document that isn't a `kind: Template` — throws;
 * callers log the error and emit no template for that type rather than falling
 * back to a possibly-wrong generated wizard.
 */
export class RemoteTemplateFetcher {
  constructor(
    private readonly urlReader: UrlReaderService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Read, parse, validate and stamp the remote Template.
   * @throws if the URL cannot be read or does not yield a valid Template entity.
   */
  async fetch(
    templateUrl: string,
    ctx: RemoteTemplateContext,
  ): Promise<Entity> {
    this.logger.debug(
      `Fetching custom scaffolder template for ${ctx.ctdName} from ${templateUrl}`,
    );

    let raw: string;
    try {
      const response = await this.urlReader.readUrl(templateUrl);
      raw = (await response.buffer()).toString('utf-8');
    } catch (error) {
      throw new Error(
        `Unable to read scaffolder template from ${templateUrl}: ${error}`,
      );
    }

    const template = this.parseTemplate(raw, templateUrl);
    return this.stamp(template, templateUrl, ctx);
  }

  private parseTemplate(raw: string, templateUrl: string): Entity {
    let docs;
    try {
      docs = parseAllDocuments(raw);
    } catch (error) {
      throw new Error(
        `Failed to parse YAML for scaffolder template at ${templateUrl}: ${error}`,
      );
    }

    // `parseAllDocuments` collects recoverable syntax errors on each document
    // instead of throwing, so surface them explicitly — otherwise a half-parsed
    // document silently masquerades as a missing Template.
    for (const doc of docs) {
      if (doc.errors.length > 0) {
        throw new Error(
          `Failed to parse YAML for scaffolder template at ${templateUrl}: ${doc.errors[0]}`,
        );
      }
    }

    const template = docs
      .map(doc => doc.toJSON())
      .find(
        (doc): doc is Entity =>
          Boolean(doc) &&
          typeof doc === 'object' &&
          (doc as Entity).kind === 'Template',
      );

    if (!template) {
      throw new Error(
        `No 'kind: Template' entity found in scaffolder template at ${templateUrl}`,
      );
    }
    if (!template.metadata || typeof template.metadata !== 'object') {
      throw new Error(
        `Scaffolder template at ${templateUrl} has no metadata block`,
      );
    }
    return template;
  }

  private stamp(
    entity: Entity,
    templateUrl: string,
    ctx: RemoteTemplateContext,
  ): Entity {
    const annotations: Record<string, string> = {
      ...(entity.metadata.annotations ?? {}),
      [CHOREO_ANNOTATIONS.CTD_NAME]: ctx.ctdName,
      // Marks this as an associated hand-authored template, not a generated wizard.
      [CHOREO_ANNOTATIONS.CTD_GENERATED]: 'false',
      [CHOREO_ANNOTATIONS.SCAFFOLD_TEMPLATE_URL]: templateUrl,
      // Anchor relative `fetch:*` steps (e.g. `./skeleton`) at the source URL so
      // the scaffolder resolves skeleton files against the template's origin.
      'backstage.io/managed-by-location': `url:${templateUrl}`,
      'backstage.io/managed-by-origin-location': `url:${templateUrl}`,
    };
    if (ctx.workloadType) {
      annotations[CHOREO_ANNOTATIONS.WORKLOAD_TYPE] = ctx.workloadType;
    }
    if (ctx.ctdKind === 'ClusterComponentType') {
      annotations[CHOREO_ANNOTATIONS.CTD_KIND] = ctx.ctdKind;
    }
    if (ctx.displayName) {
      annotations[CHOREO_ANNOTATIONS.CTD_DISPLAY_NAME] = ctx.displayName;
    }

    return {
      ...entity,
      metadata: {
        ...entity.metadata,
        // Normalise the catalog identity to the same deterministic scheme as
        // generated templates (`template-<ctName>` in the ComponentType's
        // namespace). The portal discovery, the periodic full sync, and the
        // event-driven delete path all key off this identity, so owning it here
        // keeps custom and generated templates interchangeable and prevents
        // cross-type name collisions and orphaned/duplicated entities. The
        // authored title, description, parameters and steps are preserved — only
        // name and namespace are ours.
        name: `template-${ctx.ctdName}`,
        namespace: ctx.namespace,
        annotations,
      },
    };
  }
}
