# @openchoreo/backstage-plugin-tech-insights-dynamic-checks-common

Backstage permissions for managing Tech Insights checks stored by
`@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks`. The backend module
enforces them and `@openchoreo/backstage-plugin-tech-insights-scorecards` uses them to decide what
the UI offers.

| Permission                           | Action | Guards                                                                                     |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------ |
| `tech-insights.dynamic-check.read`   | read   | Read-only check management: all checks (drafts included), data sources, the score overview |
| `tech-insights.dynamic-check.manage` | update | Creating, editing, deleting, publishing and dry-running checks; starting a collector run   |

Reading published checks, fact schemas and facts, and evaluating checks (which every entity's
scorecard tab needs), stay on upstream's `tech-insights.check.read`, `tech-insights.check.run` and
`tech-insights.fact-retriever.read` (`@backstage-community/plugin-tech-insights-common`).

Both are basic (non-resource) permissions, so a policy can allow or deny each one outright:

```ts
import { dynamicCheckManagePermission } from '@openchoreo/backstage-plugin-tech-insights-dynamic-checks-common';

if (isPermission(request.permission, dynamicCheckManagePermission)) {
  return {
    result: isPlatformTeam(user) ? AuthorizeResult.ALLOW : AuthorizeResult.DENY,
  };
}
```
