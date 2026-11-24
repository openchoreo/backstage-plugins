---
'@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks': minor
---

Register the check operations as Actions Registry actions, which
`@backstage/plugin-mcp-actions-backend` serves as MCP tools. `list_checks`,
`get_check`, `list_fact_schemas`, `get_entity_facts`, `dry_run_check` and
`validate_check` only read. `create_check`, `update_check`, `publish_check` and
`unpublish_check` need a signed-in user with the manage permission. Add
`GET /dynamic-checks/fact-schemas`, which lists only running fact retrievers, and
reject rules that use `equal` or `notEqual` with a list value, or a non-list
operator on a list fact.
