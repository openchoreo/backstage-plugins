---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
---

Surface the deployed OpenChoreo platform version in the Console. The backend
gains a `GET /platform-version` route proxying the OpenChoreo API server's
public `/version` endpoint; the frontend gains `getPlatformVersion()` on the
client and a `PlatformAboutCard` component. The stock portal shows the card
in Settings → General next to the stock user-settings cards.
