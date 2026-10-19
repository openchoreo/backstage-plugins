import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';

/**
 * `app.packages` is what installs the entire frontend. `App.tsx` has no
 * `features` array, so if this key is missing the portal renders empty — no
 * error, no warning, nothing in the logs.
 *
 * It has to be set in *two* files, because the two halves of discovery read
 * different configs:
 *
 *   build time  the CLI reads `app-config.yaml` to generate the module that
 *               sets `window['__@backstage/discovered__']`. The image builds
 *               the frontend in Dockerfile stage 1, before
 *               `app-config.production.yaml` is copied over `app-config.yaml`.
 *   run time    `discoverAvailableFeatures` re-reads `app.packages` and
 *               returns no features when it is unset. Under Rspack the
 *               build-time config is not inlined into the bundle
 *               (`process.env.APP_CONFIG` is `[]`), so app-backend — this
 *               package — injects whatever config it loaded, which in the
 *               image is `app-config.production.yaml`.
 *
 * The test lives here rather than next to `App.tsx` because `packages/app` is
 * a frontend package whose eslint config forbids node builtins, so nothing
 * there can read a file off disk.
 */
describe('app.packages', () => {
  const repoRoot = resolve(__dirname, '../../..');

  it.each(['app-config.yaml', 'app-config.production.yaml'])(
    'is enabled in %s',
    file => {
      const config = parse(readFileSync(resolve(repoRoot, file), 'utf8'));
      expect(config.app.packages).toBe('all');
    },
  );
});
