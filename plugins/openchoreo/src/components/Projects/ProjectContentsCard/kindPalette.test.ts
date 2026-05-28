import { lightTokens, darkTokens } from '@openchoreo/backstage-design-system';
import { getKindLabel, getKindPalette } from './kindPalette';

describe('getKindLabel', () => {
  it('returns friendly labels for known kinds', () => {
    expect(getKindLabel('component')).toBe('Component');
    expect(getKindLabel('resource')).toBe('Resource');
  });

  it('is case-insensitive and falls back to the raw kind', () => {
    expect(getKindLabel('COMPONENT')).toBe('Component');
    expect(getKindLabel('api')).toBe('api');
  });
});

describe('getKindPalette', () => {
  it('reads accent/tint from the central entityKind token palette', () => {
    expect(getKindPalette('component', lightTokens)).toEqual({
      fg: lightTokens.entityKind.component.accent,
      bg: lightTokens.entityKind.component.tint,
    });
    expect(getKindPalette('resource', darkTokens)).toEqual({
      fg: darkTokens.entityKind.resource.accent,
      bg: darkTokens.entityKind.resource.tint,
    });
  });

  it('is case-insensitive', () => {
    expect(getKindPalette('Resource', lightTokens)).toEqual({
      fg: lightTokens.entityKind.resource.accent,
      bg: lightTokens.entityKind.resource.tint,
    });
  });

  it('falls back to entityKindDefault for unknown kinds', () => {
    expect(getKindPalette('mystery-kind', lightTokens)).toEqual({
      fg: lightTokens.entityKindDefault.accent,
      bg: lightTokens.entityKindDefault.tint,
    });
  });

  it('keeps Component and Resource visibly distinct in both themes', () => {
    expect(lightTokens.entityKind.component.accent).not.toBe(
      lightTokens.entityKind.resource.accent,
    );
    expect(darkTokens.entityKind.component.accent).not.toBe(
      darkTokens.entityKind.resource.accent,
    );
  });
});
