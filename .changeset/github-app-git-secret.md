---
'@openchoreo/backstage-plugin': minor
---

Add a GitHub App option to the git secret dialog used during component
creation, alongside the existing Basic Authentication and SSH Authentication
choices. Selecting it asks for an App ID, Installation ID, and Private Key,
and stores them as an Opaque secret through the existing generic secrets
endpoint.
