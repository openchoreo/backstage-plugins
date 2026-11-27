# Check Authoring over MCP

The dynamic-checks module registers its operations as Backstage actions, and
`@backstage/plugin-mcp-actions-backend` serves them as MCP tools. The Portal
Assistant uses them to draft, validate and save checks.

## Tools

With namespaced tool names (the default), each tool is called
`tech-insights.<action>`, e.g. `tech-insights.list-checks`.

| Action                                                              | What it does                              | Permission |
| ------------------------------------------------------------------- | ----------------------------------------- | ---------- |
| `list-checks`, `get-check`, `list-fact-schemas`, `get-entity-facts` | read checks and facts                     | read       |
| `dry-run-check`, `validate-check`                                   | evaluate or validate an unsaved rule      | manage     |
| `create-check`                                                      | save a new check as a draft               | manage     |
| `update-check`                                                      | change a check's rule, texts and metadata | manage     |
| `publish-check`, `unpublish-check`                                  | put a check in or out of scoring          | manage     |

Every call is authorized like the REST routes, with
`dynamicCheckReadPermission` or `dynamicCheckManagePermission`, so the
permission policy decides who may call what. The actions that save also need
a signed-in user. They share the REST routes' `CheckValidator`, dry-run,
errors and entity access: `create-check`, `update-check` and `publish-check`
refuse a rule that can't be evaluated, and `dry-run-check` returns the same
result as `POST /dynamic-checks/dry-run`, with a rule that can't be evaluated
as status `invalid`. `create-check` takes an optional id, so a repeated create
is refused instead of saving a second check.

## Configuration

`packages/backend/src/index.ts` loads `@backstage/plugin-mcp-actions-backend`
with Scorecards, and `app-config.yaml` serves the tech-insights actions:

```yaml
backend:
  actions:
    pluginSources: [tech-insights]

mcpActions:
  servers:
    check-authoring:
      name: Check Authoring
      description: Draft, validate, dry-run, save and publish tech-insights checks
      filter:
        include:
          - id: 'tech-insights:*'
```

The server is served at `/api/mcp-actions/v1/check-authoring`. The Portal
Assistant points `BACKSTAGE_MCP_URL` at it. Every call runs as the signed-in
user (openchoreo/openchoreo#5502); there is no static token.

`backend.actions.filter` is not set: the MCP server and the scaffolder read
the same action list, so a global filter would hide actions from both.

## How the Portal Assistant saves a check

1. In a check-authoring chat, the drawer sends the user's Backstage token to
   the `openchoreo-portal-assistant-backend` forwarder, which verifies it and
   issues a short-lived token on the user's behalf, valid only for
   `mcp-actions`. The user's own token is not forwarded, and other chats get no
   token.
2. The assistant calls the Backstage tools with that token, so every call runs
   as the user. The model never gets the write tools.
3. After the assistant drafts or edits a rule, code (not the model) validates
   it with `validate-check` and sends a signed confirm card.
4. The user picks Save as draft or Save and publish on the card. The agent's
   `/chat/confirm` endpoint checks the signature and runs `create-check` (with
   the card's id) or `update-check`, then `publish-check` / `unpublish-check`,
   as the user.
