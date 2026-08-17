import chalk from 'chalk';
import { OptionValues } from 'commander';
import inquirer, { Answers } from 'inquirer';
import { resolve as resolvePath } from 'node:path';
import fs from 'fs-extra';
// eslint-disable-next-line @backstage/no-relative-monorepo-imports
import { version } from '../package.json';
import {
  Task,
  buildAppTask,
  checkAppExistsTask,
  checkPathExistsTask,
  createTemporaryPortalFolderTask,
  moveAppTask,
  templatingTask,
  tryInitGitRepository,
} from './lib/tasks';

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function resolveName(opts: OptionValues): Promise<string> {
  const preset = opts.name ?? process.env.OPENCHOREO_PORTAL_NAME;
  if (preset) {
    if (!NAME_PATTERN.test(preset)) {
      throw new Error(
        'Portal name must be lowercase and contain only letters, digits, and dashes',
      );
    }
    return preset;
  }

  const answers: Answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      default: 'openchoreo-portal',
      message: chalk.blue('Enter a name for the portal [required]'),
      validate: (value: string) => {
        if (!value) {
          return chalk.red('Please enter a name for the portal');
        } else if (!NAME_PATTERN.test(value)) {
          return chalk.red(
            'Portal name must be lowercase and contain only letters, digits, and dashes.',
          );
        }
        return true;
      },
    },
  ]);
  return answers.name;
}

export async function createPortal(opts: OptionValues): Promise<void> {
  const name = await resolveName(opts);

  // Resolves from both src/ (repo run, via the bin shim's TS transform) and
  // dist/ (installed package) — the templates directory sits beside either.
  // eslint-disable-next-line no-restricted-syntax
  const builtInTemplate = resolvePath(__dirname, '../templates/default-portal');
  const templateDir = opts.templatePath
    ? resolvePath(process.cwd(), opts.templatePath)
    : builtInTemplate;

  if (!(await fs.pathExists(templateDir))) {
    const hint = opts.templatePath
      ? ''
      : ' When running from the backstage-plugins repo, generate it first with `yarn workspace @openchoreo/create-portal generate-template`.';
    throw new Error(`Portal template not found at ${templateDir}.${hint}`);
  }

  const appDir = opts.path
    ? resolvePath(process.cwd(), opts.path)
    : resolvePath(process.cwd(), name);

  // Rendered into the .hbs template files. `version` pins the scaffold to
  // this CLI's release: all @openchoreo/* packages version in lockstep, so
  // one number identifies the whole release.
  const context = {
    name,
    version,
    registry: opts.registry,
  };

  Task.log();
  Task.log(`Creating your custom OpenChoreo Portal (release ${version})…`);

  try {
    if (opts.path) {
      Task.section('Checking that supplied path exists');
      await checkPathExistsTask(appDir);

      Task.section('Preparing files');
      await templatingTask(templateDir, appDir, context);
    } else {
      Task.section('Checking if the directory is available');
      await checkAppExistsTask(process.cwd(), name);

      Task.section('Creating a temporary portal directory');
      const tempDir = await createTemporaryPortalFolderTask(name);

      Task.section('Preparing files');
      await templatingTask(templateDir, tempDir, context);

      Task.section('Moving to final location');
      await moveAppTask(tempDir, appDir, name);
    }

    // Seed the local dev config so `yarn start` works immediately; the
    // example documents every environment variable it expects.
    const localConfigExample = resolvePath(
      appDir,
      'app-config.local.yaml.example',
    );
    if (await fs.pathExists(localConfigExample)) {
      await Task.forItem('creating', 'app-config.local.yaml', async () => {
        await fs.copyFile(
          localConfigExample,
          resolvePath(appDir, 'app-config.local.yaml'),
        );
      });
    }

    if (await tryInitGitRepository(appDir)) {
      await Task.forItem('init', 'git repository', async () => {});
    }

    if (!opts.skipInstall) {
      Task.section('Installing dependencies');
      await buildAppTask(appDir);
    }

    Task.log();
    Task.log(chalk.green(`🥇  Successfully created ${chalk.cyan(name)}`));

    Task.section('All set! Now you might want to');
    if (opts.skipInstall) {
      Task.log(
        `  Install the dependencies: ${chalk.cyan(
          `cd ${opts.path ?? name} && yarn install`,
        )}`,
      );
    }
    Task.log(
      `  Run the portal: ${chalk.cyan(
        `cd ${opts.path ?? name} && yarn start`,
      )}`,
    );
    Task.log(
      `  Read the scaffold README for configuration, Docker builds, and upgrades`,
    );
    Task.log();
    Task.exit();
  } catch (error) {
    Task.error(String(error));
    Task.error('🔥  Failed to create portal!');
    Task.exit(1);
  }
}
