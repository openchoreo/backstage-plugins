import os from 'node:os';
import { exec } from 'node:child_process';
import { buildAppTask } from './tasks';

jest.mock('node:child_process', () => ({ exec: jest.fn() }));

type ExecCallback = (error: unknown, stdout?: string) => void;

describe('buildAppTask', () => {
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

  function execResults(failing?: string) {
    jest.mocked(exec).mockImplementation(((cmd: string, cb: ExecCallback) => {
      if (cmd === failing) {
        cb(Object.assign(new Error('boom'), { stderr: 'registry said no' }));
      } else {
        cb(null, '');
      }
    }) as unknown as typeof exec);
  }

  it('installs dependencies, then type-checks, inside the portal', async () => {
    execResults();

    await buildAppTask(os.tmpdir());

    expect(jest.mocked(exec).mock.calls.map(([cmd]) => cmd)).toEqual([
      'yarn install',
      'yarn tsc',
    ]);
  });

  it('explains how to recover when the install fails', async () => {
    execResults('yarn install');

    await expect(buildAppTask(os.tmpdir())).rejects.toThrow(
      /Could not execute command/,
    );
    expect(output).toContain('registry said no');
    expect(output).toContain('Dependency installation failed');
    expect(output).toContain('npmAuthToken');
    expect(jest.mocked(exec)).toHaveBeenCalledTimes(1);
  });
});
