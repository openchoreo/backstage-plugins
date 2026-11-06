---
'@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy': patch
---

Shrink the catalog visibility condition so portal search stops failing for
users who belong to many projects.

`catalog.entity.read` resolves to a conditional decision carrying the user's
capability paths for every OpenChoreo-managed kind. The permission framework
repeats that payload once per authorized resource when it batches checks back
to the catalog, and the catalog parses the batch with a fixed 100 KB body
limit. A user holding a project-scoped role in each of their projects produced
a payload large enough that a single page of search hits overflowed the limit,
and the whole query failed with `There was a problem performing the search
query` (a 413 behind the scenes). Narrow searches with few hits still worked,
which is what made it look like a search problem rather than an authorization
one.

Three changes keep the payload flat: paths already implied by a broader path
in the same list are dropped (a role bound per project collapses into the
namespace-wide grant that covers it), kinds that resolve to the same paths now
share one entry instead of repeating it, and the kind list and the unused
action name are no longer sent at all. The decisions themselves are unchanged
— only their wire size. For the reported case this is roughly a 7x reduction
per resource.

Conditions produced by an earlier version are still understood, so a
deployment that rolls the permission and catalog backends separately keeps
working during the rollout.
