/**
 * Creates a mock successful API response matching the shape returned by
 * openapi-fetch's GET/POST/PUT/DELETE methods.
 */
export function createOkResponse<T>(data: T) {
  return {
    data,
    error: undefined,
    response: { ok: true as const, status: 200 },
  };
}

/**
 * Creates a mock error API response matching the shape returned by
 * openapi-fetch's GET/POST/PUT/DELETE methods.
 */
export function createErrorResponse(status = 500, message = 'fail') {
  return {
    data: undefined,
    error: { message },
    response: {
      ok: false as const,
      status,
      statusText:
        status === 404
          ? 'Not Found'
          : status === 403
            ? 'Forbidden'
            : 'Internal Server Error',
    },
  };
}

/**
 * Creates a mock DELETE success response (no data body).
 */
export function createDeleteOkResponse() {
  return {
    error: undefined,
    response: { ok: true as const, status: 200 },
  };
}

/**
 * Creates a mock DELETE error response.
 */
export function createDeleteErrorResponse(status = 404, message = 'fail') {
  return {
    error: { message },
    response: {
      ok: false as const,
      status,
      statusText: status === 404 ? 'Not Found' : 'Internal Server Error',
    },
  };
}
