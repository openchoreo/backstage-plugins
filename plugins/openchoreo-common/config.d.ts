/*
 * OpenChoreo Plugin Configuration Schema
 *
 * This file defines the configuration structure for OpenChoreo plugins.
 * The visibility annotations control which config values are exposed to frontend.
 */
export interface Config {
  openchoreo?: {
    /**
     * Base URL for the OpenChoreo API
     * @visibility backend
     */
    baseUrl?: string;

    /**
     * Optional authentication token for OpenChoreo API
     * @visibility secret
     */
    token?: string;

    /**
     * Default owner for catalog entities
     * @visibility backend
     */
    defaultOwner?: string;

    /**
     * Namespace name for generic workflows.
     * After Organization CRD removal, the hierarchy is: Namespace → Project → Component
     * @visibility frontend
     */
    namespace?: string;

    /**
     * Feature flags for enabling/disabling OpenChoreo functionality.
     * These flags allow operators to toggle major features without code changes.
     * @deepVisibility frontend
     */
    features?: {
      /**
       * Build plane / Workflows configuration.
       * Controls the Workflows tab, WorkflowsOverviewCard, and build-related features.
       * @deepVisibility frontend
       */
      workflows?: {
        /**
         * Enable or disable the Workflows feature.
         * When disabled, Workflows tab and cards are hidden from the UI.
         * @visibility frontend
         */
        enabled?: boolean;
      };

      /**
       * Observability plane configuration.
       * Controls Metrics, Traces, Runtime Logs, and health monitoring features.
       * @deepVisibility frontend
       */
      observability?: {
        /**
         * Enable or disable the Observability features.
         * When disabled, Metrics, Traces, Runtime Logs tabs and RuntimeHealthCard are hidden.
         * @visibility frontend
         */
        enabled?: boolean;
      };

      /**
       * Authentication configuration.
       * Controls whether OAuth authentication is required or guest mode is used.
       * @deepVisibility frontend
       */
      auth?: {
        /**
         * Enable or disable authentication.
         * When false, users are automatically logged in as guests.
         * @visibility frontend
         */
        enabled?: boolean;
      };

      /**
       * Authorization configuration.
       * Controls the Access Control UI for role-based access management.
       * @deepVisibility frontend
       */
      authz?: {
        /**
         * Enable or disable authorization features.
         * When disabled, Access Control sidebar item and pages are hidden.
         * @visibility frontend
         */
        enabled?: boolean;
      };
    };

    /**
     * Schedule configuration for entity providers
     * @visibility backend
     */
    schedule?: {
      /**
       * Frequency in seconds between provider runs
       * @visibility backend
       */
      frequency?: number;

      /**
       * Timeout in seconds for provider operations
       * @visibility backend
       */
      timeout?: number;
    };
  };
}
