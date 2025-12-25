/**
 * Backend module for OpenChoreo incremental provider.
 * Registers the OpenChoreoIncrementalEntityProvider with the extension point,
 * configuring it with burst and rest intervals from the application config.
 */

import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { openchoreoIncrementalProvidersExtensionPoint } from './catalogModuleIncrementalIngestionEntityProvider';
import { OpenChoreoIncrementalEntityProvider } from '../providers/OpenChoreoIncrementalEntityProvider';

export const catalogModuleOpenchoreoIncrementalProvider = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'openchoreo-incremental-provider',
  register(env) {
    env.registerInit({
      deps: {
        extension: openchoreoIncrementalProvidersExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ extension, config, logger }) {
        const provider = new OpenChoreoIncrementalEntityProvider(
          config,
          logger,
        );

        extension.addProvider({
          provider,
          options: {
            // The interval between bursts of processing activity
            burstInterval: {
              seconds: Math.max(
                1,
                config.getOptionalNumber(
                  'openchoreo.incremental.burstInterval',
                ) || 30,
              ),
            },
            // The duration of each burst of processing activity
            burstLength: {
              seconds: Math.max(
                1,
                config.getOptionalNumber(
                  'openchoreo.incremental.burstLength',
                ) || 10,
              ),
            },
            // The duration of rest periods between bursts
            restLength: {
              minutes: Math.max(
                1,
                config.getOptionalNumber('openchoreo.incremental.restLength') ||
                  30,
              ),
            },
            // Backoff intervals for retry attempts (configurable array of durations in seconds)
            backoff: (() => {
              const backoffConfig = config.getOptional(
                'openchoreo.incremental.backoff',
              );
              if (
                Array.isArray(backoffConfig) &&
                backoffConfig.every(
                  (item): item is number =>
                    typeof item === 'number' && item > 0,
                )
              ) {
                return backoffConfig.map((seconds: number) => ({
                  seconds: Math.max(1, seconds),
                }));
              }
              return [
                { seconds: 30 },
                { minutes: 1 },
                { minutes: 5 },
                { minutes: 30 },
              ];
            })(),
          },
        });
      },
    });
  },
});
