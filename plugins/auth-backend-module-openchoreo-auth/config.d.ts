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
        };
      };
    };
  };
}
