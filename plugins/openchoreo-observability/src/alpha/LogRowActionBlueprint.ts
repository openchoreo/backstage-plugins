import {
  createExtensionBlueprint,
  createExtensionDataRef,
} from '@backstage/frontend-plugin-api';
import type { RenderLogRowAction } from '../components/RuntimeLogs/LogEntry';

const logRowActionRendererExtensionDataRef =
  createExtensionDataRef<RenderLogRowAction>().with({
    id: 'openchoreo-observability.log-row-action-renderer',
  });

/**
 * NFS extension blueprint that hosts use to contribute a per-row action
 * renderer to the observability runtime-logs tables.
 *
 * Mirrors upstream's `FormDecoratorBlueprint` pattern. Each blueprint
 * extension `attachTo`s the `renderers` input of
 * `api:openchoreo-observability/log-row-action-renderer`; the API's
 * factory then collects them into a single renderer that the logs
 * tables consume via `useApi(logRowActionRendererApiRef)`.
 */
export const LogRowActionBlueprint = createExtensionBlueprint({
  kind: 'log-row-action-renderer',
  attachTo: {
    id: 'api:openchoreo-observability/log-row-action-renderer',
    input: 'renderers',
  },
  dataRefs: {
    renderer: logRowActionRendererExtensionDataRef,
  },
  output: [logRowActionRendererExtensionDataRef],
  *factory(params: { renderer: RenderLogRowAction }) {
    yield logRowActionRendererExtensionDataRef(params.renderer);
  },
});
