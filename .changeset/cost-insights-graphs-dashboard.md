---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
---

Expand the Cost Insights **Graphs** tab into a
multi-chart dashboard rendered at every scope level:

- **Spend forecast** – cumulative actual spend this month plus two month-end
  projections ("at current rate" and "if recommendations applied"), with a
  clickable legend to toggle each line. Independent of the chart granularity.
- **Cost vs efficiency** – a scatter of each dimension (x: efficiency, y: cost,
  bubble size: potential saving) with a low-efficiency band, numbered bubbles,
  and a clickable numbered legend.
- **Cost over time** – a per-dimension line chart and the existing stacked-bar
  chart; at the component level the bar chart overlays a dashed
  "if recommendations applied" line.

The per-dimension saving and aggregate `totalSaving` are now computed at all
levels (previously component-only), recommendations are fetched for the graphs
view, and each chart carries an info tooltip describing what it shows.
