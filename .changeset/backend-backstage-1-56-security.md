---
'app': patch
'backend': patch
---

Security update for the portal image: Backstage 1.56.6, the newest Jenkins,
GitHub Actions and GitLab plugins built for it, Express 4.22, React Router
6.30.6 and `node-gyp` 11, plus refreshed transitive dependencies. The image no
longer ships `vm2` or `tar` 6 and has no critical advisories left in its
production dependencies.
