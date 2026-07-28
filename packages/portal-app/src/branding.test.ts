import { mockApis } from '@backstage/test-utils';
import {
  DEFAULT_BRAND_NAME,
  brandName,
  readBrandingConfig,
  toBrandOverrides,
} from './branding';

describe('readBrandingConfig', () => {
  it('parses a full branding block', () => {
    const config = mockApis.config({
      data: {
        app: {
          branding: {
            name: 'Acme Portal',
            iconLogo: 'data:image/svg+xml;base64,abc',
            fullLogo: 'https://example.com/logo.svg',
            theme: {
              light: { primaryColor: '#0d9488' },
              dark: { primaryColor: '#2dd4bf' },
            },
          },
        },
      },
    });
    expect(readBrandingConfig(config)).toEqual({
      name: 'Acme Portal',
      iconLogo: 'data:image/svg+xml;base64,abc',
      fullLogo: 'https://example.com/logo.svg',
      theme: {
        light: { primaryColor: '#0d9488' },
        dark: { primaryColor: '#2dd4bf' },
      },
    });
  });

  it('returns an empty shape when app.branding is absent', () => {
    const branding = readBrandingConfig(mockApis.config({ data: {} }));
    expect(branding.name).toBeUndefined();
    expect(branding.iconLogo).toBeUndefined();
    expect(branding.fullLogo).toBeUndefined();
    expect(branding.theme).toBeUndefined();
  });
});

describe('brandName', () => {
  it('falls back to OpenChoreo', () => {
    expect(brandName({})).toBe(DEFAULT_BRAND_NAME);
    expect(brandName({ name: 'Acme' })).toBe('Acme');
  });
});

describe('toBrandOverrides', () => {
  it('returns undefined when no primary color is set for the mode', () => {
    expect(toBrandOverrides({}, 'light')).toBeUndefined();
    expect(
      toBrandOverrides(
        { theme: { dark: { primaryColor: '#2dd4bf' } } },
        'light',
      ),
    ).toBeUndefined();
  });

  it('maps the per-mode primary color', () => {
    const branding = {
      theme: {
        light: { primaryColor: '#0d9488' },
        dark: { primaryColor: '#2dd4bf' },
      },
    };
    expect(toBrandOverrides(branding, 'light')).toEqual({
      primary: { main: '#0d9488' },
    });
    expect(toBrandOverrides(branding, 'dark')).toEqual({
      primary: { main: '#2dd4bf' },
    });
  });
});
