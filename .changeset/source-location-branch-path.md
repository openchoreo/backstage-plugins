---
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-catalog-backend-module': patch
---

Synced Components hosted on GitHub or GitLab now carry
`backstage.io/source-location` in the form Backstage itself writes,
`url:<repo>/tree/<branch>/<appPath>/` (`/-/tree/` on GitLab), instead of the
bare repository URL. The trailing `/` marks it as a folder, which Backstage
needs to resolve relative paths against it. Tools that read the standard
annotation (the "View source" link, Tech Insights fact retrievers) get the
branch and the component's folder without an OpenChoreo-specific annotation.
Other hosts, such as Bitbucket and Azure DevOps, lay out these URLs
differently and keep the repository URL. `openchoreo.io/branch` is still
written, because a branch name containing `/` can't be told apart from the
folder after it in a URL.

`getRepositoryUrl()` changes to match:

- it no longer assumes `main` when the branch is unknown, and returns the
  repository URL instead;
- with a branch but no app path it returns `<repo>/tree/<branch>` rather than
  the bare repository URL;
- it returns the repository URL for hosts other than GitHub and GitLab, which
  it recognises by `github.com`, `gitlab.com` or a host whose first label is
  `github` or `gitlab`;
- it strips a trailing `.git` from the repository URL and a leading `./` or
  `/` from the app path.
