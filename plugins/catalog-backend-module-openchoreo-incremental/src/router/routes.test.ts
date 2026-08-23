/*
 * Copyright 2023 The Backstage Authors
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
 * Test suite for the incremental provider admin router.
 * Drives the produced express router through supertest with a fully stubbed
 * database manager, covering success payloads, unknown-provider 404s, and
 * the error-handling path.
 */
import { mockErrorHandler } from '@backstage/backend-test-utils';
import type { LoggerService } from '@backstage/backend-plugin-api';
import express from 'express';
import request from 'supertest';
import type { OpenChoreoIncrementalIngestionDatabaseManager } from '../database/OpenChoreoIncrementalIngestionDatabaseManager';
import type { IngestionRecord } from '../database/tables';
import { IncrementalProviderRouter } from './routes';

function createMockManager() {
  return {
    healthcheck: jest.fn(),
    cleanupProviders: jest.fn(),
    getCurrentIngestionRecord: jest.fn(),
    listProviders: jest.fn(),
    triggerNextProviderAction: jest.fn(),
    setProviderComplete: jest.fn(),
    setProviderCanceling: jest.fn(),
    updateByName: jest.fn(),
    purgeAndResetProvider: jest.fn(),
    getAllMarks: jest.fn(),
    clearFinishedIngestions: jest.fn(),
  };
}

function makeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  } as unknown as LoggerService;
}

function makeRecord(overrides: Partial<IngestionRecord> = {}): IngestionRecord {
  return {
    id: 'ingestion-1',
    provider_name: 'myProvider',
    status: 'bursting',
    next_action: 'ingest',
    next_action_at: new Date('2023-06-01T12:00:00.000Z'),
    last_error: 'previous burst failed',
    attempts: 1,
    created_at: '2023-06-01T11:00:00.000Z',
    ingestion_completed_at: null,
    rest_completed_at: null,
    completion_ticket: 'open',
    ...overrides,
  };
}

describe('IncrementalProviderRouter', () => {
  let app: express.Express;
  let manager: ReturnType<typeof createMockManager>;
  let logger: LoggerService;

  beforeEach(() => {
    manager = createMockManager();
    logger = makeLogger();
    const router = new IncrementalProviderRouter(
      manager as unknown as OpenChoreoIncrementalIngestionDatabaseManager,
      logger,
    ).createRouter();
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  describe('GET /incremental/health', () => {
    it('reports healthy when there are no duplicate active ingestions', async () => {
      manager.healthcheck.mockResolvedValue([
        { id: 'ingestion-1', provider_name: 'myProvider' },
      ]);

      const res = await request(app).get('/incremental/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { healthy: true } });
      expect(manager.healthcheck).toHaveBeenCalledTimes(1);
    });

    it('reports the duplicated providers when duplicates exist', async () => {
      manager.healthcheck.mockResolvedValue([
        { id: 'ingestion-1', provider_name: 'myProvider' },
        { id: 'ingestion-2', provider_name: 'myProvider' },
      ]);

      const res = await request(app).get('/incremental/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: false,
        data: { healthy: false, duplicateIngestions: ['myProvider'] },
        error: 'Duplicate ingestions detected',
      });
    });

    it('surfaces manager failures as 500 responses', async () => {
      manager.healthcheck.mockRejectedValue(new Error('db down'));

      const res = await request(app).get('/incremental/health');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /incremental/cleanup', () => {
    it('returns the cleanup results', async () => {
      manager.cleanupProviders.mockResolvedValue({
        ingestionsDeleted: 3,
        ingestionMarksDeleted: 7,
        markEntitiesDeleted: 42,
      });

      const res = await request(app).post('/incremental/cleanup');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          ingestionsDeleted: 3,
          ingestionMarksDeleted: 7,
          markEntitiesDeleted: 42,
        },
      });
      expect(manager.cleanupProviders).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /incremental/providers', () => {
    it('lists all known providers', async () => {
      manager.listProviders.mockResolvedValue(['myProvider', 'otherProvider']);

      const res = await request(app).get('/incremental/providers');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { providers: ['myProvider', 'otherProvider'] },
      });
    });
  });

  describe('GET /incremental/providers/:provider', () => {
    it('returns the current status for a provider with an open ingestion', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(makeRecord());

      const res = await request(app).get('/incremental/providers/myProvider');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          status: {
            current_action: 'bursting',
            next_action_at: '2023-06-01T12:00:00.000Z',
          },
          last_error: 'previous burst failed',
        },
      });
    });

    it('reports a rest-complete provider that has no open ingestion', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(undefined);
      manager.listProviders.mockResolvedValue(['myProvider']);

      const res = await request(app).get('/incremental/providers/myProvider');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          status: { current_action: 'rest complete, waiting to start' },
        },
      });
    });

    it('returns 404 for an unknown provider', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(undefined);
      manager.listProviders.mockResolvedValue(['myProvider']);

      const res = await request(app).get('/incremental/providers/nope');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        error: "Provider 'nope' not found",
      });
      expect(logger.error).toHaveBeenCalledWith(
        'nope - No ingestion record found in the database!',
      );
    });
  });

  describe('POST /incremental/providers/:provider/trigger', () => {
    it('triggers the next action for a provider with an open ingestion', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(makeRecord());

      const res = await request(app).post(
        '/incremental/providers/myProvider/trigger',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { message: 'myProvider: Next action triggered.' },
      });
      expect(manager.triggerNextProviderAction).toHaveBeenCalledWith(
        'myProvider',
      );
    });

    it('declines to trigger a restarting provider', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(undefined);
      manager.listProviders.mockResolvedValue(['myProvider']);

      const res = await request(app).post(
        '/incremental/providers/myProvider/trigger',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          message: 'Unable to trigger next action (provider is restarting)',
        },
      });
      expect(manager.triggerNextProviderAction).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown provider', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(undefined);
      manager.listProviders.mockResolvedValue([]);

      const res = await request(app).post(
        '/incremental/providers/nope/trigger',
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Provider 'nope' not found");
    });
  });

  describe('POST /incremental/providers/:provider/start', () => {
    it('completes a resting ingestion to start the next cycle', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(
        makeRecord({ status: 'resting' }),
      );

      const res = await request(app).post(
        '/incremental/providers/myProvider/start',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { message: 'myProvider: Next cycle triggered.' },
      });
      expect(manager.setProviderComplete).toHaveBeenCalledWith('ingestion-1');
      expect(manager.setProviderCanceling).not.toHaveBeenCalled();
    });

    it('cancels a non-resting ingestion to start the next cycle', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(makeRecord());

      const res = await request(app).post(
        '/incremental/providers/myProvider/start',
      );

      expect(res.status).toBe(200);
      expect(manager.setProviderCanceling).toHaveBeenCalledWith('ingestion-1');
      expect(manager.setProviderComplete).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown provider', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(undefined);
      manager.listProviders.mockResolvedValue([]);

      const res = await request(app).post('/incremental/providers/nope/start');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /incremental/providers/:provider/cancel', () => {
    it('cancels the open ingestion and schedules a cooldown', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(makeRecord());

      const res = await request(app).post(
        '/incremental/providers/myProvider/cancel',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { message: 'myProvider: Current ingestion canceled.' },
      });
      expect(manager.updateByName).toHaveBeenCalledTimes(1);
      const [provider, update] = manager.updateByName.mock.calls[0];
      expect(provider).toBe('myProvider');
      expect(update.next_action).toBe('nothing (done)');
      expect(update.status).toBe('resting');
      expect(update.ingestion_completed_at).toEqual(expect.any(Date));
      // The cancel cooldown is 24 hours from now.
      expect(
        (update.next_action_at as Date).getTime() - Date.now(),
      ).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(
        (update.next_action_at as Date).getTime() - Date.now(),
      ).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    it('asks for patience while a restarting provider has no record', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(undefined);
      manager.listProviders.mockResolvedValue(['myProvider']);

      const res = await request(app).post(
        '/incremental/providers/myProvider/cancel',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          message: 'Provider is currently restarting, please wait.',
        },
      });
      expect(manager.updateByName).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /incremental/providers/:provider', () => {
    it('purges and resets the provider', async () => {
      manager.purgeAndResetProvider.mockResolvedValue({
        provider: 'myProvider',
        ingestionsDeleted: 1,
        marksDeleted: 2,
        markEntitiesDeleted: 3,
      });

      const res = await request(app).delete(
        '/incremental/providers/myProvider',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          provider: 'myProvider',
          ingestionsDeleted: 1,
          marksDeleted: 2,
          markEntitiesDeleted: 3,
        },
      });
      expect(manager.purgeAndResetProvider).toHaveBeenCalledWith('myProvider');
    });
  });

  describe('GET /incremental/providers/:provider/marks', () => {
    it('returns all marks of the open ingestion', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(makeRecord());
      manager.getAllMarks.mockResolvedValue([
        { id: 'mark-1', sequence: 2, cursor: { page: 2 }, created_at: 't2' },
      ]);

      const res = await request(app).get(
        '/incremental/providers/myProvider/marks',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          records: [
            {
              id: 'mark-1',
              sequence: 2,
              cursor: { page: 2 },
              created_at: 't2',
            },
          ],
        },
      });
      expect(manager.getAllMarks).toHaveBeenCalledWith('ingestion-1');
    });

    it('reports a restarting provider without marks', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(undefined);
      manager.listProviders.mockResolvedValue(['myProvider']);

      const res = await request(app).get(
        '/incremental/providers/myProvider/marks',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { message: 'No records yet (provider is restarting)' },
      });
    });

    it('returns 404 for an unknown provider', async () => {
      manager.getCurrentIngestionRecord.mockResolvedValue(undefined);
      manager.listProviders.mockResolvedValue([]);

      const res = await request(app).get('/incremental/providers/nope/marks');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Provider 'nope' not found");
    });
  });

  describe('DELETE /incremental/providers/:provider/marks', () => {
    it('clears finished ingestions and reports the deletions', async () => {
      manager.clearFinishedIngestions.mockResolvedValue({
        deletions: {
          markEntitiesDeleted: 4,
          marksDeleted: 2,
          ingestionsDeleted: 1,
        },
      });

      const res = await request(app).delete(
        '/incremental/providers/myProvider/marks',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          message: "Expired marks for provider 'myProvider' removed.",
          deletions: {
            deletions: {
              markEntitiesDeleted: 4,
              marksDeleted: 2,
              ingestionsDeleted: 1,
            },
          },
        },
      });
      expect(manager.clearFinishedIngestions).toHaveBeenCalledWith(
        'myProvider',
      );
    });
  });
});
