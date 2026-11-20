import {
  resolvePackagePath,
  type DatabaseService,
} from '@backstage/backend-plugin-api';

type Knex = Awaited<ReturnType<DatabaseService['getClient']>>;

const PACKAGE =
  '@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks';

/** Seed migrations of the checks an OpenChoreo portal starts with. */
export const OPENCHOREO_STARTER_CHECKS_DIR = resolvePackagePath(
  PACKAGE,
  'starter-checks/openchoreo',
);

/**
 * Adds the OpenChoreo starter checks that this database hasn't been given
 * yet. Each seed file runs once per database, so a starter check that is
 * later edited, unpublished or deleted stays that way.
 *
 * The seed files keep their own ledger, apart from the schema migrations.
 * Turning the starter checks on later still seeds them, and turning them off
 * again leaves the schema ledger with no entry whose file knex can't find.
 * Call this after the schema migrations, which create the table it fills.
 */
export async function seedOpenChoreoStarterChecks(client: Knex): Promise<void> {
  await client.migrate.latest({
    directory: OPENCHOREO_STARTER_CHECKS_DIR,
    tableName: 'dynamic_checks_openchoreo_starter_migrations',
  });
}
