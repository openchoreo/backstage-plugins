import { createPortalApp } from '@openchoreo/backstage-portal-app';

// Your portal's frontend. Pass additional frontend features (plugins and
// modules) through `createPortalApp({ features: [...] })` — see the
// @openchoreo/backstage-portal-app docs.
export default createPortalApp().createRoot();
