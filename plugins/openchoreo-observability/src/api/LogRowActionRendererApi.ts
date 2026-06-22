import { createApiRef } from '@backstage/core-plugin-api';
import type { RenderLogRowAction } from '../components/RuntimeLogs/LogEntry';

/**
 * Registry API for the host-injected per-row action renderer used by
 * the observability runtime-logs tables (`ObservabilityRuntimeLogs`,
 * `ObservabilityProjectRuntimeLogs`).
 *
 * Under NFS, the host registers a `LogRowActionBlueprint` extension whose
 * factory yields a `RenderLogRowAction`. This API's factory collects
 * those extensions (via `inputs.renderers` on the alpha plugin) and
 * exposes the first one as `render`. The logs components consume this
 * API via `useApi(logRowActionRendererApiRef)`.
 *
 * When no extension is registered, `render` is a no-op that returns
 * `null`, so the action column simply doesn't render.
 */
export interface LogRowActionRendererApi {
  render: RenderLogRowAction;
}

export const logRowActionRendererApiRef = createApiRef<LogRowActionRendererApi>(
  {
    id: 'plugin.openchoreo-observability.log-row-action-renderer',
  },
);

export class DefaultLogRowActionRendererApi implements LogRowActionRendererApi {
  readonly render: RenderLogRowAction;

  private constructor(render: RenderLogRowAction) {
    this.render = render;
  }

  static create(options: { renderers: RenderLogRowAction[] }) {
    const render: RenderLogRowAction = options.renderers[0] ?? (() => null);
    return new DefaultLogRowActionRendererApi(render);
  }
}
