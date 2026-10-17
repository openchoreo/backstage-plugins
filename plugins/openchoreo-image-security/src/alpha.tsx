import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { isOpenChoreoManagedOfKind } from '@openchoreo/backstage-plugin-common';
import {
  ImageSecurityClient,
  imageSecurityApiRef,
} from './api/ImageSecurityApi';

const imageSecurityClientApi = ApiBlueprint.make({
  name: 'open-choreo-image-security-client',
  params: defineParams =>
    defineParams({
      api: imageSecurityApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new ImageSecurityClient(discoveryApi, fetchApi),
    }),
});

const securityEntityContent = EntityContentBlueprint.make({
  name: 'security',
  params: {
    path: '/security',
    title: 'Security',
    filter: isOpenChoreoManagedOfKind('component'),
    loader: () =>
      import('./components/ImageSecurityContent').then(m => (
        <m.ImageSecurityContent />
      )),
  },
});

/**
 * NFS entry point for the OpenChoreo image security plugin.
 */
export default createFrontendPlugin({
  pluginId: 'openchoreo-image-security',
  extensions: [imageSecurityClientApi, securityEntityContent],
});
