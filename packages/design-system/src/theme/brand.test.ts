import { resolveBrandTokens } from './brand';
import { darkTokens, lightTokens } from './tokens';

describe('resolveBrandTokens', () => {
  // Several branded paths legitimately warn (validation, contrast) — spy
  // globally so tests stay quiet and can assert on calls where relevant.
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('returns the base object by reference when no overrides are given', () => {
    // This identity IS the pixel-identical default: callers reuse the
    // prebuilt theme singletons when `===` holds.
    expect(resolveBrandTokens(lightTokens)).toBe(lightTokens);
    expect(resolveBrandTokens(lightTokens, {})).toBe(lightTokens);
    expect(resolveBrandTokens(darkTokens, { primary: undefined })).toBe(
      darkTokens,
    );
  });

  it('ignores unparseable colors instead of throwing (render safety)', () => {
    // resolveBrandTokens runs inside the theme provider's render with no
    // error boundary above it — a config typo must never crash the app.
    // Named color, #-less hex: decomposeColor rejects these.
    expect(resolveBrandTokens(lightTokens, { primary: { main: 'teal' } })).toBe(
      lightTokens,
    );
    expect(
      resolveBrandTokens(lightTokens, { primary: { main: '0d9488' } }),
    ).toBe(lightTokens);
    // CSS4 space-separated syntax: mis-parses to NaN channels.
    expect(
      resolveBrandTokens(darkTokens, {
        primary: { main: 'rgb(13 148 136)' },
      }),
    ).toBe(darkTokens);
    // Valid main but invalid explicit light: whole override ignored.
    expect(
      resolveBrandTokens(lightTokens, {
        primary: { main: '#0d9488', light: 'bogus' },
      }),
    ).toBe(lightTokens);
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it('rejects translucent colors (MUI contrast math ignores alpha)', () => {
    // A translucent accent would composite against arbitrary surfaces at
    // render time while getContrastRatio treats it as opaque — reject it
    // like an unparseable value rather than warn on a fictional ratio.
    expect(
      resolveBrandTokens(lightTokens, {
        primary: { main: 'rgba(13, 148, 136, 0.4)' },
      }),
    ).toBe(lightTokens);
    expect(
      resolveBrandTokens(darkTokens, {
        primary: { main: 'hsla(174, 84%, 32%, 0.5)' },
      }),
    ).toBe(darkTokens);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('opaque');
  });

  it('warns when the accent misses WCAG AA contrast but still applies it', () => {
    // #0d9488 is ~3.7:1 on white — a popular teal that fails AA for text —
    // and its lightened header stop also misses 3:1 under white text. The
    // override is honored (the operator owns the palette); the warnings are
    // the accessibility signal.
    const resolved = resolveBrandTokens(lightTokens, {
      primary: { main: '#0d9488' },
    });
    expect(resolved.primary.main).toBe('#0d9488');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('4.5:1');
    expect(warn.mock.calls[1][0]).toContain('header gradient');
  });

  it('warns when only the header gradient stop misses AA large-text contrast', () => {
    // #767676 passes 4.5:1 as solid text on white, but lighten(main, 0.25) —
    // the light-mode header's fade end under white header text — is ~2.9:1.
    const resolved = resolveBrandTokens(lightTokens, {
      primary: { main: '#767676' },
    });
    expect(resolved.primary.main).toBe('#767676');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('header gradient');
  });

  it('does not warn for AA-compliant accents in either mode', () => {
    resolveBrandTokens(lightTokens, { primary: { main: '#0f766e' } });
    // Opaque rgb()/rgba() forms are accepted, including explicit alpha 1.
    resolveBrandTokens(lightTokens, { primary: { main: 'rgb(15, 118, 110)' } });
    resolveBrandTokens(lightTokens, {
      primary: { main: 'rgba(15, 118, 110, 1)' },
    });
    resolveBrandTokens(darkTokens, { primary: { main: '#2dd4bf' } });
    expect(warn).not.toHaveBeenCalled();
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
