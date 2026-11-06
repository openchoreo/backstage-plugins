---
'@openchoreo/backstage-portal-app': patch
---

Render the Support button in the Catalog, APIs and Create page headers, so
`app.support` in `app-config` actually reaches users.

The portal replaces Backstage's own catalog, API explorer and template list
pages, and those replacements dropped the Support button that upstream puts in
each page header. Setting `app.support` therefore had no visible effect
anywhere except the Register-component page. The button still renders only when
`app.support` is configured, so portals that leave it unset are unchanged.
