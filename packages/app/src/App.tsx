import { createApp } from '@backstage/frontend-defaults';
import { PageLoader } from '@openchoreo/backstage-design-system';

// No `features` array. `app.packages` in app-config.yaml turns on frontend
// feature discovery, which installs every dependency of this package that
// default-exports a frontend feature from its root or `./alpha` entry point:
//
//   @openchoreo/backstage-portal-app           the whole portal shell (a
//                                              feature loader, ~24 features)
//   ...-openchoreo-portal-assistant            the private Portal Assistant
//
// Adding a plugin to this portal is therefore `yarn add` plus nothing. The
// `loadingElement` stays here because it is the only piece a feature cannot
// supply — it is the Suspense fallback rendered before any feature exists.
export default createApp({
  advanced: {
    loadingElement: <PageLoader />,
  },
}).createRoot();
