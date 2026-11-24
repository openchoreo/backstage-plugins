# Check Authoring over MCP

The dynamic-checks module registers its operations as Backstage actions, and
`@backstage/plugin-mcp-actions-backend` serves them as MCP tools. The Portal
Assistant uses them to draft, validate and save checks.

## Tools

| Tool                                                                | What it does                              | Who may call it                                   |
| ------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| `list_checks`, `get_check`, `list_fact_schemas`, `get_entity_facts` | read checks and facts                     | a user with read permission, or a service token   |
| `dry_run_check`, `validate_check`                                   | evaluate or validate an unsaved rule      | a user with manage permission, or a service token |
| `create_check`                                                      | save a new check as a draft               | a signed-in user with manage permission           |
| `update_check`                                                      | change a check's rule, texts and metadata | a signed-in user with manage permission           |
| `publish_check`, `unpublish_check`                                  | put a check in or out of scoring          | a signed-in user with manage permission           |

Writes use the same permission (`dynamicCheckManagePermission`) and the same
`CheckValidator` as the REST routes. `update_check` and `publish_check`
refuse a rule that can't be evaluated.

## Configuration

`packages/backend/src/index.ts` adds `@backstage/plugin-mcp-actions-backend`.
The rest is config, for example in `app-config.local.yaml`:

```yaml
backend:
  # A static token for tools that only read (e.g. Claude Code, or the Portal
  # Assistant without a signed-in user). Service tokens can't save checks.
  auth:
    externalAccess:
      - type: static
        options:
          token: ${MCP_DEV_TOKEN}
          subject: mcp-dev
  # Plugins whose actions are discovered.
  actions:
    pluginSources: [tech-insights]

mcpActions:
  # Plain tool names (list_checks), not tech-insights.list_checks.
  namespacedToolNames: false
  servers:
    check-authoring:
      name: Check Authoring
      description: Draft, validate, dry-run, save and publish tech-insights checks
      filter:
        include:
          - id: 'tech-insights:*'
```

The server is served at `/api/mcp-actions/v1/check-authoring`. The Portal
Assistant points `BACKSTAGE_MCP_URL` at it and uses `BACKSTAGE_MCP_TOKEN`
(the static token) for reads.

`backend.actions.filter` is not set: the MCP server and the scaffolder read
the same action list, so a global filter would hide actions from both.

## How the Portal Assistant saves a check

1. The drawer sends the user's Backstage token to the
   `openchoreo-portal-assistant-backend` forwarder, which verifies it and
   issues a short-lived token on the user's behalf, valid only for
   `mcp-actions`. The user's own token is not forwarded.
2. In check-authoring chats the assistant calls the Backstage tools with that
   token, so reads run as the user. The model never gets the write tools.
3. After the assistant drafts or edits a rule, code (not the model) reads the
   rule from the reply, validates it with `validate_check`, and sends a
   signed confirm card.
4. The user picks Save as draft or Save and publish on the card. The agent's
   `/chat/confirm` endpoint checks the signature and runs `create_check` /
   `update_check`, then `publish_check` / `unpublish_check`, as the user.
