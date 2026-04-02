import { assertApiResponse, extractErrorMessage } from './errors';

describe('extractErrorMessage', () => {
  it('returns undefined for null/undefined', () => {
    expect(extractErrorMessage(null)).toBeUndefined();
    expect(extractErrorMessage(undefined)).toBeUndefined();
  });

  it('extracts message field', () => {
    expect(extractErrorMessage({ message: 'test error' })).toBe('test error');
  });

  it('extracts error string field', () => {
    expect(extractErrorMessage({ error: 'something went wrong' })).toBe(
      'something went wrong',
    );
  });

  it('extracts nested error.message', () => {
    expect(extractErrorMessage({ error: { message: 'nested message' } })).toBe(
      'nested message',
    );
  });

  it('returns undefined for non-object', () => {
    expect(extractErrorMessage('string')).toBeUndefined();
    expect(extractErrorMessage(42)).toBeUndefined();
  });
});

describe('assertApiResponse', () => {
  it('does not throw for successful response', () => {
    const result = {
      data: { items: [] },
      error: undefined,
      response: new Response(null, { status: 200 }),
    };
    expect(() => assertApiResponse(result, 'fetch items')).not.toThrow();
  });

  it('throws NotAllowedError for 403', () => {
    const result = {
      data: undefined,
      error: { message: 'forbidden' },
      response: new Response(null, { status: 403, statusText: 'Forbidden' }),
    };
    expect(() => assertApiResponse(result, 'fetch items')).toThrow('forbidden');
    expect(() => assertApiResponse(result, 'fetch items')).toThrow(
      expect.objectContaining({ name: 'NotAllowedError' }),
    );
  });

  it('throws AuthenticationError for 401', () => {
    const result = {
      data: undefined,
      error: { message: 'unauthorized' },
      response: new Response(null, {
        status: 401,
        statusText: 'Unauthorized',
      }),
    };
    expect(() => assertApiResponse(result, 'fetch items')).toThrow(
      expect.objectContaining({
        name: 'AuthenticationError',
        message: 'unauthorized',
      }),
    );
  });

  it('throws InputError for 400', () => {
    const result = {
      data: undefined,
      error: { message: 'bad request' },
      response: new Response(null, { status: 400, statusText: 'Bad Request' }),
    };
    expect(() => assertApiResponse(result, 'fetch items')).toThrow(
      expect.objectContaining({ name: 'InputError' }),
    );
  });

  it('throws NotFoundError for 404', () => {
    const result = {
      data: undefined,
      error: { message: 'not found' },
      response: new Response(null, { status: 404, statusText: 'Not Found' }),
    };
    expect(() => assertApiResponse(result, 'fetch items')).toThrow(
      expect.objectContaining({ name: 'NotFoundError' }),
    );
  });

  it('throws ConflictError for 409', () => {
    const result = {
      data: undefined,
      error: { message: 'conflict' },
      response: new Response(null, { status: 409, statusText: 'Conflict' }),
    };
    expect(() => assertApiResponse(result, 'fetch items')).toThrow(
      expect.objectContaining({ name: 'ConflictError' }),
    );
  });

  it('throws generic Error for other status codes', () => {
    const result = {
      data: undefined,
      error: { message: 'server error' },
      response: new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    };
    expect(() => assertApiResponse(result, 'fetch items')).toThrow(
      expect.objectContaining({ name: 'Error' }),
    );
    // When error has a message, assertApiResponse uses it directly (not the fallback with status code)
    expect(() => assertApiResponse(result, 'fetch items')).toThrow(
      'server error',
    );
  });

  it('uses context in fallback message when no error message', () => {
    const result = {
      data: undefined,
      error: undefined,
      response: new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    };
    expect(() => assertApiResponse(result, 'fetch environments')).toThrow(
      /fetch environments/,
    );
    expect(() => assertApiResponse(result, 'fetch environments')).toThrow(
      /500/,
    );
  });

  it('narrows data type after assertion', () => {
    const result = {
      data: { items: [1, 2, 3] } as { items: number[] } | undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    };
    assertApiResponse(result, 'fetch items');
    // After assertion, data should be non-undefined
    expect(result.data.items).toEqual([1, 2, 3]);
  });
});
