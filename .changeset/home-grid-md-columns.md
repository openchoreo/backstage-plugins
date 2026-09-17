---
'@openchoreo/backstage-portal-app': patch
---

Fix the home page layout breaking on ~14" screens. The customizable widget grid
defaulted `md` to 10 columns, which can't hold two width-6 cards, so the second
card overlapped the first. `md` now uses 12 columns to keep the default cards
side by side on wide screens, while smaller breakpoints stay narrow so the cards
stack full-width.
