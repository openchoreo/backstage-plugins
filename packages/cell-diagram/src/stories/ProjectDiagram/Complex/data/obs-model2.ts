import { Project } from '../../../../types';

export const obsModel2 = {
  id: 'A',
  name: 'A',
  components: [
    {
      id: 'Users',
      version: '0.2.0',
      type: 'service',
      services: {
        'ABC:A:Users:get': {
          id: 'ABC:A:Users:get',
          label: 'Get Users',
          type: 'http',
          dependencyIds: [],
          deploymentMetadata: {
            gateways: {
              internet: {
                isExposed: true,
                observations: [
                  {
                    version: '0.2.0',
                    avgLatency: 136631633,
                    destinationNodeId: 1,
                    errorCount: 0,
                    p50Latency: 21132684,
                    p90Latency: 1043810050,
                    p99Latency: 2199582500,
                    requestCount: 36,
                    sourceNodeId: 0,
                  },
                ],
              },
              intranet: {
                isExposed: true,
                observations: [
                  {
                    version: '0.2.0',
                    avgLatency: 207605809,
                    destinationNodeId: 2,
                    errorCount: 4,
                    p50Latency: 22461844,
                    p90Latency: 1469733900,
                    p99Latency: 1469733900,
                    requestCount: 16,
                    sourceNodeId: 0,
                  },
                ],
              },
            },
          },
        },
        'ABC:A:Users:post': {
          id: 'ABC:A:Users:post',
          label: 'Add Users',
          type: 'http',
          dependencyIds: [],
          deploymentMetadata: {
            gateways: {
              internet: {
                isExposed: true,
                observations: [
                  {
                    version: '2.2.0',
                    avgLatency: 4.4044168430549675,
                    destinationNodeId: 1,
                    errorCount: 0,
                    p50Latency: 1.375036732051006,
                    p90Latency: 10,
                    p99Latency: 10,
                    requestCount: 2.0003907013088496,
                    sourceNodeId: 0,
                  },
                ],
              },
              intranet: {
                isExposed: false,
              },
            },
          },
        },
        'ABC:A:Users:put': {
          id: 'ABC:A:Users:put',
          label: 'Update Users',
          type: 'http',
          dependencyIds: [],
          deploymentMetadata: {
            gateways: {
              internet: {
                isExposed: true,
                observations: [
                  {
                    version: '0.2.0',
                    avgLatency: 136631633,
                    destinationNodeId: 1,
                    errorCount: 10,
                    p50Latency: 21132684,
                    p90Latency: 1043810050,
                    p99Latency: 2199582500,
                    requestCount: 2500,
                    sourceNodeId: 0,
                  },
                ],
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
          id: 'ABC:A:Products:basepath',
          onPlatform: true,
          observations: [
            {
              version: '0.2.0',
              avgLatency: 191934320,
              destinationNodeId: 1,
              errorCount: 0,
              p50Latency: 191934320,
              p90Latency: 191934320,
              p99Latency: 191934320,
              requestCount: 1000,
              sourceNodeId: 2,
            },
          ],
        },
        {
          id: 'googleapps://firebase',
          label: 'Firebase',
          onPlatform: false,
          type: 'datastore',
          observations: [
            {
              version: '0.2.0',
              avgLatency: 191934320,
              destinationNodeId: 1,
              errorCount: 0,
              p50Latency: 191934320,
              p90Latency: 191934320,
              p99Latency: 191934320,
              requestCount: 4000,
              sourceNodeId: 2,
            },
          ],
        },
      ],
    },
    {
      id: 'Products',
      label: 'Products',
      version: '0.2.0',
      type: 'service',
      services: {
        'ABC:A:Products:get': {
          id: 'ABC:A:Products:get',
          label: 'Get Products',
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
          id: 'ABC:B:Users:get',
          label: 'Org Users',
          onPlatform: true,
          observations: [
            {
              version: '0.2.0',
              avgLatency: 191934320,
              destinationNodeId: 1,
              errorCount: 0,
              p50Latency: 191934320,
              p90Latency: 191934320,
              p99Latency: 191934320,
              requestCount: 10000,
              sourceNodeId: 2,
            },
          ],
        },
        {
          id: 'mysql://mysql',
          onPlatform: true,
          type: 'datastore',
          observations: [
            {
              version: '0.2.0',
              avgLatency: 191934320,
              destinationNodeId: 1,
              errorCount: 0,
              p50Latency: 191934320,
              p90Latency: 191934320,
              p99Latency: 191934320,
              requestCount: 20,
              sourceNodeId: 2,
            },
          ],
        },
      ],
    },
    {
      id: 'Invoices',
      version: '0.2.0',
      type: 'service',
      services: {
        'ABC:A:Invoices:get': {
          id: 'ABC:A:Invoices:get',
          label: 'Get Invoices',
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
          id: 'ABC:B:Invoices:post',
          label: 'Org Invoices',
          type: 'http',
          onPlatform: true,
          observations: [
            {
              version: '0.2.0',
              avgLatency: 191934320,
              destinationNodeId: 1,
              errorCount: 0,
              p50Latency: 191934320,
              p90Latency: 191934320,
              p99Latency: 191934320,
              requestCount: 158,
              sourceNodeId: 2,
            },
          ],
        },
        {
          id: 'ABC:A:Users:get',
          onPlatform: true,
          observations: [
            {
              avgLatency: 191934320,
              destinationNodeId: 1,
              errorCount: 0,
              p50Latency: 191934320,
              p90Latency: 191934320,
              p99Latency: 191934320,
              requestCount: 150,
              sourceNodeId: 2,
              componentVersion: '0.2.0',
            },
            {
              avgLatency: 191934320,
              destinationNodeId: 1,
              errorCount: 0,
              p50Latency: 191934320,
              p90Latency: 191934320,
              p99Latency: 191934320,
              requestCount: 300,
              sourceNodeId: 2,
              componentVersion: '0.1.0',
            },
          ],
        },
        {
          id: 'mysql://mysql',
          label: 'MySQL DB',
          onPlatform: false,
          type: 'datastore',
          observations: [
            {
              avgLatency: 191934320,
              destinationNodeId: 1,
              errorCount: 0,
              p50Latency: 191934320,
              p90Latency: 191934320,
              p99Latency: 191934320,
              requestCount: 2000,
              sourceNodeId: 2,
            },
          ],
        },
      ],
    },
    {
      id: 'Transactions',
      version: '0.2.0',
      type: 'service',
      services: {
        'ABC:A:Invoices:get': {
          id: 'ABC:A:Invoices:get',
          label: 'Get Invoices',
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
          id: 'ABC:A:Products:basepath',
          onPlatform: true,
          observations: [
            {
              avgLatency: 191934320,
              destinationNodeId: 1,
              errorCount: 0,
              p50Latency: 191934320,
              p90Latency: 191934320,
              p99Latency: 191934320,
              requestCount: 1500,
              sourceNodeId: 2,
              componentVersion: '0.2.0',
            },
            {
              avgLatency: 191934320,
              destinationNodeId: 1,
              errorCount: 0,
              p50Latency: 191934320,
              p90Latency: 191934320,
              p99Latency: 191934320,
              requestCount: 3000,
              sourceNodeId: 2,
              componentVersion: '0.1.0',
            },
          ],
        },
      ],
    },
  ],
  modelVersion: '0.4.0',
} as Project;
