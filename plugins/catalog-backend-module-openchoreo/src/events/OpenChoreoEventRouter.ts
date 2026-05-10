import {
  SubTopicEventRouter,
  type EventParams,
  type EventsService,
} from '@backstage/plugin-events-node';

/**
 * Routes incoming OpenChoreo events to sub-topics based on the resource kind.
 *
 * Subscribes to the generic `openchoreo` topic (fed by HTTP POST ingress)
 * and republishes to `openchoreo.<kind>` sub-topics so that the entity
 * provider can subscribe to exactly the resource types it cares about.
 *
 * Payload shape: { kind: string, name: string, namespace: string, action: string }
 */
export class OpenChoreoEventRouter extends SubTopicEventRouter {
  constructor(options: { events: EventsService }) {
    super({ events: options.events, topic: 'openchoreo' });
  }

  protected getSubscriberId(): string {
    return 'OpenChoreoEventRouter';
  }

  protected determineSubTopic(params: EventParams): string | undefined {
    const payload = params.eventPayload as Record<string, unknown>;
    const kind =
      typeof payload.kind === 'string' ? payload.kind.toLowerCase() : undefined;
    if (!kind) {
      return undefined;
    }
    // SubTopicEventRouter already prepends the parent topic ("openchoreo"),
    // so returning just the kind yields the final topic "openchoreo.<kind>".
    return kind;
  }
}
