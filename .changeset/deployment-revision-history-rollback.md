---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/openchoreo-client-node': minor
---

See a deployment's revision history on the Deploy tab and roll back to an earlier revision.

The environment panel shows the active revision of a component or resource binding, and its Roll back action opens a revision browser:

- search revisions, view one revision's details and manifest, or compare two;
- roll back to the selected revision after a preview of what will change;
- delete a revision that is not protected;
- see the binding's revision history limit and where it comes from (the binding, the Environment or the default), set it on the binding or reset it, with a warning before a change deletes revisions or a limit of 0 turns rollback off;
- when auto deploy blocks a rollback in the first environment, turn auto deploy off from the dialog and continue.

A component with release lines shows one binding's revisions. Rollback, revision delete and limit changes need the `openchoreo.releasebinding.rollback`, `openchoreo.releasebinding.deleterevision` and binding update permissions (and their resource binding equivalents); actions the user can't perform are disabled.

The backend adds routes to list, get and delete revisions, roll back a binding, and `GET`/`PUT /binding-revision-history-limit`. The OpenAPI spec and generated client are synced with the API.
