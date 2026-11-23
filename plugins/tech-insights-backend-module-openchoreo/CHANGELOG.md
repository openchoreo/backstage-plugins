# @openchoreo/backstage-plugin-tech-insights-backend-module-openchoreo

## 1.4.0-m.3

### Minor Changes

- b08fa1d: Add a Tech Insights fact retriever that reports whether each OpenChoreo Component's last build
  succeeded and its build success rate, read from its workflow runs.
- 8d5322f: Add a Tech Insights fact retriever that reports how each OpenChoreo Component
  is deployed, such as its image registry and whether the image is pinned,
  external endpoints, secret-like plain environment values, the environments it
  runs in, and whether it's in production, ready and on its latest release.
- 8c98aa8: Add a Tech Insights fact retriever for OpenChoreo component types and cluster
  component types. It reports what each one allows, such as traits and workflows,
  and how its templates run containers, such as whether they set resource limits.
- 0522aa1: Report deployment and build facts for each ReleaseLine, read from the line's own Workload, release
  bindings, workflow runs and latest release. A Component's facts now describe its main line only.
  They no longer count other lines' bindings, so a line in production doesn't put its component
  there, and its build facts no longer count other lines' runs.

### Patch Changes

- Updated dependencies [6268316]
- Updated dependencies [86d3c99]
- Updated dependencies [bff9b10]
- Updated dependencies [bff9b10]
- Updated dependencies [be71fce]
- Updated dependencies [bff9b10]
- Updated dependencies [bff9b10]
- Updated dependencies [8aa6389]
- Updated dependencies [6268316]
- Updated dependencies [bcbd114]
- Updated dependencies [6ac94f5]
- Updated dependencies [02c5a87]
- Updated dependencies [6268316]
  - @openchoreo/backstage-plugin-common@1.4.0-m.3
  - @openchoreo/openchoreo-client-node@1.4.0-m.3
