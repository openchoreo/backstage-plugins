---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-plugin-react': patch
---

Extend the component-level **Cost Insights** table to show right-sizing
recommendations and apply them in one click.

- **Recommendation table**: per-environment rows show the current cost (with
  cpu/memory breakdown), an efficiency bar, the recommended resource-request
  change (e.g. `cpu 100m → 12m`), the resulting saving (with percentage), and an
  **Apply** button.
- **Apply action**: resolves the environment's ReleaseBinding, shows a
  confirm-diff dialog, and applies the recommended CPU/memory. Gated on the
  env-scoped `releasebinding:update` permission; the button is disabled when
  there is nothing to apply.
- **Stale-recommendation guard**: recommendations are withheld (with an
  explanatory notice showing the spec update time) when the binding was updated
  after the selected window started, plus a 5-minute settling buffer, so
  pre-change usage can't produce misleading recommendations.
- **Polish**: costs rounded to 2 decimals, more prominent summary-card values,
  gap-filling for missing graph buckets, and a full loader (no stale data) when
  the window/scope changes.
