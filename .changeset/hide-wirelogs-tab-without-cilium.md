---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
---

Add the `useComponentHasAnyCiliumEnabledEnvironment` hook, which resolves on the client whether any of a component's project environments runs Cilium — it fetches the project's environments and probes each backing DataPlane's `networkpolicyprovider` (the same source the Wirelogs page uses to enable/disable individual environments). It returns `false` until the probe confirms at least one Cilium environment.

The portal uses this to hide the component-level **Wirelogs** tab unless at least one environment runs Cilium (wirelogs are sourced from Cilium Hubble). Previously the tab was always shown and, on a core OpenChoreo setup with no Cilium DataPlanes, rendered an empty "configure Cilium" state — a dead tab with no usable content. Resolving availability at render time means no catalog-sync annotation or DataPlane event cascade is required.
