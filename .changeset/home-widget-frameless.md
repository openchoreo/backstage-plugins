---
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-react': patch
---

Support frameless rendering for widgets embedded in a home page card. `SummaryWidgetWrapper` gains a `disableCard` prop and `MyProjectsWidget` forwards it; `QuickActionsSection` gains a `hideTitle` prop. These let the components render body-only content when an outer card extension already provides the card frame and title, avoiding duplicated headers.
