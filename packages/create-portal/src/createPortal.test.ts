import fs from 'fs-extra';
import os from 'node:os';
import { join as joinPath } from 'node:path';
// eslint-disable-next-line @backstage/no-relative-monorepo-imports
import { version } from '../package.json';
import { exec } from 'node:child_process';
import { createPortal } from './createPortal';
import {
  Task,
  buildAppTask,
  checkYarnTask,
  commitLockfileTask,
  tryInitGitRepository,
} from './lib/tasks';

// Only the registry lookup (`npm config get`) shells out from createPortal;
// git and yarn go through the mocked tasks below.
jest.mock('node:child_process', () => ({ exec: jest.fn() }));

/** Stubs `npm config get <key>`; keys not listed print npm's `undefined`. */
function npmConfig(values: Record<string, string> | Error) {
  jest.mocked(exec).mockImplementation(((cmd: string, cb: Function) => {
    if (values instanceof Error) {
      cb(values);
    } else {
      const key = cmd.replace('npm config get ', '');
      cb(null, { stdout: `${values[key] ?? 'undefined'}\n`, stderr: '' });
    }
  }) as unknown as typeof exec);
}

jest.mock('./lib/tasks', () => ({
  ...jest.requireActual('./lib/tasks'),
  tryInitGitRepository: jest.fn().mockResolvedValue(false),
  buildAppTask: jest.fn().mockResolvedValue(undefined),
  checkYarnTask: jest.fn().mockResolvedValue(undefined),
  commitLockfileTask: jest.fn().mockResolvedValue(undefined),
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
    jest.mocked(checkYarnTask).mockClear();
    jest.mocked(commitLockfileTask).mockClear();
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
    expect(checkYarnTask).not.toHaveBeenCalled();
  });

  it('scaffolds into an explicit --path and takes the name from the environment', async () => {
    process.env.OPENCHOREO_PORTAL_NAME = 'env-portal';

    await createPortal({ ...baseOpts(), path: 'elsewhere' });

    expect(
      (await fs.readJson(joinPath(root, 'elsewhere/package.json'))).name,
    ).toBe('env-portal');
  });

  it('empties an explicit --path again when rendering fails', async () => {
    // Sorts after the files that render fine, so some are already written.
    await fs.outputFile(joinPath(templateDir, 'z-broken.hbs'), '{{missing}}');

    await createPortal({ ...baseOpts(), name: 'acme-portal', path: 'out' });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(await fs.readdir(joinPath(root, 'out'))).toEqual([]);
  });

  describe('without --registry', () => {
    const scaffoldRegistry = async () => {
      const { registry, ...opts } = baseOpts();
      await createPortal({ ...opts, name: 'acme-portal' });
      return (await fs.readJson(joinPath(root, 'acme-portal/package.json')))
        .registry;
    };

    it('uses the registry npm is configured to use for @openchoreo', async () => {
      npmConfig({
        '@openchoreo:registry': 'http://mirror.internal:4873/',
        registry: 'https://registry.npmjs.org/',
      });

      await expect(scaffoldRegistry()).resolves.toBe(
        'http://mirror.internal:4873',
      );
    });

    it("uses npm's registry when the scope has none (npm init --registry)", async () => {
      npmConfig({ registry: 'http://localhost:4873/' });

      await expect(scaffoldRegistry()).resolves.toBe('http://localhost:4873');
    });

    it('falls back to npmjs when npm has no registry configured', async () => {
      npmConfig({});

      await expect(scaffoldRegistry()).resolves.toBe(
        'https://registry.npmjs.org',
      );
    });

    it('falls back to npmjs when npm is unavailable', async () => {
      npmConfig(new Error('npm: command not found'));

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
    ['not-a-url', /Invalid --registry URL/],
    ['ftp://registry.example.com', /must be an http\(s\) URL/],
    ["https://registry.example.com/it's", /quotes or whitespace/],
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

  it('checks for Yarn, installs, and commits the lockfile unless --skip-install is passed', async () => {
    jest.mocked(tryInitGitRepository).mockResolvedValueOnce(true);

    await createPortal({
      ...baseOpts(),
      name: 'acme-portal',
      skipInstall: false,
    });

    const appDir = joinPath(root, 'acme-portal');
    expect(checkYarnTask).toHaveBeenCalled();
    expect(buildAppTask).toHaveBeenCalledWith(appDir);
    expect(commitLockfileTask).toHaveBeenCalledWith(appDir);
  });

  it('does not commit the lockfile when it created no repository', async () => {
    await createPortal({
      ...baseOpts(),
      name: 'acme-portal',
      skipInstall: false,
    });

    expect(commitLockfileTask).not.toHaveBeenCalled();
  });
});
