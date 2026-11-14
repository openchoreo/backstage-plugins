---
'@openchoreo/backstage-plugin-tech-insights-backend-module-github': minor
---

Add `githubCodeScanningFactRetriever`, which reads GitHub Code Scanning for
each Component's repository on the branch it builds from, the same branch
`githubRepositoryFactRetriever` reads. For every configured scanner (CodeQL and
Trivy by default, or any tool that uploads SARIF to GitHub) it reports whether
the scanner ran there and its open alerts by security severity, such as
`githubTrivyOpenCriticalAlertCount`, and `githubCodeScanners` lists the
scanners that ran. Scanners are configured under
`techInsights.github.codeScanning`.
