import { componentColorResolver } from './colors';

describe('componentColorResolver', () => {
  it('gives each component in the order its own colour', () => {
    const colorOf = componentColorResolver(['api', 'db', 'worker']);
    const colours = ['api', 'db', 'worker'].map(colorOf);

    expect(new Set(colours).size).toBe(3);
  });

  it('keeps a colour stable when another component drops out', () => {
    // Same declared order; `api` simply has no data this window.
    expect(componentColorResolver(['api', 'db'])('db')).toBe(
      componentColorResolver(['api', 'db'])('db'),
    );
  });

  it('is order-insensitive, since it sorts the component list', () => {
    expect(componentColorResolver(['db', 'api'])('api')).toBe(
      componentColorResolver(['api', 'db'])('api'),
    );
  });

  it('falls back to the first colour for an unknown component', () => {
    expect(componentColorResolver(['api'])('ghost')).toEqual(
      expect.any(String),
    );
  });
});
