export interface Config {
  openchoreo?: {
    /**
     * Base URL for the OpenChoreo API.
     * @visibility backend
     */
    baseUrl?: string;

    features?: {
      /**
       * Authorization feature configuration.
       */
      authz?: {
        /**
         * Enable the OpenChoreo authorization/permission policy.
         * When false, the permission policy module will not be activated.
         * @default true
         * @visibility backend
         */
        enabled?: boolean;
      };
    };
  };
}
