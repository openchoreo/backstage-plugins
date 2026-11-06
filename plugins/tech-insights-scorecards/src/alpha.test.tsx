import type { Entity } from '@backstage/catalog-model';
import { createExtensionTester } from '@backstage/frontend-test-utils';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import featureLoader, {
  techInsightsMaturityApiModule,
  techInsightsScorecardsPlugin,
} from './alpha';
import { dynamicChecksApiRef } from './api/DynamicChecksApi';

const PLUGIN = 'tech-insights-scorecards';

function present<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('The entity tab has no filter');
  return value;
}

function entityOfKind(kind: string): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind,
    metadata: { name: 'x' },
  };
}

describe('tech-insights-scorecards alpha plugin', () => {
  it('registers its API, page, entity tab and summary card', () => {
    const ids = (
      techInsightsScorecardsPlugin as unknown as {
        extensions: Array<{ id: string }>;
      }
    ).extensions.map(e => e.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        `api:${PLUGIN}/dynamic-checks`,
        `page:${PLUGIN}`,
        `entity-content:${PLUGIN}`,
        `entity-card:${PLUGIN}/summary`,
      ]),
    );
    expect(dynamicChecksApiRef.id).toBe(`plugin.${PLUGIN}.dynamic-checks`);
  });

  it('leaves the maturity API to its own plugin unless the module is added', async () => {
    const features = await (
      featureLoader as unknown as {
        loader(deps: unknown): Promise<unknown[]>;
      }
    ).loader({});
    expect(features).toEqual([techInsightsScorecardsPlugin]);
    expect(features).not.toContain(techInsightsMaturityApiModule);
  });

  it('shows the entity tab only on kinds checks score or roll up', () => {
    const tab = techInsightsScorecardsPlugin.getExtension(
      `entity-content:${PLUGIN}`,
    );
    const matches = present(
      createExtensionTester(tab).get(
        EntityContentBlueprint.dataRefs.filterFunction,
      ),
    );
    for (const kind of ['Component', 'API', 'System', 'Domain', 'Group']) {
      expect(matches(entityOfKind(kind))).toBe(true);
    }
    for (const kind of ['User', 'Template', 'Location']) {
      expect(matches(entityOfKind(kind))).toBe(false);
    }
  });

  it('lets a portal set the kinds the entity tab shows on', () => {
    const tab = techInsightsScorecardsPlugin.getExtension(
      `entity-content:${PLUGIN}`,
    );
    const matches = present(
      createExtensionTester(tab, {
        config: { filter: { kind: { $in: ['ClusterComponentType'] } } },
      }).get(EntityContentBlueprint.dataRefs.filterFunction),
    );
    expect(matches(entityOfKind('ClusterComponentType'))).toBe(true);
    expect(matches(entityOfKind('Component'))).toBe(false);
  });
});
