import '@backstage/cli/asset-types';
import ReactDOM from 'react-dom/client';
import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import maturityPlugin from '@backstage-community/plugin-tech-insights-maturity/alpha';
import scorecardsPlugin from '../src/alpha';

// The page, the entity tab and the summary card against the backend in the
// repository's app-config. The catalog provides the entity pages, and the
// maturity plugin provides the API the scores are read through.
const app = createApp({
  features: [catalogPlugin, maturityPlugin, scorecardsPlugin],
});

ReactDOM.createRoot(document.getElementById('root')!).render(app.createRoot());
