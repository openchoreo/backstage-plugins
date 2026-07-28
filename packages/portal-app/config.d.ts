export interface Config {
  app?: {
    /**
     * Portal branding overrides — re-brand the OpenChoreo portal via config,
     * without a fork or rebuild. All values are optional; omitting the whole
     * block yields the stock OpenChoreo look. Unrelated to `app.title`
     * (browser/window title) and `organization.name` (Backstage org
     * components) — there is deliberately no fallback chaining between them.
     * @deepVisibility frontend
     */
    branding?: {
      /**
       * Product name shown as the sidebar wordmark and on the sign-in card.
       * Defaults to "OpenChoreo".
       * @visibility frontend
       */
      name?: string;
      /**
       * Square logo for the collapsed sidebar. Absolute URL or data URI, used
       * verbatim as an img src (rendered at 24px height). Defaults to the
       * OpenChoreo mark. Data URIs are recommended: remote URLs may require
       * extending `backend.csp` img-src in production.
       * @visibility frontend
       */
      iconLogo?: string;
      /**
       * Logo for the expanded sidebar. Absolute URL or data URI, used
       * verbatim as an img src (max 32px tall / 180px wide). When set it
       * replaces the icon + wordmark row entirely. Data URIs recommended,
       * same CSP caveat as `iconLogo`.
       * @visibility frontend
       */
      fullLogo?: string;
      theme?: {
        light?: {
          /**
           * Brand accent for the light theme (CSS color, e.g. "#0d9488").
           * Drives the primary palette, links, sidebar selection, header
           * gradients, and graph accents.
           * @visibility frontend
           */
          primaryColor?: string;
        };
        dark?: {
          /**
           * Brand accent for the dark theme. Dark header gradients keep the
           * default navy ramp in this version.
           * @visibility frontend
           */
          primaryColor?: string;
        };
      };
    };
  };
}
