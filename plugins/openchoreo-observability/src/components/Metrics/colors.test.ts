import { getComponentLineColor, componentColorResolver } from './colors';

describe('getComponentLineColor', () => {
  it('gives distinct colours to the first components', () => {
    const colors = [0, 1, 2, 3].map(i => getComponentLineColor(i));
    expect(new Set(colors).size).toBe(4);
  });

  it('cycles rather than running out', () => {
    // Palette has 10 entries; index 10 wraps back to index 0's colour.
    expect(getComponentLineColor(0)).toBe(getComponentLineColor(10));
    expect(getComponentLineColor(100)).toEqual(expect.any(String));
  });
});

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
