---
'@openchoreo/backstage-plugin-react': patch
---

Fix the "Add Trait" / "Update Trait" button staying disabled in the YAML
view of the trait dialogs even after the user has filled in every
required field. `TraitConfigToggle` now propagates each YAML edit to
the parent (debounced 150 ms; flushed synchronously on blur and when
switching to form view), so schema-validity recomputes as the user
types instead of only on focus loss.
