---
'@openchoreo/backstage-plugin': patch
---

Fix narrow rendering of the Access Control and Secrets settings tabs.

The `SubPageBlueprint` loaders returned bare `<AccessControlContent />` /
`<SecretsContent />`. When upstream's `page:user-settings` is rendered under
a `<Page>`-based `core.page-layout` (what the OpenChoreo portal uses), the
body ends up directly inside `<Page>`'s CSS grid without claiming the
`pageContent` grid area, so it shrinks to its intrinsic width.

Wrap both loader results in `<Content>` — the same pattern upstream's own
General / Auth Providers / Feature Flags sub-pages use. Behavior under the
default (flex-based) page layout is unchanged; the wrapper just adds the
standard Backstage sub-page padding.
