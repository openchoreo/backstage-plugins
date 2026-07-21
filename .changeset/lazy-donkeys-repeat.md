---
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin': patch
---

Fix cached catalog data not refreshing after a change. Creating a component or project
left the project contents table, the namespace projects card and the catalog list showing
the previous contents until you navigated away and back. Cached catalog reads are now
refreshed before they are handed to the page, and the namespace cards update in place when
newer data arrives.
