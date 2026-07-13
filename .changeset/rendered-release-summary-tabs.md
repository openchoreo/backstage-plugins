---
'@openchoreo/backstage-plugin': minor
---

Show **Summary** and **Definition** tabs on the release details page when a rendered release is selected in the resource tree. The Summary tab lists the release's status conditions alongside its owning project, component, environment and target plane, so a failed apply to the data plane surfaces directly in the drawer as `ResourcesApplied=False` with the apply error as the condition message. The Definition tab renders the full rendered release as YAML.

Rendered releases are not given an Events tab: the release controllers report state through status conditions rather than Kubernetes events, so it would always be empty. Events remain available on the individual resources under a release.
