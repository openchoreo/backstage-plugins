export interface Config {
  openchoreo?: {
    /** Vulnerability status of running images, read from cosign attestations. */
    imageSecurity?: {
      /**
       * PEM public key the attestations must be signed with. Without it,
       * results are shown but marked as unverified.
       */
      publicKey?: string;
      /** Severities reported as findings. Default: CRITICAL, HIGH. */
      severities?: string[];
      /** How long a result is cached per image digest. Default: 300. */
      cacheTtlSeconds?: number;
      /** Registries the component images are pulled from. */
      registries?: Array<{
        /** Host as written in image references, e.g. `registry.example.com:5000`. */
        host: string;
        /** URL the backend uses instead of `https://<host>`. */
        url?: string;
        username?: string;
        /** @visibility secret */
        password?: string;
        /** Overrides the token realm the registry announces. */
        tokenRealm?: string;
      }>;
    };
  };
}
