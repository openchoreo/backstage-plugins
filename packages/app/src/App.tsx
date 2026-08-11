import { createPortalApp } from '@openchoreo/backstage-portal-app';
import { assistantFeature } from './assistant';

export default createPortalApp({ features: [assistantFeature] }).createRoot();
