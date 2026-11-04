import '@backstage/cli/asset-types';
import ReactDOM from 'react-dom/client';
import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import scorecardsPlugin from '../src/alpha';

// The page against the backend in the repository's app-config. The catalog
// provides the entities a check is dry-run against.
const app = createApp({
  features: [catalogPlugin, scorecardsPlugin],
});

ReactDOM.createRoot(document.getElementById('root')!).render(app.createRoot());
