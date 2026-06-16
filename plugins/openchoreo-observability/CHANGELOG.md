# @openchoreo/backstage-plugin-openchoreo-observability

## 1.2.0-next.2

### Patch Changes

- d19ffcf: Virtualize the log/event/trace/wirelog views with a new shared `VirtualizedLogList` primitive.

  **New shared primitive (`@openchoreo/backstage-plugin-react`)**

  `VirtualizedLogList` is a headless windowed list built on `@tanstack/react-virtual`. It handles row windowing, automatic variable/wrapped row-height measurement (via `measureElement`), follow-tail for live streams, scroll-driven load-more (`onReachEnd`), and exposes `header` / `footer` slots that render inside the scroll container so they share the rows' content width and stay aligned with the body cells.

  Alongside the primitive, three small hooks/utilities the consumers compose with:

  - `useRowExpansion()` — tracks expanded row keys in a Set lifted to the parent table, so per-row expansion survives the virtualizer unmounting off-screen rows.
  - `useAutoLoadWhenEmpty({ count, hasMore, loading, onLoadMore })` — fires `onLoadMore` once when the list is empty but the server reports more pages, restoring the IntersectionObserver-equivalent "auto-fetch when the sentinel is visible" behaviour now that there is no DOM sentinel. Re-arms on count transitions, doesn't loop on repeated empty responses.
  - `makeColumnStyle<K>(flexByKey)` — factory that builds the `getColumnStyle(key)` helper for the div-based tables. Memoizes style objects per key so cell renders return stable references.

  **Surfaces virtualized**

  - **Build Logs** (`openchoreo-ci` `LogsContent`) — per-step build log viewer with accordion sections. Single fetch per step plus periodic polling.
  - **Workflow Run Step Logs** (`openchoreo-workflows`) — generic workflow run step logs. Follow-tail pinned to the bottom while a step is running.
  - **Runtime Logs** (`openchoreo-observability` `LogsTable` / `LogEntry`) — multi-column observability runtime logs. Sticky multi-column header, severity chips, expand-on-click rows, copy/investigate actions, infinite scroll wired through `onReachEnd` + `useAutoLoadWhenEmpty` (replacing the previous IntersectionObserver sentinel). The Phase-1/2 a11y attributes (`scope="col"`, `role="status"`/`aria-busy`/`aria-hidden`) carry across to the new div-based markup as `role="table"`/`role="row"`/`role="columnheader"` and the load-more spinner.
  - **Runtime Events** (`openchoreo-observability` `EventsTable` / `EventEntry`) — same shape as Runtime Logs (multi-column, expand-on-click, infinite scroll).
  - **Wirelogs** (`openchoreo-observability` `WirelogsTable`) — Cilium flow stream viewer. The previous hand-rolled `stickToBottomRef` + `useLayoutEffect` is replaced by the primitive's `followTail`, which catches both append and same-length cap-shift / dedupe / replace-by-uuid updates via last-item-key tracking.
  - **Traces** (`openchoreo-observability` `TracesTable`) — project-level traces with expand-on-click `WaterfallView`. Click events inside the waterfall are isolated from the row toggle.

  **Shared workflow-status helpers (`@openchoreo/backstage-plugin-common`)**

  `isTerminalStatus(status)` and `isStepLive(step, parentStatus)` replace four near-identical inline copies across `BuildLogs`, `BuildEvents`, `WorkflowRunStepLogs`, `WorkflowRunEvents`, and `RunMetadataContent`. One source of truth, case-insensitive matching, structurally-typed `isStepLive` so it accepts any `{ phase?: string }`-shaped step.

  **Notable behavioural notes**

  - Long runs paint faster and scroll smoothly — only the viewport's worth of rows is mounted regardless of payload size.
  - Wrapped multi-line log entries no longer overlap (auto-measured by tanstack instead of the previous hand-rolled measurement on top of react-window v1).
  - Per-row expanded state survives scrolling off-screen and back.
  - Live streams (running step logs, wirelogs) stay pinned to the newest row while the user is at the bottom; the tail releases as soon as they scroll up.
  - Load-more recovers from a server response of `hasMore: true` with no new rows: the user can scroll away and back to the bottom to re-trigger.

- Updated dependencies [d19ffcf]
  - @openchoreo/backstage-plugin-react@1.2.0-next.2
  - @openchoreo/backstage-plugin-common@1.2.0-next.2

## 1.2.0-next.0

### Minor Changes

- 529f13c: add component events view and hooks

### Patch Changes

- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

- Updated dependencies [529f13c]
- Updated dependencies [1207eda]
- Updated dependencies [7c76d05]
- Updated dependencies [8d8bd80]
  - @openchoreo/backstage-plugin-common@1.2.0-next.0
  - @openchoreo/backstage-plugin-react@1.2.0-next.0
  - @openchoreo/backstage-design-system@1.2.0-next.0

## 1.1.1

- HTTP metrics now refresh on refresh button click. (#595)

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
