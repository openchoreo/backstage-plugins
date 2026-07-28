import { resolveBrandTokens } from './brand';
import { darkTokens, lightTokens } from './tokens';

describe('resolveBrandTokens', () => {
  it('returns the base object by reference when no overrides are given', () => {
    // This identity IS the pixel-identical default: callers reuse the
    // prebuilt theme singletons when `===` holds.
    expect(resolveBrandTokens(lightTokens)).toBe(lightTokens);
    expect(resolveBrandTokens(lightTokens, {})).toBe(lightTokens);
    expect(resolveBrandTokens(darkTokens, { primary: undefined })).toBe(
      darkTokens,
    );
  });

  it('derives the primary scale from main when light/dark are omitted', () => {
    const resolved = resolveBrandTokens(lightTokens, {
      primary: { main: '#0d9488' },
    });
    expect(resolved.primary.main).toBe('#0d9488');
    expect(resolved.primary.light).not.toBe(lightTokens.primary.light);
    expect(resolved.primary.dark).not.toBe(lightTokens.primary.dark);
    // MUI lighten/darken emit rgb() strings.
    expect(resolved.primary.light).toMatch(/^rgb/);
    expect(resolved.primary.dark).toMatch(/^rgb/);
  });

  it('respects explicit light/dark overrides', () => {
    const resolved = resolveBrandTokens(lightTokens, {
      primary: { main: '#0d9488', light: '#ccfbf1', dark: '#0f766e' },
    });
    expect(resolved.primary).toEqual({
      main: '#0d9488',
      light: '#ccfbf1',
      dark: '#0f766e',
    });
  });

  it('recomputes the brand-accent slots in light mode', () => {
    const resolved = resolveBrandTokens(lightTokens, {
      primary: { main: '#0d9488', dark: '#0f766e' },
    });
    expect(resolved.text.link).toBe('#0d9488');
    expect(resolved.text.linkHover).toBe('#0f766e');
    expect(resolved.navigation.indicator).toBe('#0d9488');
    expect(resolved.navigation.selectedColor).toBe('#0d9488');
    expect(resolved.status.info).toBe('#0d9488');
    expect(resolved.status.running).toBe('#0d9488');
    expect(resolved.banner.info).toBe('#0d9488');
    expect(resolved.banner.link).toBe('#0d9488');
    expect(resolved.graph.edge).toBe('#0d9488');
    expect(resolved.graph.minimapViewportTint).toContain('0.1');
    expect(resolved.gradient.header).toContain('#0d9488');
    expect(resolved.gradient.cardHeader).toContain('#0d9488');
    expect(resolved.gradient.burst).toContain('#0d9488');
    expect(resolved.bursts.gradient).toContain('#0d9488');
  });

  it('maps light-role slots to the light scale in dark mode', () => {
    const resolved = resolveBrandTokens(darkTokens, {
      primary: { main: '#2dd4bf', light: '#99f6e4' },
    });
    expect(resolved.text.link).toBe('#2dd4bf');
    expect(resolved.text.linkHover).toBe('#99f6e4');
    expect(resolved.navigation.selectedColor).toBe('#99f6e4');
    expect(resolved.banner.link).toBe('#99f6e4');
  });

  it('keeps the navy gradients in dark mode', () => {
    const resolved = resolveBrandTokens(darkTokens, {
      primary: { main: '#2dd4bf' },
    });
    expect(resolved.gradient).toBe(darkTokens.gradient);
    expect(resolved.bursts).toBe(darkTokens.bursts);
  });

  it('does not touch non-brand slots or mutate the base', () => {
    const before = JSON.stringify(lightTokens);
    const resolved = resolveBrandTokens(lightTokens, {
      primary: { main: '#0d9488' },
    });
    expect(resolved.secondary).toBe(lightTokens.secondary);
    expect(resolved.indigo).toBe(lightTokens.indigo);
    expect(resolved.entityKind).toBe(lightTokens.entityKind);
    expect(resolved.statusBackground).toBe(lightTokens.statusBackground);
    expect(JSON.stringify(lightTokens)).toBe(before);
  });
});
