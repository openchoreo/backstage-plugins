export interface Config {
  openchoreo?: {
    /**
     * Base URL for the OpenChoreo API.
     * @visibility backend
     */
    baseUrl?: string;

    permission?: {
      /**
       * Enable the OpenChoreo permission policy.
       * When false, the policy module will not be activated.
       * @default true
       * @visibility backend
       */
      enabled?: boolean;

      /**
       * Default organization for non-entity permissions.
       * Used when permission checks don't have entity context.
       * @visibility backend
       */
      defaultOrg?: string;

      /**
       * Cache configuration for user capabilities.
       */
      cache?: {
        /**
         * Time-to-live for cached capabilities in seconds.
         * @default 300
         * @visibility backend
         */
        ttlSeconds?: number;
      };

      /**
       * Permission name prefix to handle.
       * Only permissions starting with this prefix will be evaluated by this policy.
       * @default 'openchoreo.'
       * @visibility backend
       */
      permissionPrefix?: string;
    };
  };
}
