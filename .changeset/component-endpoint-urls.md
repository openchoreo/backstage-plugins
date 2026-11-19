---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
---

Show the URLs of a component's Endpoints on its deploy page.

A workload endpoint that one of the component's Endpoints exposes, in an
environment that Endpoint is deployed to, takes its URLs from the Endpoint's
binding: external, internal, namespace and project, each with the security a
caller must present. The environment panel and its View All dialog show them,
with a Namespace row, a padlock describing the security (for example "API key
(header api-key)") and a link to the Endpoint they come from. An Endpoint's
project URL replaces the in-cluster service URL; without one, the service URL
stays.

Everything else keeps the URLs from the component's ReleaseBinding, as
before: components without Endpoints (such as those of legacy
ComponentTypes), workload endpoints without an Endpoint, environments the
Endpoint isn't deployed to, and any failure to read the Endpoints. Only the
Endpoints of the release line being shown count.
