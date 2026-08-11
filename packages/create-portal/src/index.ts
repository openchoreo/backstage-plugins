/**
 * A CLI that scaffolds a custom OpenChoreo Portal.
 *
 * @packageDocumentation
 */

import { program } from 'commander';
// eslint-disable-next-line @backstage/no-relative-monorepo-imports
import { version } from '../package.json';
import { createPortal } from './createPortal';
import { exitWithError } from './lib/errors';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

const main = (argv: string[]) => {
  program
    .name('create-portal')
    .version(version)
    .description(
      'Scaffolds a custom OpenChoreo Portal pinned to one portal release',
    )
    .option(
      '--name <name>',
      'Portal name (lowercase letters, digits, dashes); skips the prompt',
    )
    .option(
      '--path <directory>',
      'Location to store the portal, defaulting to a new folder with the portal name',
    )
    .option(
      '--registry <url>',
      `npm registry the scaffold resolves @openchoreo/* packages from (default: ${DEFAULT_REGISTRY})`,
      DEFAULT_REGISTRY,
    )
    .option(
      '--skip-install',
      'Skip the install and type-check steps after scaffolding',
    )
    .option(
      '--template-path <directory>',
      'Use an external portal template instead of the built-in one',
    )
    .action(cmd => createPortal(cmd));

  program.parse(argv);
};

process.on('unhandledRejection', rejection => {
  if (rejection instanceof Error) {
    exitWithError(rejection);
  } else {
    exitWithError(new Error(`Unknown rejection: '${rejection}'`));
  }
});

main(process.argv);
