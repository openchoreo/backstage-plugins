---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Show a sub cent cost that rounds away at two decimals as `<0.01` rather than
`0.00` across the Cost Insights view, so a very small cost reads apart from no
cost at all. Also fix the cost vs efficiency chart dropping its tooltip when the
pointer was over a bubble's rank label or over a small bubble.
