import { extractGroups, toBackstageEntityName } from './auth';

function unsignedJwt(payload: object): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );

  return `header.${encodedPayload}.signature`;
}

describe('OpenChoreo auth resolver helpers', () => {
  it('extracts the plain groups claim from access tokens', () => {
    const accessToken = unsignedJwt({
      sub: 'auth0|user',
      groups: ['developers', 'platform-engineers'],
    });

    expect(extractGroups(accessToken)).toEqual([
      'developers',
      'platform-engineers',
    ]);
  });

  it('merges token groups with userinfo groups', () => {
    const accessToken = unsignedJwt({
      sub: 'auth0|user',
      groups: ['developers'],
    });

    expect(
      extractGroups(accessToken, { groups: ['developers', 'admins'] }),
    ).toEqual(['developers', 'admins']);
  });

  it('normalizes emails into valid Backstage entity names', () => {
    expect(toBackstageEntityName('Leandro.User+ops@Example.COM')).toBe(
      'leandro.user-ops-example.com',
    );
  });

  it('rejects values without a usable entity name', () => {
    expect(() => toBackstageEntityName('@@@')).toThrow(
      'Backstage entity name is empty after normalization',
    );
  });
});
