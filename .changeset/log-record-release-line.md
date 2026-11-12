---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/openchoreo-client-node': minor
---

The Logs tab adds a Release Line column when its logs cover more than one release line: All lines of a component with release lines, or a project with such a component. The column is shown by default and can be turned off under Selected Fields, which the project-level Logs tab now offers too, with Component Name and Log always shown. Each record's line comes from the `releaseLineName` that the Observer API now returns in log metadata, and a record without one belongs to the main line. The observability client types gain `releaseLineName` and `releaseLineUid` on log entry metadata.
