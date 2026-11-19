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
      /**
       * Kinds whose entities also run every check that matches their parent
       * entity, against their own facts. `parentField` is the dot path to the
       * field holding the parent's entity ref, such as `spec.component`.
       */
      inheritChecks?: Array<{
        kind: string;
        parentField: string;
      }>;
    };
  };
}
