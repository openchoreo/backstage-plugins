export interface Config {
  openchoreo?: {
    /**
     * Incremental catalog ingestion tuning. Only read when
     * openchoreo.features.incrementalIngestion.enabled is true.
     */
    incremental?: {
      /**
       * Duration of each ingestion burst in seconds.
       * @visibility backend
       */
      burstLength?: number;
      /**
       * Interval between ingestion bursts in seconds.
       * @visibility backend
       */
      burstInterval?: number;
      /**
       * Number of entities to fetch per page. The OpenChoreo API caps page
       * size at 100 (LimitParam maximum), so values above 100 are clamped.
       * @visibility backend
       */
      chunkSize?: number;
      /**
       * Rest period after a completed ingestion, in minutes.
       * @visibility backend
       */
      restLength?: number;
    };
  };
}
