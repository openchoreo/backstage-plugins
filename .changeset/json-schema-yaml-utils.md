---
'@openchoreo/backstage-plugin-react': patch
---

Add JSON Schema → annotated YAML utilities (`buildYamlString`,
`buildYamlData`, `generateDefaults`) for editors that toggle between a
structured form and a raw YAML view. `buildYamlString` walks the schema
recursively so nested required scalars get a `# required` hint and
enum-constrained scalars get `# allowed: <values>`; `allOf` composition,
nullable type arrays (`["object", "null"]`), and non-string enum values
are handled. `TraitConfigToggle` now delegates to these helpers in
place of its previous single-level annotation, so deeply-required and
enum fields in trait schemas surface their constraints in the YAML
view.
