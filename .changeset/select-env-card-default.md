---
'@openchoreo/backstage-plugin': patch
---

Auto-select a default card in the Environments deploy graph instead of
landing users on an empty detail panel: first env with an active or
pending deployment, else the first failed env, else the first undeployed
env, falling back to the Setup card when only never-deployed envs exist.
Only applies while nothing is selected, so it never overrides a manual
choice.
