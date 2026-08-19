import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import {
  applyOAuth2StrategyParameterOverrides,
  buildOAuth2StrategyOptions,
  buildOAuthRequestOptions,
} from './oidcAuthenticator';

describe('openChoreoAuthenticator OAuth options', () => {
  const baseOptions = {
    clientID: 'client-id',
    clientSecret: 'client-secret',
    callbackURL: 'https://portal.example.com/callback',
    authorizationURL: 'https://idp.example.com/authorize',
    tokenURL: 'https://idp.example.com/oauth/token',
    scope: 'openid profile email',
  };

  it('omits audience when unset', () => {
    expect(buildOAuth2StrategyOptions(baseOptions)).toEqual(baseOptions);
    expect(buildOAuthRequestOptions(baseOptions.scope)).toEqual({
      scope: baseOptions.scope,
    });
  });

  it('includes audience when configured', () => {
    const audience = 'https://api.example.com/';

    expect(buildOAuth2StrategyOptions({ ...baseOptions, audience })).toEqual({
      ...baseOptions,
      audience,
    });
    expect(buildOAuthRequestOptions(baseOptions.scope, audience)).toEqual({
      scope: baseOptions.scope,
      audience,
    });
  });

  it('adds scope and audience to authorization and token params', () => {
    const strategy = {
      authorizationParams: jest.fn(() => ({ prompt: 'login' })),
      tokenParams: jest.fn(() => ({ resource: 'existing-resource' })),
    } as unknown as OAuth2Strategy;
    const audience = 'https://api.example.com/';

    applyOAuth2StrategyParameterOverrides(
      strategy,
      baseOptions.scope,
      audience,
    );

    expect(strategy.authorizationParams({})).toEqual({
      prompt: 'login',
      scope: baseOptions.scope,
      audience,
    });
    expect(strategy.tokenParams({})).toEqual({
      resource: 'existing-resource',
      scope: baseOptions.scope,
      audience,
    });
  });
});
