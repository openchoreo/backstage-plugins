# @openchoreo/cell-diagram

## 1.4.0-m.1

### Minor Changes

- cdc4c6e: Support components with release lines.

  - Every component has an implicit `main` line, built from the component's own workload and bindings. Its other lines are ReleaseLine resources, synced to the catalog as a new `ReleaseLine` kind, part of their component and visible to whoever can view the component. They are not listed in the catalog viewer or search, and are reached from their component's Overview.
  - Components are created as before. Any component's context menu offers Create Release Line. Once a component has a release line, its Overview lists its lines, `main` first, with their environments, latest release and overrides. The component's own tabs work on the main line, which can't be edited, deleted or created. The names `main` and `default` are rejected for a new line: `main` is the implicit line, and `default` is reserved.
  - Each release line has its own page with the component's tabs (build, deploy, logs, metrics, ...) scoped to that line. Its Definition tab edits the properties the line overrides, next to the properties it inherits from the component, which are read-only and edited on the component's Definition page.
  - The `main` keyword is never written into a resource or request: releases, deploys, workload saves, dependencies and builds for the main line leave the release line empty. A dependency on a component with release lines picks the main line or one of its release lines, the main line unless chosen otherwise.
  - The project cell diagram shows the main line and each release line of a component as their own nodes, labelled with the component name and a pill with the line name, with a Release line filter. Dependencies link to the line they name, or to the main line, and gateway metrics are scoped per line. Clicking a line node opens the line's page.
  - Runtime logs, events, metrics, alerts, project logs, metrics, traces and incidents, cost insights and cost analysis reports get a Release line filter of All lines, `main` or one line, shown for a component with release lines. On a release line's page they are scoped to the line. Alert and incident details show the release line when there is one, and the observability API reports clearly when the installed FinOps module cannot filter costs by line.
  - The Delivery Insights page shows a Release line filter when the selected component has release lines, narrowing the metrics and the per-environment breakdown to `main` or one line.
  - An RCA report's Incident Overview shows the release line the alert fired on.
  - Cost analysis reports show their line in their overview and in the reports list, and link to the line's page and metrics, or the component's for the main line. Apply Recommendation names the release binding it updates and refuses a binding that belongs to another line.
  - Cost Insights applies a recommendation to the binding of the selected release line, and refuses a binding of another line. For a component with release lines, Apply is disabled until a line is chosen, since a recommendation for all lines matches no single binding.
  - Workflow runs returned by the workflows backend include their labels, so a run can be matched to its release line.
  - The environment overview lists each release line deployed in an environment as its own row, linked to the line's page, and Recent Deployments shows release lines next to components. `GET /release-bindings` returns the main line's bindings without a line, and every line's with `allReleaseLines=true`.
  - The unused `promoteToEnvironment` client method and the backend `/promote-deployment` route are removed. The OpenChoreo API no longer has the promote endpoint they called, and the Promote action deploys through the release binding instead.
  - A new release line's Workload and bindings are named as OpenChoreo names a line's objects, `{component}-{line}-{hash}`, so they never take a name another component needs. Deploy, promote, saving overrides and removing a deployment find a line's binding by its owner (component, line and environment) rather than by name, since a binding created elsewhere may be named otherwise.

  Components without release lines behave as before.

## 1.3.0

### Minor Changes

- 497b480: Support namespace-level (organization) cell diagrams. Re-export `CellBounds`
  from the public API so hosts can build `Organization`/`OrgConnection` models,
  and add single-click activation on org-view project cells (fires
  `onComponentDoubleClick` once with the project id, guarded so canvas pan/drag
  does not open the preview).

  Clicking a cell in the org (namespace) view opens an in-place preview of that
  project's cell diagram — the same single-project view, reusing data already
  fetched — with a "Go to Project" action that navigates to the project's
  cell-diagram tab. This is driven entirely by the existing
  `onComponentDoubleClick` callback. The org-view cell's hover affordance now uses
  a zoom-in icon (with a "Preview Project" tooltip) instead of the open-in-new
  icon, reflecting that the click opens an inline preview rather than navigating
  away.

## 1.3.0-next.0

### Minor Changes

- 497b480: Support namespace-level (organization) cell diagrams. Re-export `CellBounds`
  from the public API so hosts can build `Organization`/`OrgConnection` models,
  and add single-click activation on org-view project cells (fires
  `onComponentDoubleClick` once with the project id, guarded so canvas pan/drag
  does not open the preview).

  Clicking a cell in the org (namespace) view opens an in-place preview of that
  project's cell diagram — the same single-project view, reusing data already
  fetched — with a "Go to Project" action that navigates to the project's
  cell-diagram tab. This is driven entirely by the existing
  `onComponentDoubleClick` callback. The org-view cell's hover affordance now uses
  a zoom-in icon (with a "Preview Project" tooltip) instead of the open-in-new
  icon, reflecting that the click opens an inline preview rather than navigating
  away.

## 1.2.0

### Minor Changes

- 436c144: Bring the Cell Diagram library into the repo as the internal package
  `@openchoreo/cell-diagram` (previously the external `@wso2/cell-diagram`). The
  exported API is unchanged; the frontend and backend plugins now consume the
  workspace package.

## 1.2.0-next.3

### Minor Changes

- 436c144: Bring the Cell Diagram library into the repo as the internal package
  `@openchoreo/cell-diagram` (previously the external `@wso2/cell-diagram`). The
  exported API is unchanged; the frontend and backend plugins now consume the
  workspace package.
