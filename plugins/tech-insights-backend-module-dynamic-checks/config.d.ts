export interface Config {
  techInsights?: {
    dynamicChecks?: {
      /**
       * Adds the checks an OpenChoreo portal starts with, published. Each is
       * added once per database and never updated afterwards, so edits,
       * unpublishing and deletion stick. The checks read facts from the
       * OpenChoreo and GitHub fact retrievers. Defaults to false.
       */
      openchoreoStarterChecks?: boolean;
    };
  };
}
