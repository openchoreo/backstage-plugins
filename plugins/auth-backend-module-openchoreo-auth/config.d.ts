export interface Config {
  auth?: {
    providers?: {
      'openchoreo-auth'?: {
        [environment: string]: {
          /**
           * OAuth2 scopes to request from the identity provider.
           * Space-separated list, e.g. 'openid profile email groups offline_access'.
           */
          scope?: string;
          /**
           * OAuth2/OIDC audience to request from the identity provider.
           * For Auth0 this must match the API identifier to receive JWT access tokens.
           */
          audience?: string;
        };
      };
    };
  };
}
