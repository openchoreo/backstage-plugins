---
'@openchoreo/backstage-plugin-backend': patch
---

Treat ReleaseBinding Ready reasons `ReleaseSynced`, `ResourceDependenciesPending`,
and `ResourcesNotReady` as progressing (NotReady) instead of Failed.
