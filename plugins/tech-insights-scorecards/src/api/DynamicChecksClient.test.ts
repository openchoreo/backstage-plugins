import { DynamicChecksClient } from './DynamicChecksClient';

const BASE_URL = 'http://portal/api/tech-insights';

function response(status: number, body = '', contentType?: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 500 ? 'Internal Server Error' : 'Status',
    headers: { get: () => contentType ?? null },
    text: async () => body,
  } as unknown as Response;
}

function setup(...responses: Response[]) {
  const fetch = jest.fn();
  responses.forEach(r => fetch.mockResolvedValueOnce(r));
  const client = new DynamicChecksClient(
    { getBaseUrl: async () => BASE_URL },
    { fetch },
  );
  return { client, fetch };
}

const input = {
  name: 'Has a README',
  factIds: ['repoFacts'],
  rule: { conditions: { all: [] } },
};

describe('DynamicChecksClient', () => {
  it('lists checks from the tech-insights plugin', async () => {
    const { client, fetch } = setup(response(200, '[{"id":"readme"}]'));
    await expect(client.listChecks()).resolves.toEqual([{ id: 'readme' }]);
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/dynamic-checks`, {
      method: 'GET',
      headers: undefined,
      body: undefined,
    });
  });

  it('sends a check as JSON when creating and updating it', async () => {
    const { client, fetch } = setup(
      response(201, '{"id":"readme"}'),
      response(200, '{"id":"a/b"}'),
    );
    await client.createCheck(input);
    await client.updateCheck('a/b', input);
    expect(fetch).toHaveBeenNthCalledWith(1, `${BASE_URL}/dynamic-checks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      `${BASE_URL}/dynamic-checks/a%2Fb`,
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('deletes, publishes and unpublishes a check by id', async () => {
    const { client, fetch } = setup(
      response(204),
      response(204),
      response(204),
    );
    await expect(client.deleteCheck('readme')).resolves.toBeUndefined();
    await client.publishCheck('readme');
    await client.unpublishCheck('readme');
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      [`${BASE_URL}/dynamic-checks/readme`, 'DELETE'],
      [`${BASE_URL}/dynamic-checks/readme/publish`, 'POST'],
      [`${BASE_URL}/dynamic-checks/readme/unpublish`, 'POST'],
    ]);
  });

  it('dry-runs a check against an entity', async () => {
    const { client, fetch } = setup(response(200, '{"status":"passed"}'));
    await expect(
      client.dryRun('component:default/api', input),
    ).resolves.toEqual({ status: 'passed' });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      entity: 'component:default/api',
      check: input,
    });
  });

  it('returns the problems the validator finds in a rule', async () => {
    const problems = [{ code: 'unknown-fact', message: 'No such fact.' }];
    const { client, fetch } = setup(
      response(200, JSON.stringify({ problems })),
    );
    await expect(
      client.validateRule(['repoFacts'], input.rule),
    ).resolves.toEqual(problems);
    expect(fetch.mock.calls[0][0]).toBe(`${BASE_URL}/dynamic-checks/validate`);
  });

  it('lists only the scheduler tasks that are fact retrievers', async () => {
    const tasks = {
      tasks: [
        {
          taskId: 'repoFacts',
          settings: { cadence: '0 * * * *' },
          taskState: {
            status: 'running',
            startsAt: 'next',
            startedAt: 'started',
            lastRunEndedAt: 'ended',
          },
        },
        { taskId: 'apiFacts', taskState: null },
        { taskId: 'tech-insights-cleanup' },
      ],
    };
    const schemas = [
      { id: 'repoFacts', version: '1' },
      { id: 'apiFacts', version: '1' },
    ];
    const { client, fetch } = setup(
      response(200, JSON.stringify(tasks)),
      response(200, JSON.stringify(schemas)),
    );
    await expect(client.listFactCollectors()).resolves.toEqual([
      {
        id: 'repoFacts',
        cadence: '0 * * * *',
        status: 'running',
        nextRunAt: 'next',
        startedAt: 'started',
        lastRunEndedAt: 'ended',
        schema: schemas[0],
      },
      {
        id: 'apiFacts',
        cadence: undefined,
        status: 'idle',
        nextRunAt: undefined,
        startedAt: undefined,
        lastRunEndedAt: undefined,
        schema: schemas[1],
      },
    ]);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `${BASE_URL}/.backstage/scheduler/v1/tasks`,
      `${BASE_URL}/fact-schemas`,
    ]);
  });

  it('reports whether a triggered collection started or was already running', async () => {
    const { client, fetch } = setup(response(202), response(409));
    await expect(client.triggerFactCollector('repoFacts')).resolves.toBe(
      'started',
    );
    await expect(client.triggerFactCollector('repoFacts')).resolves.toBe(
      'already-running',
    );
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/dynamic-checks/fact-retrievers/repoFacts/trigger`,
      { method: 'POST' },
    );
  });

  it('throws when a collection fails to start', async () => {
    const { client } = setup(response(500));
    await expect(client.triggerFactCollector('repoFacts')).rejects.toThrow(
      'The request failed (500 Internal Server Error).',
    );
  });

  it('describes the status instead of showing an HTML error page', async () => {
    const { client } = setup(
      response(502, '<html><body>Bad Gateway</body></html>', 'text/html'),
    );
    await expect(client.listChecks()).rejects.toThrow(
      /^The request failed \(502 Status\)\.$/,
    );
  });

  it.each([
    [401, 'Your session has expired. Sign in again and retry.'],
    [403, "You don't have permission to do this."],
  ])('explains a %i response', async (status, message) => {
    const { client } = setup(response(status));
    await expect(client.listChecks()).rejects.toThrow(message);
  });

  it("passes on the backend's own error message", async () => {
    const body = JSON.stringify({
      error: { name: 'InputError', message: 'The rule is not valid.' },
      response: { statusCode: 400 },
    });
    const { client } = setup(response(400, body, 'application/json'));
    await expect(client.createCheck(input)).rejects.toThrow(
      'The rule is not valid.',
    );
  });
});
