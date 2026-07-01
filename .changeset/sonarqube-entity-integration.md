---
"app": patch
"backend": patch
---

Add SonarQube community plugin integration — shows a Code Quality tab on entity pages when the `sonarqube.org/project-key` annotation is present. Wires up `@backstage-community/plugin-sonarqube-backend` in the backend and `EntitySonarQubeContentPage` in the frontend.
