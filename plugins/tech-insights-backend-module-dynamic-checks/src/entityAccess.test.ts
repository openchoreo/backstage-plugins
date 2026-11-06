import express from 'express';
import request from 'supertest';
import { mockErrorHandler, mockServices } from '@backstage/backend-test-utils';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import { createEntityAccessGate } from './entityAccess';

const VISIBLE = 'component:default/visible';
const HIDDEN = 'component:default/hidden';

function setup(
  readPermission:
    | AuthorizeResult.ALLOW
    | AuthorizeResult.DENY = AuthorizeResult.DENY,
) {
  const getEntitiesByRefs = jest.fn(
    async ({ entityRefs }: { entityRefs: string[] }) => ({
      items: entityRefs.map(ref =>
        ref === VISIBLE ? { kind: 'Component' } : undefined,
      ),
    }),
  );
  const upstream = jest.fn((_req: express.Request, res: express.Response) => {
    res.json({ upstream: true });
  });
  const app = express()
    .use(
      createEntityAccessGate({
        catalog: { getEntitiesByRefs } as unknown as CatalogService,
        httpAuth: mockServices.httpAuth(),
        permissions: mockServices.permissions({ result: readPermission }),
      }),
    )
    .post('/checks/run/:namespace/:kind/:name', upstream)
    .post('/checks/run', upstream)
    .get('/facts/latest', upstream)
    .get('/facts/range', upstream)
    .use(mockErrorHandler());
  return { app, upstream, getEntitiesByRefs };
}

describe('createEntityAccessGate', () => {
  describe('one entity', () => {
    it('passes a check run for a visible entity on to tech-insights', async () => {
      const { app, upstream, getEntitiesByRefs } = setup();
      const response = await request(app).post(
        '/checks/run/default/Component/visible',
      );
      expect(response.status).toBe(200);
      expect(upstream).toHaveBeenCalled();
      expect(getEntitiesByRefs).toHaveBeenCalledWith(
        { entityRefs: [VISIBLE], fields: ['kind'] },
        expect.objectContaining({ credentials: expect.anything() }),
      );
    });

    it('denies a check run for an entity the user can not view', async () => {
      const { app, upstream } = setup(AuthorizeResult.ALLOW);
      const response = await request(app).post(
        '/checks/run/default/component/hidden',
      );
      expect(response.status).toBe(403);
      expect(upstream).not.toHaveBeenCalled();
    });

    it.each(['/facts/latest', '/facts/range'])(
      'gates %s on the entity in the query',
      async path => {
        const { app, upstream } = setup();
        expect(
          (await request(app).get(path).query({ entity: VISIBLE })).status,
        ).toBe(200);
        expect(
          (await request(app).get(path).query({ entity: HIDDEN })).status,
        ).toBe(403);
        expect(upstream).toHaveBeenCalledTimes(1);
      },
    );

    it('reads an entity given as query fields the way tech-insights does', async () => {
      const { app } = setup();
      const response = await request(app).get(
        '/facts/latest?entity[kind]=component&entity[name]=hidden',
      );
      expect(response.status).toBe(403);
    });

    it.each([
      ['no entity', ''],
      ['an entity without a kind', '?entity=visible'],
      ['several entities', `?entity=${VISIBLE}&entity=${HIDDEN}`],
    ])('rejects facts for %s', async (_case, query) => {
      const { app, upstream } = setup();
      const response = await request(app).get(`/facts/latest${query}`);
      expect(response.status).toBe(400);
      expect(upstream).not.toHaveBeenCalled();
    });
  });

  describe('bulk check run', () => {
    it('passes any entities on for holders of the read permission', async () => {
      const { app, upstream, getEntitiesByRefs } = setup(AuthorizeResult.ALLOW);
      const response = await request(app)
        .post('/checks/run')
        .send({ entities: [HIDDEN] });
      expect(response.status).toBe(200);
      expect(upstream).toHaveBeenCalled();
      expect(getEntitiesByRefs).not.toHaveBeenCalled();
    });

    it('passes visible entities on without the read permission', async () => {
      const { app, upstream } = setup();
      const response = await request(app)
        .post('/checks/run')
        .send({
          entities: [
            { kind: 'Component', namespace: 'default', name: 'visible' },
          ],
        });
      expect(response.status).toBe(200);
      expect(upstream).toHaveBeenCalled();
    });

    it('denies a list with an entity the user can not view', async () => {
      const { app, upstream } = setup();
      const response = await request(app)
        .post('/checks/run')
        .send({ entities: [VISIBLE, HIDDEN] });
      expect(response.status).toBe(403);
      expect(upstream).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty list', { entities: [] }],
      ['no list', {}],
    ])(
      'denies %s, which runs every entity, without the read permission',
      async (_case, body) => {
        const { app, upstream } = setup();
        const response = await request(app).post('/checks/run').send(body);
        expect(response.status).toBe(403);
        expect(upstream).not.toHaveBeenCalled();
      },
    );
  });
});
