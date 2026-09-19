# @openchoreo/backstage-portal-backend

## 1.3.0

### Minor Changes

- ca4d1b2: Add `@openchoreo/backstage-portal-backend` — the stock portal's backend
  composition (feature bundle + IDP root-router middleware) as a reusable
  published package. The monorepo backend now consumes it; runtime behavior is
  unchanged. The app shell also moves into the private
  `@openchoreo/backstage-portal-app` package (`createPortalApp()`), leaving
  `packages/app` as a thin consumer — the shared base for the new-frontend-system
  migration and the custom-portal scaffold.

### Patch Changes

- Updated dependencies [4c7f96c]
- Updated dependencies [9130de9]
- Updated dependencies [c234b33]
- Updated dependencies [36f0982]
- Updated dependencies [67ba0da]
- Updated dependencies [9eb3d31]
- Updated dependencies [4278619]
- Updated dependencies [435463f]
- Updated dependencies [eb94bf1]
  - @openchoreo/backstage-plugin-openchoreo-observability-backend@1.3.0
  - @openchoreo/backstage-plugin-scaffolder-backend-module@1.3.0
  - @openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth@1.3.0
  - @openchoreo/backstage-plugin-backend@1.3.0
  - @openchoreo/backstage-plugin-catalog-backend-module@1.3.0
  - @openchoreo/backstage-plugin-openchoreo-ci-backend@1.3.0
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.3.0
  - @openchoreo/backstage-plugin-openchoreo-workflows-backend@1.3.0
  - @openchoreo/backstage-plugin-platform-engineer-core-backend@1.3.0
  - @openchoreo/openchoreo-auth@1.3.0
  - @openchoreo/backstage-plugin-catalog-backend-module-openchoreo-users@1.3.0

## 1.3.0-next.0

### Minor Changes

- ca4d1b2: Add `@openchoreo/backstage-portal-backend` — the stock portal's backend
  composition (feature bundle + IDP root-router middleware) as a reusable
  published package. The monorepo backend now consumes it; runtime behavior is
  unchanged. The app shell also moves into the private
  `@openchoreo/backstage-portal-app` package (`createPortalApp()`), leaving
  `packages/app` as a thin consumer — the shared base for the new-frontend-system
  migration and the custom-portal scaffold.

### Patch Changes

- Updated dependencies [4c7f96c]
- Updated dependencies [9130de9]
- Updated dependencies [c234b33]
- Updated dependencies [36f0982]
- Updated dependencies [67ba0da]
- Updated dependencies [9eb3d31]
- Updated dependencies [4278619]
- Updated dependencies [435463f]
- Updated dependencies [eb94bf1]
  - @openchoreo/backstage-plugin-openchoreo-observability-backend@1.3.0-next.0
  - @openchoreo/backstage-plugin-scaffolder-backend-module@1.3.0-next.0
  - @openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth@1.3.0-next.0
  - @openchoreo/backstage-plugin-backend@1.3.0-next.0
  - @openchoreo/backstage-plugin-catalog-backend-module@1.3.0-next.0
  - @openchoreo/backstage-plugin-openchoreo-ci-backend@1.3.0-next.0
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.3.0-next.0
  - @openchoreo/backstage-plugin-openchoreo-workflows-backend@1.3.0-next.0
  - @openchoreo/backstage-plugin-platform-engineer-core-backend@1.3.0-next.0
