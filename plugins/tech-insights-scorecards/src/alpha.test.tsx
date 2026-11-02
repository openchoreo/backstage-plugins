import featureLoader, { techInsightsScorecardsPlugin } from './alpha';
import { dynamicChecksApiRef } from './api/DynamicChecksApi';

const PLUGIN = 'tech-insights-scorecards';

describe('tech-insights-scorecards alpha plugin', () => {
  it('registers its API and page', () => {
    const ids = (
      techInsightsScorecardsPlugin as unknown as {
        extensions: Array<{ id: string }>;
      }
    ).extensions.map(e => e.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        `api:${PLUGIN}/dynamic-checks`,
        `page:${PLUGIN}`,
      ]),
    );
    expect(dynamicChecksApiRef.id).toBe(`plugin.${PLUGIN}.dynamic-checks`);
  });

  it('installs the plugin alone through discovery', async () => {
    const features = await (
      featureLoader as unknown as {
        loader(deps: unknown): Promise<unknown[]>;
      }
    ).loader({});
    expect(features).toEqual([techInsightsScorecardsPlugin]);
  });
});
