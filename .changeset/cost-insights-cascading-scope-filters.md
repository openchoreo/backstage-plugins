---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-design-system': minor
---

Make the Cost Insights scope filters (Namespaces, Projects, Components) read
the way they behave, and improve the page's load time.

- **Every option is ticked when the filter says "All".** Removed the earlier
  contradiction where nothing was selected when the filter said "All".
- **One tier is narrowed at a time.** A dropdown is enabled once its parent
  holds a single item. A disabled trigger says on hover what to select to unlock it.
- **Namespaces default to all**, rather than to the `default` namespace. A tier
  holding exactly one option reads as that option's name — `Namespaces: default`,
  instead of a bare "All".

`MultiSelectFilter` gains four optional props for this: `showOnlyAction` (a
per-row **Only** action, so narrowing an all-ticked list to one value is one
click), `hideClear` (for filters where an empty selection is not a state),
`disabledHint` (tooltip explaining why the filter is disabled), and
`nameSoleOption` (a lone option shows its name instead of "All"). All four
default to off, so existing consumers are unaffected.

Each environment's cost requests are parallelized rather than awaited in sequence.

Cost Insights now opens on the last 24 hours at 1-hour granularity, so the
time-series charts land on a readable number of buckets instead of one.
