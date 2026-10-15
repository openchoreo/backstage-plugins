import { createPortalApp } from '@openchoreo/backstage-portal-app';
import assistantFeature from '@openchoreo/backstage-plugin-openchoreo-portal-assistant/alpha';

// The Portal Assistant is a PRIVATE plugin, so it is installed here by the app
// rather than from inside `@openchoreo/backstage-portal-app` — that keeps the
// published shell free of any dependency on it, and a portal that should not
// ship the assistant simply drops this import. It is already shaped for
// frontend feature discovery (`app.packages` in app-config), which would let
// this list go away entirely; enabling that is tracked separately.
export default createPortalApp({ features: [assistantFeature] }).createRoot();
