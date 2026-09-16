---
'@openchoreo/backstage-portal-app': minor
---

Add a composable home page built on Backstage's new frontend system. The home
page (`page:home`, served at `/`) now uses a customizable widget grid: the
default layout matches the previous home page (Your Starred Entities and
Recently Visited), and users can add, move, resize and remove widgets — My
Projects, Quick Actions and Recent Deployments — with their layout persisted
per user via the StorageApi (UserSettings backend). The Platform Details
section stays fixed outside the grid. Widgets are contributed via
`HomePageWidgetBlueprint` and the layout via `HomePageLayoutBlueprint`.
