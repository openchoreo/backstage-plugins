---
'@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks': minor
'@openchoreo/backstage-plugin-tech-insights-dynamic-checks-common': minor
---

Register the check operations as Actions Registry actions, which
`@backstage/plugin-mcp-actions-backend` serves as MCP tools
(`tech-insights.list-checks` and so on). `list-checks`, `get-check`,
`list-fact-schemas`, `get-entity-facts`, `dry-run-check` and `validate-check`
only read. `create-check`, `update-check`, `publish-check` and
`unpublish-check` need a signed-in user with the manage permission. Every call
is authorized like the REST routes, which the actions share their validation,
dry-run and errors with. Add `GET /dynamic-checks/fact-schemas`, which lists
only running fact retrievers. Move `kindsOfFilter`, `filterCoversKinds` and
`isKindKey` to the common package. `validate-check` takes an optional check
`id`, so an edit is validated with that check's entity filter, as
`update-check` validates the save.

The validator now also rejects `equal` or `notEqual` with a list value, a
non-list operator on a list fact, a number operator on a fact that isn't a
number, fact retrievers that share no entity kind, and retrievers that don't
collect facts for any kind the check's filter allows. A published check with
one of these problems gave every entity the same answer or never had a result. After the
upgrade it is no longer evaluated and drops out of scores until it is fixed,
and the backend logs a warning naming it.
