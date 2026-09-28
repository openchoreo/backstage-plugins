import chalk from 'chalk';

export function exitWithError(error: Error): never {
  process.stderr.write(`\n${chalk.red(String(error))}\n\n`);
  process.exit(1);
}
