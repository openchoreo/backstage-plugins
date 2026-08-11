/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Adapted from @backstage/create-app (packages/create-app/src/lib/tasks.ts).

import chalk from 'chalk';
import fs from 'fs-extra';
import handlebars from 'handlebars';
import {
  basename,
  dirname,
  join as joinPath,
  relative as relativePath,
  resolve as resolvePath,
} from 'node:path';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const TEN_MINUTES_MS = 1000 * 60 * 10;
const exec = promisify(execCb);

export class Task {
  static log(message: string = '') {
    process.stdout.write(`${message}\n`);
  }

  static error(message: string = '') {
    process.stdout.write(`\n${chalk.red(message)}\n\n`);
  }

  static section(name: string) {
    process.stdout.write(`\n ${chalk.green(`${name}:`)}\n`);
  }

  static exit(code: number = 0) {
    process.exit(code);
  }

  static async forItem(
    task: string,
    item: string,
    taskFunc: () => Promise<void>,
  ): Promise<void> {
    const prefix = `  ${chalk.green(task.padEnd(14))}${chalk.cyan(item)}`;
    try {
      await taskFunc();
      process.stdout.write(`${prefix} ${chalk.green('✔')}\n`);
    } catch (error) {
      process.stdout.write(`${prefix} ${chalk.red('✖')}\n`);
      throw error;
    }
  }
}

/** Recursively lists all files (not directories) under `dir`. */
export async function listFilesRecursively(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(entry => {
      const full = joinPath(dir, entry.name);
      return entry.isDirectory() ? listFilesRecursively(full) : [full];
    }),
  );
  return files.flat();
}

/**
 * Renders a template directory into `destinationDir`. Files ending in `.hbs`
 * are rendered through handlebars with `context` and written without the
 * suffix; everything else is byte-copied.
 */
export async function templatingTask(
  templateDir: string,
  destinationDir: string,
  context: Record<string, unknown>,
) {
  const files = await listFilesRecursively(templateDir).catch(error => {
    throw new Error(`Failed to read template directory: ${error.message}`);
  });

  for (const file of files) {
    const destinationFile = resolvePath(
      destinationDir,
      relativePath(templateDir, file),
    );
    await fs.ensureDir(dirname(destinationFile));

    if (file.endsWith('.hbs')) {
      await Task.forItem('templating', basename(file), async () => {
        const destination = destinationFile.replace(/\.hbs$/, '');
        const template = await fs.readFile(file);
        const compiled = handlebars.compile(template.toString(), {
          strict: true,
        });
        await fs.writeFile(destination, compiled(context)).catch(error => {
          throw new Error(
            `Failed to create file: ${destination}: ${error.message}`,
          );
        });
      });
    } else {
      await Task.forItem('copying', basename(file), async () => {
        await fs.copyFile(file, destinationFile).catch(error => {
          throw new Error(
            `Failed to copy file to ${destinationFile}: ${error.message}`,
          );
        });
      });
    }
  }

  // The shipped yarn binary must stay executable (fs.copyFile preserves the
  // mode, but npm pack does not for template payloads).
  const yarnReleases = resolvePath(destinationDir, '.yarn/releases');
  if (await fs.pathExists(yarnReleases)) {
    for (const file of await fs.readdir(yarnReleases)) {
      await fs.chmod(resolvePath(yarnReleases, file), 0o755);
    }
  }
}

/** Throws if `rootDir/name` already exists. */
export async function checkAppExistsTask(rootDir: string, name: string) {
  await Task.forItem('checking', name, async () => {
    const destination = resolvePath(rootDir, name);
    if (await fs.pathExists(destination)) {
      throw new Error(
        `A directory with the same name already exists: ${chalk.cyan(
          destination,
        )}\nPlease try again with a different portal name`,
      );
    }
  });
}

/** Ensures `path` exists as a directory. */
export async function checkPathExistsTask(path: string) {
  await Task.forItem('checking', path, async () => {
    await fs.mkdirs(path).catch(error => {
      throw new Error(`Failed to create portal directory: ${error.message}`);
    });
  });
}

/** Creates a scratch directory to render into before the final move. */
export async function createTemporaryPortalFolderTask(name: string) {
  return fs.mkdtemp(resolvePath(os.tmpdir(), name));
}

/** Moves the rendered scaffold from `tempDir` to `destination`. */
export async function moveAppTask(
  tempDir: string,
  destination: string,
  id: string,
) {
  await Task.forItem('moving', id, async () => {
    await fs
      .move(tempDir, destination)
      .catch(error => {
        throw new Error(
          `Failed to move portal from ${tempDir} to ${destination}: ${error.message}`,
        );
      })
      .finally(() => {
        fs.removeSync(tempDir);
      });
  });
}

/** Initializes a git repository in `dir` unless it is already inside one. */
export async function tryInitGitRepository(dir: string) {
  try {
    await exec('git rev-parse --is-inside-work-tree', { cwd: dir });
    return false;
  } catch {
    /* not a repo — proceed */
  }

  try {
    await exec('git init', { cwd: dir });
    await exec('git add .', { cwd: dir });
    await exec('git commit -m "Initial commit"', { cwd: dir });
    return true;
  } catch {
    await fs.rm(resolvePath(dir, '.git'), { recursive: true, force: true });
    return false;
  }
}

/**
 * Runs `yarn install` and `yarn tsc` in the scaffolded portal.
 */
export async function buildAppTask(appDir: string) {
  process.chdir(appDir);

  const runCmd = async (cmd: string) => {
    await Task.forItem('executing', cmd, async () => {
      await exec(cmd).catch(error => {
        process.stdout.write(error.stderr ?? '');
        process.stdout.write(error.stdout ?? '');
        throw new Error(`Could not execute command ${chalk.cyan(cmd)}`);
      });
    });
  };

  const installTimeout = setTimeout(() => {
    Task.error(
      "⏱️  It's taking a long time to install dependencies; you may want to exit (Ctrl-C) and run 'yarn install' and 'yarn tsc' manually",
    );
  }, TEN_MINUTES_MS);

  try {
    await runCmd('yarn install');
  } catch (error) {
    Task.error(
      [
        'Dependency installation failed. Check your network and registry',
        'access, then retry:',
        '',
        `  ${chalk.cyan(`cd ${appDir} && yarn install`)}`,
        '',
        'If the scaffold resolves @openchoreo/* from a private registry,',
        'add an npmAuthToken under npmScopes.openchoreo in .yarnrc.yml.',
      ].join('\n'),
    );
    throw error;
  } finally {
    clearTimeout(installTimeout);
  }
  await runCmd('yarn tsc');
}
