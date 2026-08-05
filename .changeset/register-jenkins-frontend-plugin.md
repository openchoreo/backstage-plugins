---
'app': patch
---

Register the Jenkins frontend plugin so the build-status card and tab work.
`EntityLatestJenkinsRunCard` and `EntityJenkinsContent` are entity cards and
tabs rather than routes, so `convertLegacyAppRoot` never discovered the plugin
and `jenkinsApiRef` had no factory — the entity page threw
`NotImplementedError: No implementation available for apiRef{plugin.jenkins.service2}`.
Same fix already applied for api-docs and kubernetes.
