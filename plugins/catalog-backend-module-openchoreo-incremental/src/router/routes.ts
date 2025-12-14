/*
 * Copyright 2022 The Backstage Authors
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

/**
 * Router for incremental provider management endpoints.
 * Provides REST API endpoints for monitoring and controlling incremental ingestion processes.
 */

import express from 'express';
import Router from 'express-promise-router';
import { OpenChoreoIncrementalIngestionDatabaseManager } from '../database/OpenChoreoIncrementalIngestionDatabaseManager';
import { LoggerService } from '@backstage/backend-plugin-api';

const POST_CANCEL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export class IncrementalProviderRouter {
  private manager: OpenChoreoIncrementalIngestionDatabaseManager;
  private logger: LoggerService;

  constructor(
    manager: OpenChoreoIncrementalIngestionDatabaseManager,
    logger: LoggerService,
  ) {
    this.manager = manager;
    this.logger = logger;
  }

  createRouter(): express.Router {
    const router = Router();
    router.use(express.json());

    router.get('/incremental/health', async (_, res) => {
      const records = await this.manager.healthcheck();
      const providers = records.map(record => record.provider_name);
      const duplicates = [
        ...new Set(providers.filter((e, i, a) => a.indexOf(e) !== i)),
      ];

      if (duplicates.length > 0) {
        res.json({
          success: false,
          data: { healthy: false, duplicateIngestions: duplicates },
          error: 'Duplicate ingestions detected',
        });
      } else {
        res.json({ success: true, data: { healthy: true } });
      }
    });

    router.post('/incremental/cleanup', async (_, res) => {
      const result = await this.manager.cleanupProviders();
      res.json({ success: true, data: result });
    });

    router.get('/incremental/providers/:provider', async (req, res) => {
      const { provider } = req.params;
      const record = await this.manager.getCurrentIngestionRecord(provider);
      if (record) {
        res.json({
          success: true,
          data: {
            status: {
              current_action: record.status,
              next_action_at: new Date(record.next_action_at),
            },
            last_error: record.last_error,
          },
        });
      } else {
        const providers: string[] = await this.manager.listProviders();
        if (providers.includes(provider)) {
          res.json({
            success: true,
            data: {
              status: {
                current_action: 'rest complete, waiting to start',
              },
            },
          });
        } else {
          this.logger.error(
            `${provider} - No ingestion record found in the database!`,
          );
          res.status(404).json({
            success: false,
            error: `Provider '${provider}' not found`,
          });
        }
      }
    });

    router.post(
      `/incremental/providers/:provider/trigger`,
      async (req, res) => {
        const { provider } = req.params;
        const record = await this.manager.getCurrentIngestionRecord(provider);
        if (record) {
          await this.manager.triggerNextProviderAction(provider);
          res.json({
            success: true,
            data: { message: `${provider}: Next action triggered.` },
          });
        } else {
          const providers: string[] = await this.manager.listProviders();
          if (providers.includes(provider)) {
            this.logger.debug(
              `${provider} - No ingestion record, provider is restarting`,
            );
            res.json({
              success: true,
              data: {
                message:
                  'Unable to trigger next action (provider is restarting)',
              },
            });
          } else {
            res.status(404).json({
              success: false,
              error: `Provider '${provider}' not found`,
            });
          }
        }
      },
    );

    router.post(`/incremental/providers/:provider/start`, async (req, res) => {
      const { provider } = req.params;

      const record = await this.manager.getCurrentIngestionRecord(provider);
      if (record) {
        const ingestionId = record.id;
        if (record.status === 'resting') {
          await this.manager.setProviderComplete(ingestionId);
        } else {
          await this.manager.setProviderCanceling(ingestionId);
        }
        res.json({
          success: true,
          data: { message: `${provider}: Next cycle triggered.` },
        });
      } else {
        const providers: string[] = await this.manager.listProviders();
        if (providers.includes(provider)) {
          this.logger.debug(
            `${provider} - No ingestion record, provider is already restarting`,
          );
          res.json({
            success: true,
            data: { message: 'Provider is already restarting' },
          });
        } else {
          res.status(404).json({
            success: false,
            error: `Provider '${provider}' not found`,
          });
        }
      }
    });

    router.get(`/incremental/providers`, async (_req, res) => {
      const providers = await this.manager.listProviders();

      res.json({
        success: true,
        data: { providers },
      });
    });

    router.post(`/incremental/providers/:provider/cancel`, async (req, res) => {
      const { provider } = req.params;
      const record = await this.manager.getCurrentIngestionRecord(provider);
      if (record) {
        const next_action_at = new Date();
        next_action_at.setTime(
          next_action_at.getTime() + POST_CANCEL_COOLDOWN_MS,
        );
        await this.manager.updateByName(provider, {
          next_action: 'nothing (done)',
          ingestion_completed_at: new Date(),
          next_action_at,
          status: 'resting',
        });
        res.json({
          success: true,
          data: { message: `${provider}: Current ingestion canceled.` },
        });
      } else {
        const providers: string[] = await this.manager.listProviders();
        if (providers.includes(provider)) {
          this.logger.debug(
            `${provider} - No ingestion record, provider is restarting`,
          );
          res.json({
            success: true,
            data: { message: 'Provider is currently restarting, please wait.' },
          });
        } else {
          res.status(404).json({
            success: false,
            error: `Provider '${provider}' not found`,
          });
        }
      }
    });

    router.delete('/incremental/providers/:provider', async (req, res) => {
      const { provider } = req.params;
      const result = await this.manager.purgeAndResetProvider(provider);
      res.json({ success: true, data: result });
    });

    router.get(`/incremental/providers/:provider/marks`, async (req, res) => {
      const { provider } = req.params;
      const record = await this.manager.getCurrentIngestionRecord(provider);
      if (record) {
        const id = record.id;
        const records = await this.manager.getAllMarks(id);
        res.json({ success: true, data: { records } });
      } else {
        const providers: string[] = await this.manager.listProviders();
        if (providers.includes(provider)) {
          this.logger.debug(
            `${provider} - No ingestion record, provider is restarting`,
          );
          res.json({
            success: true,
            data: { message: 'No records yet (provider is restarting)' },
          });
        } else {
          this.logger.error(
            `${provider} - No ingestion record found in the database!`,
          );
          res.status(404).json({
            success: false,
            error: `Provider '${provider}' not found`,
          });
        }
      }
    });

    router.delete(
      `/incremental/providers/:provider/marks`,
      async (req, res) => {
        const { provider } = req.params;
        const deletions = await this.manager.clearFinishedIngestions(provider);

        res.json({
          success: true,
          data: {
            message: `Expired marks for provider '${provider}' removed.`,
            deletions,
          },
        });
      },
    );

    return router;
  }
}
