import fs from 'fs-extra';
import handlebars from 'handlebars';
import os from 'node:os';
import { join as joinPath, relative as relativePath } from 'node:path';
// eslint-disable-next-line @backstage/no-relative-monorepo-imports
import { version as cliVersion } from '../package.json';
import { listFilesRecursively } from './lib/tasks';

// Plain-JS module so prepack can run it without a build.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generateTemplate } = require('../scripts/generate-template');

const SAMPLE_CONTEXT = {
  name: 'test-portal',
  version: '9.9.9',
  registry: 'https://registry.example.com',
};

describe('generateTemplate', () => {
  let outputDir: string;
  let files: string[] = [];

  beforeAll(async () => {
    outputDir = await fs.mkdtemp(joinPath(os.tmpdir(), 'portal-template-'));
    generateTemplate({ outputDir });
    files = (await listFilesRecursively(outputDir)).map(f =>
      relativePath(outputDir, f),
    );
  }, 60_000);

  afterAll(async () => {
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  it('renders the expected scaffold skeleton', () => {
    for (const expected of [
      'backstage.json',
      'tsconfig.json',
      'package.json.hbs',
      '.gitignore.hbs',
      '.yarnrc.yml.hbs',
      '.openchoreo-portal.json.hbs',
      'README.md.hbs',
      'app-config.yaml',
      'app-config.production.yaml',
      'app-config.local.yaml.example',
      'catalog-entities/org.yaml',
      'templates/create-openchoreo-componenttype/template.yaml',
      'packages/app/src/App.tsx',
      'packages/app/src/buiOverrides.css',
      'packages/app/public/index.html',
      'packages/app/package.json',
      'packages/backend/package.json',
      'packages/backend/src/index.ts',
      'packages/backend/Dockerfile',
      'plugins/README.md',
      '.yarn/releases/yarn-4.4.1.cjs',
    ]) {
      expect(files).toContain(expected);
    }
  });

  it('pins every @openchoreo/* dependency to the CLI version and keeps no stray workspace ranges', async () => {
    const badPins: unknown[] = [];
    const strayWorkspaceRanges: unknown[] = [];
    for (const manifestPath of [
      'packages/app/package.json',
      'packages/backend/package.json',
    ]) {
      const manifest = await fs.readJson(joinPath(outputDir, manifestPath));
      for (const field of ['dependencies', 'devDependencies'] as const) {
        for (const [name, range] of Object.entries<string>(
          manifest[field] ?? {},
        )) {
          if (name.startsWith('@openchoreo/') && range !== `^${cliVersion}`) {
            badPins.push({ manifestPath, name, range });
          }
          if (
            name !== 'app' &&
            name !== 'backend' &&
            range.startsWith('workspace:')
          ) {
            strayWorkspaceRanges.push({ manifestPath, name, range });
          }
        }
      }
    }
    expect(badPins).toEqual([]);
    expect(strayWorkspaceRanges).toEqual([]);
  });

  it('strips the private assistant everywhere', async () => {
    const backendIndex = await fs.readFile(
      joinPath(outputDir, 'packages/backend/src/index.ts'),
      'utf8',
    );
    expect(backendIndex).not.toContain('portal-assistant');
    expect(backendIndex).not.toContain('portal-template:strip');
    expect(backendIndex).toContain('backend.add(portalBackendFeatures)');

    for (const file of files.filter(f => !f.startsWith('.yarn/'))) {
      const contents = await fs.readFile(joinPath(outputDir, file), 'utf8');
      expect({ file, clean: true }).toEqual({
        file,
        clean: !contents.includes(
          '@openchoreo/backstage-plugin-openchoreo-portal-assistant',
        ),
      });
    }
  });

  it('keeps Backstage scaffolder templates untouched by handlebars', async () => {
    const template = await fs.readFile(
      joinPath(
        outputDir,
        'templates/create-openchoreo-componenttype/template.yaml',
      ),
      'utf8',
    );
    // eslint-disable-next-line no-template-curly-in-string
    expect(template).toContain('${{');
    expect(files.filter(f => f.startsWith('templates/'))).not.toContainEqual(
      expect.stringMatching(/\.hbs$/),
    );
  });

  it('renders every .hbs file with the scaffold context', async () => {
    const hbsFiles = files.filter(f => f.endsWith('.hbs'));
    expect(hbsFiles.length).toBeGreaterThan(0);
    for (const file of hbsFiles) {
      const source = await fs.readFile(joinPath(outputDir, file), 'utf8');
      const render = () =>
        handlebars.compile(source, { strict: true })(SAMPLE_CONTEXT);
      expect(render).not.toThrow();
    }
  });

  it('renders a valid root package.json with the portal name and no release machinery', async () => {
    const source = await fs.readFile(
      joinPath(outputDir, 'package.json.hbs'),
      'utf8',
    );
    const manifest = JSON.parse(
      handlebars.compile(source, { strict: true })(SAMPLE_CONTEXT),
    );
    expect(manifest.name).toBe('test-portal');
    expect(manifest.workspaces.packages).toEqual(['packages/*', 'plugins/*']);
    expect(manifest.scripts['build-image']).toBeDefined();
    expect(manifest.scripts['release:publish']).toBeUndefined();
    expect(manifest.devDependencies['@changesets/cli']).toBeUndefined();
  });

  it('templates the registry knob and upgrade anchor', async () => {
    const yarnrc = handlebars.compile(
      await fs.readFile(joinPath(outputDir, '.yarnrc.yml.hbs'), 'utf8'),
      { strict: true },
    )(SAMPLE_CONTEXT);
    expect(yarnrc).toContain(
      "npmRegistryServer: 'https://registry.example.com'",
    );
    // npmjs needs no auth; private-registry users add their own token.
    expect(yarnrc).not.toContain('npmAuthToken');
    expect(yarnrc).not.toContain('GITHUB_TOKEN');

    const anchor = JSON.parse(
      handlebars.compile(
        await fs.readFile(
          joinPath(outputDir, '.openchoreo-portal.json.hbs'),
          'utf8',
        ),
        { strict: true },
      )(SAMPLE_CONTEXT),
    );
    expect(anchor).toEqual({
      template: 'openchoreo/portal-template',
      release: 'v9.9.9',
      createdWith: '@openchoreo/create-portal@9.9.9',
    });
  });

  it('ships the monorepo Dockerfile verbatim', async () => {
    const templateDockerfile = await fs.readFile(
      joinPath(outputDir, 'packages/backend/Dockerfile'),
      'utf8',
    );
    const monorepoDockerfile = await fs.readFile(
      joinPath(__dirname, '../../backend/Dockerfile'),
      'utf8',
    );
    expect(templateDockerfile).toBe(monorepoDockerfile);
  });
});
