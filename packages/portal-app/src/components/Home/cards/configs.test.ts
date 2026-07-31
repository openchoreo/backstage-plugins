import { getHomeCardConfig, DEFAULT_HOME_CARD_CONFIG } from './configs';

describe('getHomeCardConfig', () => {
  it('returns the named config when it exists', () => {
    const config = getHomeCardConfig('choreo-default');
    expect(config.name).toBe('choreo-default');
    expect(config.cards.length).toBeGreaterThan(0);
  });

  it('falls back to the default config for unknown names', () => {
    const config = getHomeCardConfig('no-such-layout');
    expect(config.name).toBe(DEFAULT_HOME_CARD_CONFIG);
  });

  it('places every card with at least an xs grid size', () => {
    const config = getHomeCardConfig(DEFAULT_HOME_CARD_CONFIG);
    for (const placement of config.cards) {
      expect(placement.size.xs).toBeDefined();
    }
  });
});
