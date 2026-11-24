---
'@openchoreo/backstage-plugin-tech-insights-scorecards': minor
---

Help write checks on list facts. In a condition on a `set` fact, the rule
editor suggests `path`, and when the fact's schema lists its entry fields in
`metadata.entries`, it suggests JSONPath selections over them, such as
`$[*].<field>` and `$[?(@.<flag>)].<field>`, with each field's type and
description. It warns when a path names a field the entries don't have, and
when `everyFact:` or `someFact:` is used without a `path` on a fact that isn't
a list; warnings don't block saving. Dry run shows what a path selected next
to the whole fact, and says when it selected nothing.
