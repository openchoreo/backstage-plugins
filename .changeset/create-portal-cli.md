---
'@openchoreo/create-portal': minor
---

New `npx @openchoreo/create-portal` CLI that scaffolds a custom OpenChoreo
Portal: a thin Backstage app on the published portal packages, pinned to one
release. The template is rendered from the live monorepo at pack time
(private assistant wiring stripped, `workspace:^` ranges pinned to the
lockstep release version), ships inside the CLI tarball, and is pushed to the
`openchoreo/portal-template` repo per release as the `git merge` upgrade
base.
