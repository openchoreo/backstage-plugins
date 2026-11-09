---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-plugin-backend': minor
---

Wirelogs get a Release line filter of All lines, `main` or one line, shown for a component with release lines. A component's wirelogs stream its main line by default, and on a release line's page they are scoped to the line. In the All lines view, each of the component's pods is badged with its line, and the flow details show the release line of a line pod. The OpenChoreo API answers `501 Not Implemented` for one line when the data plane's cluster agent can't filter by line.
