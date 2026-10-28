import { JSONSchema7 } from 'json-schema';
import { withoutFilledDefaults } from './traitDefaults';

const probe: JSONSchema7 = {
  type: 'object',
  default: {},
  properties: {
    enabled: { type: 'boolean', default: false },
    failureThreshold: { type: 'integer', default: 3 },
    periodSeconds: { type: 'integer', default: 10 },
    timeoutSeconds: { type: 'integer', default: 1 },
    handler: {
      oneOf: [
        { type: 'object', maxProperties: 0 },
        {
          required: ['httpGet'],
          properties: {
            httpGet: {
              type: 'object',
              properties: {
                path: { type: 'string', default: '/' },
                port: { type: 'integer' },
              },
            },
          },
        },
        {
          required: ['tcpSocket'],
          properties: {
            tcpSocket: {
              type: 'object',
              properties: { port: { type: 'integer' } },
            },
          },
        },
      ],
    },
  },
};

const schema: JSONSchema7 = {
  type: 'object',
  properties: {
    containerName: { type: 'string', default: 'main' },
    readiness: probe,
    startup: probe,
  },
};

const readiness = {
  enabled: true,
  failureThreshold: 3,
  handler: { tcpSocket: { port: 9090 } },
};

describe('withoutFilledDefaults', () => {
  it('drops defaults the form added at the top level', () => {
    expect(
      withoutFilledDefaults(
        schema,
        { containerName: 'main', readiness, startup: {} },
        { readiness },
      ),
    ).toEqual({ readiness });
  });

  it('drops nested defaults and objects that only held defaults', () => {
    expect(
      withoutFilledDefaults(
        schema,
        {
          readiness: { ...readiness, periodSeconds: 10, timeoutSeconds: 1 },
          startup: { enabled: false, failureThreshold: 3, periodSeconds: 10 },
        },
        { readiness },
      ),
    ).toEqual({ readiness });
  });

  it('keeps values the original had, even when they equal the default', () => {
    expect(
      withoutFilledDefaults(
        schema,
        { containerName: 'main', readiness },
        { containerName: 'main', readiness },
      ),
    ).toEqual({ containerName: 'main', readiness });
  });

  it('keeps values the user changed from their default', () => {
    expect(
      withoutFilledDefaults(
        schema,
        {
          containerName: 'app',
          readiness: { ...readiness, periodSeconds: 20 },
        },
        { readiness },
      ),
    ).toEqual({
      containerName: 'app',
      readiness: { ...readiness, periodSeconds: 20 },
    });
  });

  it('keeps defaults inside oneOf branches, which the platform does not apply', () => {
    const value = {
      readiness: {
        enabled: true,
        handler: { httpGet: { port: 8080, path: '/' } },
      },
    };
    expect(
      withoutFilledDefaults(schema, value, {
        readiness: { enabled: true, handler: { httpGet: { port: 8080 } } },
      }),
    ).toEqual(value);
  });
});
