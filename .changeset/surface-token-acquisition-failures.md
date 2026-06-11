---
'app': patch
---

Surface IDP token acquisition failures instead of silently sending unauthenticated requests. Direct-mode fetches and permission checks now throw with the original error as cause when auth is enabled and the token cannot be acquired.
