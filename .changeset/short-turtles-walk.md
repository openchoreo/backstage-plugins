---
'@openchoreo/backstage-plugin-react': patch
---

Fix the flaky `useOpenChoreoCache` invalidate test. The test client's `gcTime: 0`
could evict the cache entry before the test read it back on a slow runner, so it
now runs on fake timers like the `staleTime` test in the same file.
