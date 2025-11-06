import { HttpAuthService } from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import { z } from 'zod';
import express from 'express';
import Router from 'express-promise-router';
import { obsServiceRef } from './services/ObsService';

export async function createRouter({
  httpAuth,
  obsService,
}: {
  httpAuth: HttpAuthService;
  obsService: typeof obsServiceRef.T;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // TEMPLATE NOTE:
  // Zod is a powerful library for data validation and recommended in particular
  // for user-defined schemas. In this case we use it for input validation too.
  //
  // If you want to define a schema for your API we recommend using Backstage's
  // OpenAPI tooling: https://backstage.io/docs/next/openapi/01-getting-started
  const todoSchema = z.object({
    title: z.string(),
    entityRef: z.string().optional(),
  });

  router.post('/todos', async (req, res) => {
    const parsed = todoSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new InputError(parsed.error.toString());
    }

    const result = await obsService.createTodo(parsed.data, {
      credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    });

    res.status(201).json(result);
  });

  router.get('/todos', async (_req, res) => {
    res.json(await obsService.listTodos());
  });

  router.get('/todos/:id', async (req, res) => {
    res.json(await obsService.getTodo({ id: req.params.id }));
  });

  router.get('/metrics', async (_req, res) => {
    // Dummy metrics data
    const metrics = {
      timestamp: new Date().toISOString(),
      metrics: [
        {
          name: 'CPU Usage',
          value: 45.2,
          unit: '%',
          status: 'normal',
        },
        {
          name: 'Memory Usage',
          value: 68.5,
          unit: '%',
          status: 'normal',
        },
        {
          name: 'Request Count',
          value: 1234,
          unit: 'requests',
          status: 'normal',
        },
        {
          name: 'Error Rate',
          value: 2.1,
          unit: '%',
          status: 'warning',
        },
        {
          name: 'Response Time',
          value: 156,
          unit: 'ms',
          status: 'normal',
        },
      ],
    };
    res.json(metrics);
  });

  return router;
}
