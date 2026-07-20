---
'@openchoreo/backstage-plugin': patch
'@openchoreo/openchoreo-client-node': patch
---

Show container names in the resource-tree pod logs tab and add a per-container
filter. The pod logs API now returns logs aggregated across all of a pod's
containers, each entry tagged with its container. For multi-container pods
(for example an app container plus a Dapr sidecar) the logs viewer aligns
each line into timestamp / container / message columns and adds a container
dropdown ("All containers" plus one entry per container) to filter the view.
Single-container pods are unchanged.
