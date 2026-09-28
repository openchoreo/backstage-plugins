import fs from 'fs-extra';
import os from 'node:os';
import { join as joinPath } from 'node:path';
import { exec } from 'node:child_process';
import { buildAppTask, tryInitGitRepository } from './tasks';

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

      await buildAppTask(os.tmpdir());

      expect(execCommands()).toEqual(['yarn install', 'yarn tsc']);
    });

    it('explains how to recover when the install fails', async () => {
      execResults('yarn install');

      await expect(buildAppTask(os.tmpdir())).rejects.toThrow(
        /Could not execute command/,
      );
      expect(output).toContain('registry said no');
      expect(output).toContain('Dependency installation failed');
      expect(output).toContain('npmAuthToken');
      expect(execCommands()).toEqual(['yarn install']);
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

    it('removes a half-created repository when the commit fails', async () => {
      // e.g. no git identity configured: init succeeds, commit does not.
      jest.mocked(exec).mockImplementation(((
        cmd: string,
        ...rest: unknown[]
      ) => {
        const cb = rest[rest.length - 1] as ExecCallback;
        if (cmd === 'git init') fs.mkdirpSync(joinPath(dir, '.git'));
        cb(
          cmd.startsWith('git rev-parse') || cmd.startsWith('git commit')
            ? new Error('no')
            : null,
          '',
        );
      }) as unknown as typeof exec);

      await expect(tryInitGitRepository(dir)).resolves.toBe(false);
      expect(await fs.pathExists(joinPath(dir, '.git'))).toBe(false);
    });
  });
});
