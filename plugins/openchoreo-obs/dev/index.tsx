import { createDevApp } from '@backstage/dev-utils';
import { openchoreoObsPlugin, OpenchoreoObsPage } from '../src/plugin';

createDevApp()
  .registerPlugin(openchoreoObsPlugin)
  .addPage({
    element: <OpenchoreoObsPage />,
    title: 'Root Page',
    path: '/openchoreo-obs',
  })
  .render();
