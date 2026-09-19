# @openchoreo/cell-diagram

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
