---
'@openchoreo/backstage-plugin-catalog-backend-module': patch
---

Fix stale form data in the component-creation Build & Deploy section.
Generated templates now nest deploymentSource and its branch-specific
fields (workflow_name, git_source, workflow_parameters, containerImage,
autoDeploy, ciPlatform, ciIdentifier) under a single buildAndDeploy
object rendered by a composite field, so switching deployment source
clears the previous branch's data atomically — fixes
"instance.workflow requires property \"name\"" when a user picks Build
from Source and then switches to Container Image or External CI.
