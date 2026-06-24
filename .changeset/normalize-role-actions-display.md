---
'@openchoreo/backstage-plugin': patch
---

Display role actions consistently in collapsed form in Access Control. When a
role grants every action in a category, the Roles table and Role dialog now
show a single "All <category> actions" entry (e.g. "All alerts actions", "All
metrics actions") instead of listing each operation individually, matching how
the action selection dialog already renders them. Roles are still stored as-is;
the collapsing is display-only and re-applies once the action catalog loads.
