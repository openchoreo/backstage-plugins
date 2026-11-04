import fs from 'fs-extra';
import os from 'node:os';
import { join as joinPath } from 'node:path';
import { exec } from 'node:child_process';
import {
  buildAppTask,
  checkYarnTask,
  commitLockfileTask,
  tryInitGitRepository,
} from './tasks';

// The tasks shell out through `exec`; mocking it keeps these tests independent
// of the host's git/yarn setup (identity, global config, CI sandboxing).
jest.mock('node:child_process', () => ({ exec: jest.fn() }));

type ExecCallback = (error: unknown, stdout?: string) => void;

/** Makes every `exec` call succeed except `failing`, which errors. */
function execResults(failing?: string) {
  jest.mocked(exec).mockImplementation(((cmd: string, ...rest: unknown[]) => {
    const cb = rest[rest.length - 1] as ExecCallback;
    if (cmd === failing) {
      cb(Object.assign(new Error('boom'), { stderr: 'registry said no' }));
    } else {
      cb(null, '');
    }
  }) as unknown as typeof exec);
}

const execCommands = () => jest.mocked(exec).mock.calls.map(([cmd]) => cmd);

describe('exec-backed tasks', () => {
  const cwd = process.cwd();
  let output: string;

  beforeEach(() => {
    output = '';
    jest.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      output += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    process.chdir(cwd);
    jest.restoreAllMocks();
    jest.mocked(exec).mockReset();
  });

  describe('buildAppTask', () => {
    it('installs dependencies, then type-checks, inside the portal', async () => {
      execResults();
      const chdir = jest.spyOn(process, 'chdir');

      await buildAppTask(os.tmpdir());

      expect(chdir).toHaveBeenCalledWith(os.tmpdir());
      expect(execCommands()).toEqual(['yarn install', 'yarn tsc']);
    });

    it('explains how to recover when the install fails', async () => {
      execResults('yarn install');

      await expect(buildAppTask(os.tmpdir())).rejects.toThrow(
        /Could not execute command/,
      );
      expect(output).toContain('registry said no');
      expect(output).toContain('the output above shows why');
      expect(output).toContain('npmAuthToken');
      expect(execCommands()).toEqual(['yarn install']);
    });
  });

  describe('checkYarnTask', () => {
    it('passes when yarn runs', async () => {
      execResults();

      await expect(checkYarnTask()).resolves.toBeUndefined();
      expect(execCommands()).toEqual(['yarn --version']);
    });

    it('explains how to get yarn when it is missing', async () => {
      execResults('yarn --version');

      await expect(checkYarnTask()).rejects.toThrow(/corepack enable/);
    });
  });

  describe('commitLockfileTask', () => {
    it('commits yarn.lock when the install changed it', async () => {
      execResults('git diff --quiet -- yarn.lock');

      await commitLockfileTask(os.tmpdir());

      expect(execCommands()).toEqual([
        'git diff --quiet -- yarn.lock',
        'git add yarn.lock',
        'git commit -m "chore: lock dependencies"',
      ]);
    });

    it('does nothing when yarn.lock is unchanged', async () => {
      execResults();

      await commitLockfileTask(os.tmpdir());

      expect(execCommands()).toEqual(['git diff --quiet -- yarn.lock']);
    });

    it('asks the user to commit it when the commit fails', async () => {
      jest.mocked(exec).mockImplementation(((
        cmd: string,
        ...rest: unknown[]
      ) => {
        const cb = rest[rest.length - 1] as ExecCallback;
        cb(cmd.startsWith('git add') ? null : new Error('no'), '');
      }) as unknown as typeof exec);

      await expect(commitLockfileTask(os.tmpdir())).resolves.toBeUndefined();
      expect(output).toContain('commit it yourself');
    });
  });

  describe('tryInitGitRepository', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(joinPath(os.tmpdir(), 'create-portal-git-'));
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('initializes a repository with an initial commit', async () => {
      execResults('git rev-parse --is-inside-work-tree');

      await expect(tryInitGitRepository(dir)).resolves.toBe(true);
      expect(execCommands()).toEqual([
        'git rev-parse --is-inside-work-tree',
        'git init',
        'git add .',
        'git commit -m "Initial commit"',
      ]);
    });

    it('leaves a directory that is already inside a repository alone', async () => {
      execResults();

      await expect(tryInitGitRepository(dir)).resolves.toBe(false);
      expect(execCommands()).toEqual(['git rev-parse --is-inside-work-tree']);
    });

    it('removes a half-created repository and says why when the commit fails', async () => {
      // e.g. no git identity configured: init succeeds, commit does not.
      jest.mocked(exec).mockImplementation(((
        cmd: string,
        ...rest: unknown[]
      ) => {
        const cb = rest[rest.length - 1] as ExecCallback;
        if (cmd === 'git init') fs.mkdirpSync(joinPath(dir, '.git'));
        if (cmd.startsWith('git commit')) {
          cb(
            Object.assign(new Error('no'), {
              stderr: 'fatal: unable to auto-detect email address',
            }),
          );
        } else {
          cb(cmd.startsWith('git rev-parse') ? new Error('no') : null, '');
        }
      }) as unknown as typeof exec);

      await expect(tryInitGitRepository(dir)).resolves.toBe(false);
      expect(await fs.pathExists(joinPath(dir, '.git'))).toBe(false);
      expect(output).toContain('Could not create the initial git commit');
      expect(output).toContain('fatal: unable to auto-detect email address');
    });
  });
});
