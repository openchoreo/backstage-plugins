---
'@openchoreo/backstage-plugin-backend': patch
---

Prefer HTTPS over HTTP for endpoint URLs surfaced in the API test console. When
a ReleaseBinding endpoint exposes both an `http` and an `https` URL, the console
could show either one, since the frontend selects the first entry of each URL
map and is otherwise scheme-blind — which URL came first was decided by the
upstream control-plane response ordering. The `ReleaseBinding` transformer now
reorders each endpoint's `externalURLs`/`internalURLs` so `https` entries come
first (relative order otherwise preserved), making the existing frontend
selection land on the secure URL with no frontend change. http-only endpoints
and endpoints without URL maps are unaffected.
