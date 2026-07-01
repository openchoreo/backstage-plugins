---
'@openchoreo/cell-diagram': minor
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-backend': patch
---

Bring the Cell Diagram library into the repo as the internal package
`@openchoreo/cell-diagram` (previously the external `@wso2/cell-diagram`). The
exported API is unchanged; the frontend and backend plugins now consume the
workspace package.
