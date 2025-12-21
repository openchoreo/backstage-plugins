import { createDevApp } from '@backstage/dev-utils';
import { openchoreoCiPlugin, OpenchoreoCiPage } from '../src/plugin';

createDevApp()
  .registerPlugin(openchoreoCiPlugin)
  .addPage({
    element: <OpenchoreoCiPage />,
    title: 'Root Page',
    path: '/openchoreo-ci',
  })
  .render();
