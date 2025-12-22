import { createDevApp } from '@backstage/dev-utils';
import { openchoreoCiPlugin, WorkflowsPage} from '../src/plugin';

createDevApp()
  .registerPlugin(openchoreoCiPlugin)
  .addPage({
    element: <WorkflowsPage />,
    title: 'Root Page',
    path: '/openchoreo-ci',
  })
  .render();
