import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import type { AppNode } from '@backstage/frontend-plugin-api';

type Card = EntityContentLayoutProps['cards'][number];

/**
 * Only the base `openchoreo` plugin's cards are placed bespoke by OC
 * layouts (`DeploymentStatusCard`, `OpenChoreoAboutCard`, and friends).
 * Cards from sibling OC plugins (`openchoreo-ci`, `openchoreo-observability`,
 * `openchoreo-workflows`, `openchoreo-portal-assistant`) flow through
 * `ForeignCardsSection` the same way adopter and upstream cards do — the
 * base plugin doesn't depend on them, so it can't hardcode-import them
 * into its layouts. Each sibling plugin controls its own card placement
 * via `type: 'info' | 'content'` on its blueprint.
 */
const BESPOKE_PLUGIN_ID = 'openchoreo';

/**
 * Cards that reach a layout via `EntityContentLayoutProps.cards` are
 * pre-wrapped by Backstage's blueprint factory in `ExtensionBoundary`,
 * whose `node` prop carries the extension's `AppNode` — the same runtime
 * object that backs the `entity-card:<pluginId>/<name>` id used by
 * `app.extensions` config.
 *
 * Reading `element.props.node` walks documented public API
 * (`ExtensionBoundary` + `AppNode` are both exported from
 * `@backstage/frontend-plugin-api`). Not framework-internal.
 */
function nodeOf(card: Card): AppNode | undefined {
  return (card.element.props as { node?: AppNode })?.node;
}

/**
 * The extension's canonical id (e.g. `entity-card:openchoreo/deployment-status`).
 * Also a stable React `key` for the card when rendering into a Grid.
 */
export function extensionIdOf(card: Card): string | undefined {
  return nodeOf(card)?.spec.id;
}

/**
 * The ID of the plugin whose blueprint contributed this card (e.g.
 * `openchoreo`, `openchoreo-ci`, `catalog`, `kubernetes`). Backstage's
 * `AppNodeSpec.plugin` is a `FrontendPlugin` whose `pluginId` matches
 * the string passed to `createFrontendPlugin({ pluginId })`.
 */
export function pluginIdOf(card: Card): string | undefined {
  return nodeOf(card)?.spec.plugin?.pluginId;
}

/**
 * Partition the layout's `cards` prop into the non-OC subset, split
 * further by `info` (right-column) vs `content` (main-column) type.
 *
 * The `type` field on `EntityCardBlueprint` is optional and defaults to
 * `content` when unset, matching what `DefaultEntityContentLayout` does.
 */
export function selectForeignCards(cards: readonly Card[]): {
  info: Card[];
  content: Card[];
} {
  const foreign = cards.filter(c => pluginIdOf(c) !== BESPOKE_PLUGIN_ID);
  return {
    info: foreign.filter(c => c.type === 'info'),
    content: foreign.filter(c => !c.type || c.type === 'content'),
  };
}

/**
 * Renders foreign (non-OC) cards at the tail of an OC layout's grid.
 *
 * Every OC `EntityContentLayoutBlueprint` embeds this after its bespoke
 * arrangement so that third-party plugins the adopter installs — or
 * Backstage's own broad-filter defaults (e.g. `catalog/about`,
 * `catalog/links`) — still compose into the Overview visually.
 *
 * The portal suppresses specific upstream cards via `app.extensions`
 * config (see `app-config.yaml`); adopters can extend the suppression
 * list themselves. Cards this component renders are whatever survived
 * both Backstage's own filter chain and the adopter's config.
 *
 * Grid semantics: `content` cards stack full-width; `info` cards stack
 * into a fixed narrow (md=4) right rail. Matches the shape upstream's
 * `DefaultEntityContentLayout` uses.
 */
export function ForeignCardsSection({ cards }: { cards: readonly Card[] }) {
  const { info, content } = selectForeignCards(cards);
  if (info.length === 0 && content.length === 0) return null;

  // Every blueprint-produced card carries a stable extension id through
  // `ExtensionBoundary` (see `extensionIdOf`). Cards without one are
  // filtered out — using index as a fallback here would reassign state
  // to the wrong card on reorder.
  const withStableId = <T,>(items: T[], id: (item: T) => string | undefined) =>
    items
      .map(item => ({ item, id: id(item) }))
      .filter((x): x is { item: T; id: string } => x.id !== undefined);

  const stableContent = withStableId(content, extensionIdOf);
  const stableInfo = withStableId(info, extensionIdOf);

  return (
    <>
      {stableContent.map(({ item, id }) => (
        <Grid item xs={12} key={id}>
          {item.element}
        </Grid>
      ))}
      {stableInfo.length > 0 && (
        <Grid item xs={12} md={4} style={{ marginLeft: 'auto' }}>
          <Grid container spacing={3}>
            {stableInfo.map(({ item, id }) => (
              <Grid item xs={12} key={id}>
                {item.element}
              </Grid>
            ))}
          </Grid>
        </Grid>
      )}
    </>
  );
}
