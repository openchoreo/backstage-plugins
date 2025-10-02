/**
 * Configuration interface for the OpenChoreo incremental ingestion plugin.
 * Defines settings for API connection and incremental processing parameters.
 */
export interface Config {
  openchoreo?: {
    /**
     * The base URL of the OpenChoreo API
     * @visibility frontend
     */
    baseUrl: string;

    /**
     * Optional authentication token for the OpenChoreo API
     * @visibility secret
     */
    token?: string;

    /**
     * Incremental ingestion options
     */
    incremental?: {
      /**
       * Burst length in seconds
       * @default 10
       */
      burstLength?: number;

      /**
       * Burst interval in seconds
       * @default 30
       */
      burstInterval?: number;

      /**
       * Rest length in minutes
       * @default 30
       */
      restLength?: number;

      /**
       * Chunk size for processing entities
       * @default 50
       */
      chunkSize?: number;

      /**
       * Backoff intervals for retry attempts (in seconds)
       * @default [30, 60, 300, 1800]
       */
      backoff?: number[];
    };
  };
}
