import { Project } from '../../../../types';

export const model2 = {
  id: '110ec58a-a0f2-4ac4-8393-c866d813b8d1',
  name: 'EStore',
  components: [
    {
      id: 'Products',
      version: '0.1.0',
      type: 'service',
      buildPack: 'ballerina',
      services: {
        'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Products:service1': {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Products:service1',
          label: 'service1',
          type: 'http',
          dependencyIds: [],
          deploymentMetadata: {
            gateways: {
              internet: {
                isExposed: true,
              },
              intranet: {
                isExposed: true,
              },
            },
          },
        },
      },
      connections: [
        {
          id: 'ABC:BookStore:Products:Products',
          label: 'BookStore Products',
          type: 'http',
        },
      ],
    },
    {
      id: 'Inventories',
      version: '0.1.0',
      type: 'service',
      buildPack: 'java',
      services: {
        'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Inventories:service1': {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Inventories:service1',
          label: 'service1',
          type: 'http',
          dependencyIds: [],
          deploymentMetadata: {
            gateways: {
              internet: {
                isExposed: false,
              },
              intranet: {
                isExposed: false,
              },
            },
          },
        },
      },
      connections: [
        {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Products:service1',
          type: 'http',
        },
      ],
    },
    {
      id: 'Payments',
      version: '0.1.0',
      type: 'service',
      services: {
        'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Payments:service1': {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Payments:service1',
          label: 'service1',
          type: 'http',
          dependencyIds: [],
          deploymentMetadata: {
            gateways: {
              internet: {
                isExposed: false,
              },
              intranet: {
                isExposed: false,
              },
            },
          },
        },
      },
      connections: [
        {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Products:service1',
          type: 'http',
        },
        {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Inventories:service1',
          type: 'http',
        },
        {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Users:service1',
          type: 'http',
        },
        { id: 'dynamoDb://dynamoDb', type: 'datastore', onPlatform: false },
        {
          id: 'ABC:Audit:Checks:check',
          type: 'http',
        },
      ],
    },
    {
      id: 'Users',
      version: '0.1.0',
      type: 'service',
      services: {
        'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Users:service1': {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Users:service1',
          label: 'service1',
          type: 'http',
          dependencyIds: [],
          deploymentMetadata: {
            gateways: {
              internet: {
                isExposed: false,
              },
              intranet: {
                isExposed: false,
              },
            },
          },
        },
      },
      connections: [
        {
          id: 'mysql://mysql',
          type: 'datastore',
          onPlatform: true,
        },
      ],
    },
    {
      id: 'Offers',
      version: '0.1.0',
      type: 'scheduled-task',
      services: {
        'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Offers:service1': {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Offers:service1',
          label: 'service1',
          type: 'http',
          dependencyIds: [],
          deploymentMetadata: {
            gateways: {
              internet: {
                isExposed: true,
              },
              intranet: {
                isExposed: true,
              },
            },
          },
        },
      },
      connections: [
        {
          id: 'twilio://twilio',
          type: 'connector',
          onPlatform: false,
        },
        {
          id: 'mysql://mysql',
          type: 'datastore',
          onPlatform: false,
        },
        {
          id: 'ABC:CreditCards:Offers:Offers',
          type: 'http',
        },
      ],
    },
    {
      id: 'Subscription',
      version: '0.1.0',
      type: 'scheduled-task',
      services: {
        'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Subscription:service1': {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Subscription:service1',
          label: 'service1',
          type: 'http',
          dependencyIds: [],
          deploymentMetadata: {
            gateways: {
              internet: {
                isExposed: false,
              },
              intranet: {
                isExposed: false,
              },
            },
          },
        },
      },
      connections: [],
    },
    {
      id: 'Website',
      version: '0.1.0',
      type: 'web-app',
      services: {},
      connections: [
        {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Products:service1',
          type: 'http',
        },
        {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Products:service1',
          type: 'http',
        },
        {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Users:service1',
          type: 'http',
        },
      ],
    },
    {
      id: 'Admin Portal',
      version: '0.1.0',
      type: 'web-app',
      services: {},
      connections: [],
    },
    {
      id: 'Legacy API',
      version: '0.1.0',
      type: 'api-proxy',
      services: {
        'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Legacy Owners:service1': {
          id: 'ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Legacy Owners:service1',
          label: 'service1',
          type: 'http',
          dependencyIds: [],
          deploymentMetadata: {
            gateways: {
              internet: {
                isExposed: false,
              },
              intranet: {
                isExposed: true,
              },
            },
          },
        },
      },
      connections: [
        {
          id: 'ABC:BookStore:Products:Products',
          label: 'BookStore Products',
          type: 'http',
        },
      ],
    },
  ],
  configurations: [
    {
      id: 'mysql://mysql',
      label: 'MySQL',
      type: 'datastore',
      onPlatform: true,
    },
    {
      id: 'mongoDb://mongoDb',
      type: 'datastore',
      onPlatform: false,
    },
    {
      id: 'twilio://twilio',
      label: 'Twilio',
      type: 'connector',
      onPlatform: false,
    },
    {
      id: 'paypal://paypal',
      type: 'connector',
      onPlatform: false,
    },
    {
      id: 'dynamoDb://dynamoDb',
      label: 'DynamoDB',
      type: 'datastore',
      onPlatform: false,
    },
  ],
  modelVersion: '0.4.0',
} as Project;
