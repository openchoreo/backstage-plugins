export interface Config {
  techInsights?: {
    scorecards?: {
      /**
       * Set to false to show the Scorecards page and entity tab as turned
       * off, for a host that installs the plugin but switches the feature at
       * deploy time. Defaults to true. Gate the Tech Insights backend on the
       * same key so the two stay in step.
       * @visibility frontend
       */
      enabled?: boolean;
      /**
       * Names shown for entity kinds, keyed by kind, for example
       * `{ System: Project, Domain: Namespace }`. Kinds without an entry are
       * split into words: `DeploymentPipeline` is shown as "Deployment
       * pipeline".
       * @deepVisibility frontend
       */
      kindLabels?: { [kind: string]: string };
      /**
       * The word for what checks run against, in text that covers several
       * kinds, for example `{ singular: resource, plural: resources }`.
       * Defaults to "entity" and "entities".
       * @deepVisibility frontend
       */
      entityLabel?: { singular?: string; plural?: string };
      /**
       * Categories the check editor suggests, for example
       * `[Security, Reliability, Documentation]`. Categories already on a
       * check are suggested too, and an author can still type a new one.
       * @deepVisibility frontend
       */
      categories?: string[];
      /**
       * A kind scored apart from the entity it belongs to, for example
       * `{ kind: ReleaseLine, parentKind: Component }`. A parent's variants
       * are its `hasPart` targets of `kind`. Its tier covers only itself,
       * marked with `mainLabel` (default "main") beside its name, and its
       * variants are listed under it with their own tiers. Variants never
       * count towards a parent, System, Domain or Group, and have no row of
       * their own in the breakdown. Their names come from `kindLabels`.
       * @deepVisibility frontend
       */
      variants?: {
        kind: string;
        parentKind: string;
        mainLabel?: string;
      };
    };
    maturity?: {
      /**
       * Tier names, the same keys the maturity plugin reads. Tiers without a
       * title are shown as Stone, Bronze, Silver and Gold.
       */
      rank?: {
        stone?: {
          /** @visibility frontend */
          title?: string;
        };
        bronze?: {
          /** @visibility frontend */
          title?: string;
        };
        silver?: {
          /** @visibility frontend */
          title?: string;
        };
        gold?: {
          /** @visibility frontend */
          title?: string;
        };
      };
    };
  };
}
