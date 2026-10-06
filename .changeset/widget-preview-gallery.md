---
'@openchoreo/backstage-portal-app': minor
---

Replace the plain Add widget list on the home page with a live preview gallery.

- Shows each available widget as a card with a live preview, title and description in a three column grid.
- Adds a search box that filters widgets by title and description, with an empty state when nothing matches.
- Copies Backstage's `CustomHomepageGrid` and its supporting files into the portal app, because the add widget dialog is private to `@backstage/plugin-home`.
- Declares the `react-grid-layout`, `react-resizable`, `lodash` and `zod` dependencies that the copied files import.
