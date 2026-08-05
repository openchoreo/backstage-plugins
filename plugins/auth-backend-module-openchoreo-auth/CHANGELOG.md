# @openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth

## 1.1.5

### Patch Changes

- 8525e63: Authenticate backend-to-backend calls (scaffolder catalog reads and the
  sign-in `cache-capabilities` hook) with a service identity so they no longer
  return `401` once the default auth policy is enforced.

## 1.1.1

- Compatible release for OpenChoreo 1.1.1.

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
