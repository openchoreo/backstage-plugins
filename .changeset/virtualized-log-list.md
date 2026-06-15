---
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin-openchoreo-workflows': patch
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Add a shared `VirtualizedLogList` primitive (built on `@tanstack/react-virtual`) and use it to virtualize the log views.

- New headless `VirtualizedLogList` in `@openchoreo/backstage-plugin-react` wraps `@tanstack/react-virtual` to handle row windowing, automatic variable/wrapped row-height measurement (via `measureElement`), follow-tail for live logs, and scroll-driven load-more, with a footer slot for a "loading more…" indicator.
- `WorkflowRunLogs` and `WorkflowRunStepLogs` (workflows) and the build `LogsContent` view (ci) now render their log rows through `VirtualizedLogList`, so only the viewport's worth of rows is mounted regardless of payload size. Long runs paint faster and scroll smoothly, and wrapped multi-line log entries no longer overlap.
- The observability runtime logs table (`LogsTable`/`LogEntry`) is now virtualized through `VirtualizedLogList` as well. Its sticky multi-column header, severity chips, expand-on-click rows, copy/investigate actions and infinite scroll are preserved; the rows moved from a MUI `<table>` to div rows (sized to match the header) so they can be windowed, and the IntersectionObserver sentinel was replaced by the list's `onReachEnd`. The Phase-1/2 a11y improvements landed on the table (`scope="col"`, `role="status"`/`aria-busy`/`aria-hidden`) are preserved as `role="row"`/`role="columnheader"` on the new div header and on the load-more spinner.
