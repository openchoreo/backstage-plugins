import fs from 'fs-extra';
import os from 'node:os';
import { join as joinPath } from 'node:path';
// eslint-disable-next-line @backstage/no-relative-monorepo-imports
import { version } from '../package.json';
import { exec } from 'node:child_process';
import { createPortal } from './createPortal';
import { Task, buildAppTask } from './lib/tasks';

// Only the registry lookup (`npm config get`) shells out from createPortal;
// git and yarn go through the mocked tasks below.
jest.mock('node:child_process', () => ({ exec: jest.fn() }));

function npmConfiguredRegistry(value: string | Error) {
  jest.mocked(exec).mockImplementation(((_cmd: string, cb: Function) => {
    if (value instanceof Error) {
      cb(value);
    } else {
      cb(null, { stdout: `${value}\n`, stderr: '' });
    }
  }) as unknown as typeof exec);
}

jest.mock('./lib/tasks', () => ({
  ...jest.requireActual('./lib/tasks'),
  tryInitGitRepository: jest.fn().mockResolvedValue(false),
  buildAppTask: jest.fn().mockResolvedValue(undefined),
}));

describe('createPortal', () => {
  let root: string;
  let templateDir: string;
  let cwd: string;
  let exitSpy: jest.SpyInstance;

  beforeEach(async () => {
    // realpath: macOS tmpdir is a symlink, and process.cwd() resolves it.
    root = await fs.realpath(
      await fs.mkdtemp(joinPath(os.tmpdir(), 'create-portal-')),
    );
    templateDir = joinPath(root, 'template');
    await fs.outputFile(
      joinPath(templateDir, 'package.json.hbs'),
      '{"name":"{{name}}","registry":"{{registry}}","release":"{{version}}","httpHost":"{{unsafeHttpHost}}"}',
    );
    await fs.outputFile(
      joinPath(templateDir, 'app-config.local.yaml.example'),
      'app: {}\n',
    );
    cwd = process.cwd();
    process.chdir(root);
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitSpy = jest
      .spyOn(Task, 'exit')
      .mockImplementation(() => undefined as never);
  });

  afterEach(async () => {
    process.chdir(cwd);
    jest.restoreAllMocks();
    jest.mocked(buildAppTask).mockClear();
    jest.mocked(exec).mockReset();
    delete process.env.OPENCHOREO_PORTAL_NAME;
    await fs.rm(root, { recursive: true, force: true });
  });

  const baseOpts = () => ({
    templatePath: templateDir,
    registry: 'https://registry.example.com',
    skipInstall: true,
  });

  it('scaffolds into ./<name> with the release pinned and local config seeded', async () => {
    await createPortal({ ...baseOpts(), name: 'acme-portal' });

    const appDir = joinPath(root, 'acme-portal');
    expect(await fs.readJson(joinPath(appDir, 'package.json'))).toEqual({
      name: 'acme-portal',
      registry: 'https://registry.example.com',
      release: version,
      httpHost: '',
    });
    expect(
      await fs.readFile(joinPath(appDir, 'app-config.local.yaml'), 'utf8'),
    ).toBe('app: {}\n');
    expect(exitSpy).toHaveBeenCalledWith();
    expect(buildAppTask).not.toHaveBeenCalled();
  });

  it('scaffolds into an explicit --path and takes the name from the environment', async () => {
    process.env.OPENCHOREO_PORTAL_NAME = 'env-portal';

    await createPortal({ ...baseOpts(), path: 'elsewhere' });

    expect(
      (await fs.readJson(joinPath(root, 'elsewhere/package.json'))).name,
    ).toBe('env-portal');
  });

  describe('without --registry', () => {
    const scaffoldRegistry = async () => {
      const { registry, ...opts } = baseOpts();
      await createPortal({ ...opts, name: 'acme-portal' });
      return (await fs.readJson(joinPath(root, 'acme-portal/package.json')))
        .registry;
    };

    it('uses the registry npm is configured to use for @openchoreo', async () => {
      npmConfiguredRegistry('http://mirror.internal:4873/');

      await expect(scaffoldRegistry()).resolves.toBe(
        'http://mirror.internal:4873',
      );
    });

    it('falls back to npmjs when the scope has no registry configured', async () => {
      npmConfiguredRegistry('undefined');

      await expect(scaffoldRegistry()).resolves.toBe(
        'https://registry.npmjs.org',
      );
    });

    it('falls back to npmjs when npm is unavailable', async () => {
      npmConfiguredRegistry(new Error('npm: command not found'));

      await expect(scaffoldRegistry()).resolves.toBe(
        'https://registry.npmjs.org',
      );
    });
  });

  it('does not consult npm when --registry is given', async () => {
    await createPortal({ ...baseOpts(), name: 'acme-portal' });

    expect(exec).not.toHaveBeenCalled();
  });

  it('whitelists the host of a plain-http registry', async () => {
    await createPortal({
      ...baseOpts(),
      name: 'acme-portal',
      registry: 'http://localhost:4873',
    });

    expect(
      (await fs.readJson(joinPath(root, 'acme-portal/package.json'))).httpHost,
    ).toBe('localhost');
  });

  it.each([
    ['not a url', /Invalid --registry URL/],
    ['ftp://registry.example.com', /must be an http\(s\) URL/],
  ])('rejects the registry %s', async (registry, message) => {
    await expect(
      createPortal({ ...baseOpts(), name: 'acme-portal', registry }),
    ).rejects.toThrow(message);
  });

  it('rejects an invalid portal name before touching the disk', async () => {
    await expect(
      createPortal({ ...baseOpts(), name: 'Not Valid' }),
    ).rejects.toThrow(/lowercase/);
    expect(await fs.readdir(root)).toEqual(['template']);
  });

  it('fails with a hint when the template directory is missing', async () => {
    await expect(
      createPortal({
        ...baseOpts(),
        name: 'acme-portal',
        templatePath: 'missing',
      }),
    ).rejects.toThrow(/Portal template not found/);
  });

  it('exits non-zero when the target directory already exists', async () => {
    await fs.mkdirp(joinPath(root, 'acme-portal'));

    await createPortal({ ...baseOpts(), name: 'acme-portal' });

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('installs and type-checks unless --skip-install is passed', async () => {
    await createPortal({
      ...baseOpts(),
      name: 'acme-portal',
      skipInstall: false,
    });

    expect(buildAppTask).toHaveBeenCalledWith(joinPath(root, 'acme-portal'));
  });
});
