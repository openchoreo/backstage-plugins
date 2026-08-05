---
'app': patch
'@openchoreo/backstage-plugin-catalog-backend-module': patch
---

Register the Jenkins frontend plugin so the build-status card and tab work.
`EntityLatestJenkinsRunCard` and `EntityJenkinsContent` are entity cards and
tabs rather than routes, so `convertLegacyAppRoot` never discovered the plugin
and `jenkinsApiRef` had no factory — the entity page threw
`NotImplementedError: No implementation available for apiRef{plugin.jenkins.service2}`.
Same fix already applied for api-docs and kubernetes.

Also clarifies the scaffolder's CI identifier field: it takes a Jenkins job
**full name** (`my-folder/my-job`), not a `/job/...` URL path. The plugin adds
the `/job/` segments itself, so a URL-style value resolves to a folder literally
named `job` and 404s.
