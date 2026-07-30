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
           * Brand accent for the light theme. Supported formats: hex with a
           * leading "#" (e.g. "#0d9488"), or fully-opaque
           * rgb()/rgba()/hsl()/hsla() with comma-separated components. Named
           * colors ("teal"), space-separated CSS4 syntax, and translucent
           * values (alpha < 1) are not supported — invalid values are
           * ignored with a console warning and the stock palette kept.
           * Drives the primary palette, links, sidebar selection, header
           * gradients, and graph accents. Parts of it render as text, so
           * prefer >= 4.5:1 contrast against white (WCAG AA); the header
           * also fades it toward white under white text (>= 3:1 needed for
           * the lightened stop). Lower-contrast colors log a console
           * warning.
           * @visibility frontend
           */
          primaryColor?: string;
        };
        dark?: {
          /**
           * Brand accent for the dark theme. Same supported formats and
           * validation as the light accent; prefer >= 4.5:1 contrast against
           * the dark page background (#0f1117). Dark header gradients keep
           * the default navy ramp in this version.
           * @visibility frontend
           */
          primaryColor?: string;
        };
      };
    };
  };
}
