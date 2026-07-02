import { Entity } from '@backstage/catalog-model';
import { LoggerService, UrlReaderService } from '@backstage/backend-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { parseAllDocuments } from 'yaml';

/** The (Cluster)ComponentType a fetched Template is emitted for. */
export interface RemoteTemplateContext {
  ctdName: string;
  /** Namespace to emit into: the CT's namespace, or `openchoreo-cluster`. */
  namespace: string;
  workloadType?: string;
  displayName?: string;
  /** Set for cluster-scoped types; omit for namespaced ones. */
  ctdKind?: 'ComponentType' | 'ClusterComponentType';
}

/**
 * Fetches a hand-authored scaffolder Template via {@link UrlReaderService} (so
 * `integrations` config governs reachability) and returns it as a catalog
 * Entity. Any failure throws; callers emit no template rather than falling back.
 */
export class RemoteTemplateFetcher {
  constructor(
    private readonly urlReader: UrlReaderService,
    private readonly logger: LoggerService,
  ) {}

  /** Read, parse, validate and stamp the remote Template. Throws on any failure. */
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

    // parseAllDocuments collects recoverable errors instead of throwing; surface
    // them so a half-parsed doc isn't mistaken for a missing Template.
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
      // Hand-authored, not a generated wizard.
      [CHOREO_ANNOTATIONS.CTD_GENERATED]: 'false',
      [CHOREO_ANNOTATIONS.SCAFFOLD_TEMPLATE_URL]: templateUrl,
      // Anchor relative `fetch:*` (e.g. `./skeleton`) at the source URL.
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
        // Own the identity (like generated templates) so discovery, full sync
        // and delete stay consistent; the authored spec/title are untouched.
        name: `template-${ctx.ctdName}`,
        namespace: ctx.namespace,
        annotations,
      },
    };
  }
}
