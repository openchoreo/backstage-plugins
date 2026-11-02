import {
  coreServices,
  createBackendModule,
  resolvePackagePath,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import {
  techInsightsFactCheckerFactoryExtensionPoint,
  type TechInsightCheckRegistry,
} from '@backstage-community/plugin-tech-insights-node';
import {
  JsonRulesEngineFactCheckerFactory,
  type TechInsightJsonRuleCheck,
} from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';
import { dynamicChecksPermissions } from '@openchoreo/backstage-plugin-tech-insights-dynamic-checks-common';
import { DynamicCheckRegistry } from './DynamicCheckRegistry';
import {
  EvaluableCheckRegistry,
  StaticCheckRegistry,
} from './EvaluableCheckRegistry';
import type { CheckEvaluation } from './dryRun';
import { createDynamicChecksRouter } from './router';
import { CheckValidator } from './validation';

const migrationsDir = resolvePackagePath(
  '@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks',
  'migrations',
);

export const techInsightsModuleDynamicChecks = createBackendModule({
  pluginId: 'tech-insights',
  moduleId: 'dynamic-checks',
  register(reg) {
    reg.registerInit({
      deps: {
        factCheckerFactory: techInsightsFactCheckerFactoryExtensionPoint,
        database: coreServices.database,
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        auth: coreServices.auth,
        permissions: coreServices.permissions,
        permissionsRegistry: coreServices.permissionsRegistry,
        scheduler: coreServices.scheduler,
        catalog: catalogServiceRef,
      },
      async init({
        factCheckerFactory,
        database,
        logger,
        httpRouter,
        httpAuth,
        auth,
        permissions,
        permissionsRegistry,
        scheduler,
        catalog,
      }) {
        permissionsRegistry.addPermissions(dynamicChecksPermissions);

        const client = await database.getClient();
        if (!database.migrations?.skip) {
          // A module sharing its host plugin's pluginId also shares that
          // plugin's database — including the default `knex_migrations`
          // ledger table. Running `migrate.latest()` against the shared
          // table with our own migrations directory corrupts the host
          // plugin's own migration validation (it cross-checks the ledger
          // against files in ITS directory and errors on unrecognized
          // entries). A distinct tableName keeps our migration history
          // separate within the same physical database.
          await client.migrate.latest({
            directory: migrationsDir,
            tableName: 'dynamic_checks_migrations',
          });
        }

        const registry = new DynamicCheckRegistry(client);

        // Published checks and dry runs are both evaluated by jsonfc's own
        // checker, so a dry run can't disagree with the published result.
        // tech-insights hands the fact store only to the factory, so the
        // dry-run route gets it, and a validator over it, from here.
        let evaluation: CheckEvaluation | undefined;
        factCheckerFactory.setFactCheckerFactory({
          construct(store) {
            const checkerOver = (
              checkRegistry: TechInsightCheckRegistry<TechInsightJsonRuleCheck>,
            ) =>
              new JsonRulesEngineFactCheckerFactory({
                checks: [],
                logger,
                checkRegistry,
                catalog,
                auth,
              }).construct(store);
            const validator = new CheckValidator(store);
            evaluation = {
              store,
              validator,
              checkerFor: checks =>
                checkerOver(new StaticCheckRegistry(checks)),
            };
            return checkerOver(
              new EvaluableCheckRegistry(registry, validator, logger),
            );
          },
        });

        httpRouter.use(
          await createDynamicChecksRouter({
            logger,
            registry,
            catalog,
            httpAuth,
            permissions,
            scheduler,
            getEvaluation: () => evaluation,
          }),
        );
      },
    });
  },
});
