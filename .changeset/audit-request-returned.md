---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
---

Show the `request` and `returned` groups of a schema 1.1 audit record in the
event drawer: the parameters a read was asked for, and how many entries it
returned along with the identity of each object. Each returned object's name
filters the trail by `returned.items.name`, which the query bar also accepts as
an exact value. Records at schema 1.0 render as before.
