import { StoryFn } from '@storybook/react';
import { CellDiagram, CellDiagramProps, DiagramLayer } from '../Diagram';
import { Container, componentMenu, handleComponentDoubleClick } from './utils';

export default {
  title: 'Layers Samples',
  component: CellDiagram,
  args: {
    animation: true,
    showControls: true,
    componentMenu: componentMenu,
    onComponentDoubleClick: handleComponentDoubleClick,
  },
};

export const Links: StoryFn = (args: CellDiagramProps) => (
  <Container>
    <CellDiagram {...args} />
  </Container>
);

Links.args = {
  project: {
    id: 'PRG',
    components: [
      {
        id: 'A',
        type: 'service',
        connections: [
          {
            id: 'ORG:PRG:B',
          },
        ],
      },
      {
        id: 'B',
        type: 'service',
        services: {
          'PRG:B:Service1:Get': {
            id: 'PRG:B:Service1:Get',
            type: 'http',
            dependencyIds: [],
            deploymentMetadata: {
              gateways: {
                internet: {
                  isExposed: true,
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
            id: 'ORG:ORG:IDA',
          },
        ],
      },
      {
        id: 'C',
        type: 'service',
        connections: [{ id: 'EDA', type: 'connector' }],
      },
    ],
  },
};

export const ObservationsNDiff: StoryFn = (args: CellDiagramProps) => (
  <Container>
    <CellDiagram {...args} />
  </Container>
);

ObservationsNDiff.args = {
  defaultDiagramLayer: DiagramLayer.OBSERVABILITY,
  project: {
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
                  tooltip: 'test tooltip with observations',
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
                      version: '0.2.0',
                      avgLatency: 136631633,
                      destinationNodeId: 1,
                      errorCount: 10,
                      p50Latency: 21132684,
                      p90Latency: 1043810050,
                      p99Latency: 2199582500,
                      requestCount: 36,
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
            observations: [],
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
            observationOnly: true,
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
                  isExposed: true,
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
            observationOnly: true,
          },
        ],
      },
    ],
    modelVersion: '0.4.0',
  },
};

export const AverageReqeustCount: StoryFn = (args: CellDiagramProps) => (
  <Container>
    <CellDiagram {...args} />
  </Container>
);

AverageReqeustCount.args = {
  defaultDiagramLayer: DiagramLayer.OBSERVABILITY,
  customTooltips: {
    diagramLayers: {
      diffLayer: 'Diff Layer description',
    },
  },
  project: {
    id: 'owto',
    name: 'TaskNest',
    components: [
      {
        id: 'kcqhen',
        label: 'status-checker',
        version: '',
        type: 'scheduled-task',
        buildPack: 'other',
        services: {},
        connections: [
          {
            id: 'kanushkagayan:owto:rkpusf:1756e',
            onPlatform: true,
            observations: [
              {
                componentVersion: 'v1.0',
                avgLatency: 3277272,
                destinationNodeId: 1,
                errorCount: 2,
                p50Latency: 1733466,
                p90Latency: 4660686,
                p99Latency: 37304208,
                requestCount: 1376,
                sourceNodeId: 2,
              },
            ],
          },
          {
            id: 'kanushkagayan:owto:nkgkqe:ENDPOINT_HASH',
            type: 'http',
            observations: [
              {
                componentVersion: 'v1.0',
                avgLatency: 1077694,
                destinationNodeId: 3,
                errorCount: 0,
                p50Latency: 778138,
                p90Latency: 1550248,
                p99Latency: 6553767,
                requestCount: 2230,
                sourceNodeId: 2,
              },
            ],
            observationOnly: true,
          },
        ],
      },
      {
        id: 'rkpusf',
        label: 'todo-service',
        version: 'v1.0',
        type: 'service',
        buildPack: 'other',
        services: {
          'Kanushka Gayan:owto:rkpusf:Todo Service': {
            id: 'Kanushka Gayan:owto:rkpusf:Todo Service',
            label: '',
            type: 'HTTP',
            dependencyIds: [],
            deploymentMetadata: {
              gateways: {
                internet: {
                  isExposed: true,
                  observations: [
                    {
                      componentVersion: 'v1.0',
                      avgLatency: 2747368,
                      destinationNodeId: 1,
                      errorCount: 0,
                      p50Latency: 1676125,
                      p90Latency: 3430738,
                      p99Latency: 27453751,
                      requestCount: 373,
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
        connections: [],
      },
      {
        id: 'nkgkqe',
        label: 'notification-service',
        version: 'v1.0',
        type: 'service',
        buildPack: 'other',
        services: {
          'Kanushka Gayan:owto:nkgkqe:Notification Service': {
            id: 'Kanushka Gayan:owto:nkgkqe:Notification Service',
            label: '',
            type: 'HTTP',
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
        connections: [],
      },
      {
        id: 'cmottt',
        label: 'user-service',
        version: 'v1.0',
        type: 'service',
        buildPack: 'other',
        services: {
          'Kanushka Gayan:owto:cmottt:User Service': {
            id: 'Kanushka Gayan:owto:cmottt:User Service',
            label: '',
            type: 'HTTP',
            dependencyIds: [],
            deploymentMetadata: {
              gateways: {
                internet: {
                  isExposed: true,
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
    ],
    modelVersion: '0.4.0',
  },
};

export const SmallRequestCount: StoryFn = (args: CellDiagramProps) => (
  <Container>
    <CellDiagram {...args} />
  </Container>
);

SmallRequestCount.args = {
  defaultDiagramLayer: DiagramLayer.OBSERVABILITY,
  customTooltips: {
    diagramLayers: {
      diffLayer: 'Diff Layer description',
    },
  },
  project: {
    id: 'owto',
    name: 'TaskNest',
    components: [
      {
        id: 'kcqhen',
        label: 'status-checker',
        version: '',
        type: 'scheduled-task',
        buildPack: 'other',
        services: {},
        connections: [
          {
            id: 'kanushkagayan:owto:rkpusf:1756e',
            onPlatform: true,
            observations: [
              {
                componentVersion: 'v1.0',
                avgLatency: 3277272,
                destinationNodeId: 1,
                errorCount: 2,
                p50Latency: 1733466,
                p90Latency: 4660686,
                p99Latency: 37304208,
                requestCount: 50,
                sourceNodeId: 2,
              },
            ],
          },
          {
            id: 'kanushkagayan:owto:nkgkqe:ENDPOINT_HASH',
            type: 'http',
            observations: [
              {
                componentVersion: 'v1.0',
                avgLatency: 1077694,
                destinationNodeId: 3,
                errorCount: 0,
                p50Latency: 778138,
                p90Latency: 1550248,
                p99Latency: 6553767,
                requestCount: 10,
                sourceNodeId: 2,
              },
            ],
            observationOnly: true,
          },
        ],
      },
      {
        id: 'rkpusf',
        label: 'todo-service',
        version: 'v1.0',
        type: 'service',
        buildPack: 'other',
        services: {
          'Kanushka Gayan:owto:rkpusf:Todo Service': {
            id: 'Kanushka Gayan:owto:rkpusf:Todo Service',
            label: '',
            type: 'HTTP',
            dependencyIds: [],
            deploymentMetadata: {
              gateways: {
                internet: {
                  isExposed: true,
                  observations: [
                    {
                      componentVersion: 'v1.0',
                      avgLatency: 2747368,
                      destinationNodeId: 1,
                      errorCount: 0,
                      p50Latency: 1676125,
                      p90Latency: 3430738,
                      p99Latency: 27453751,
                      requestCount: 2,
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
        connections: [],
      },
      {
        id: 'nkgkqe',
        label: 'notification-service',
        version: 'v1.0',
        type: 'service',
        buildPack: 'other',
        services: {
          'Kanushka Gayan:owto:nkgkqe:Notification Service': {
            id: 'Kanushka Gayan:owto:nkgkqe:Notification Service',
            label: '',
            type: 'HTTP',
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
        connections: [],
      },
      {
        id: 'cmottt',
        label: 'user-service',
        version: 'v1.0',
        type: 'service',
        buildPack: 'other',
        services: {
          'Kanushka Gayan:owto:cmottt:User Service': {
            id: 'Kanushka Gayan:owto:cmottt:User Service',
            label: '',
            type: 'HTTP',
            dependencyIds: [],
            deploymentMetadata: {
              gateways: {
                internet: {
                  isExposed: true,
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
    ],
    modelVersion: '0.4.0',
  },
};

export const HighRequestCount: StoryFn = (args: CellDiagramProps) => (
  <Container>
    <CellDiagram {...args} />
  </Container>
);

HighRequestCount.args = {
  defaultDiagramLayer: DiagramLayer.OBSERVABILITY,
  customTooltips: {
    diagramLayers: {
      diffLayer: 'Diff Layer description',
    },
  },
  project: {
    id: 'owto',
    name: 'TaskNest',
    components: [
      {
        id: 'kcqhen',
        label: 'status-checker',
        version: '',
        type: 'scheduled-task',
        buildPack: 'other',
        services: {},
        connections: [
          {
            id: 'kanushkagayan:owto:rkpusf:1756e',
            onPlatform: true,
            observations: [
              {
                componentVersion: 'v1.0',
                avgLatency: 3277272,
                destinationNodeId: 1,
                errorCount: 2,
                p50Latency: 1733466,
                p90Latency: 4660686,
                p99Latency: 37304208,
                requestCount: 55550,
                sourceNodeId: 2,
              },
            ],
          },
          {
            id: 'kanushkagayan:owto:nkgkqe:ENDPOINT_HASH',
            type: 'http',
            observations: [
              {
                componentVersion: 'v1.0',
                avgLatency: 1077694,
                destinationNodeId: 3,
                errorCount: 0,
                p50Latency: 778138,
                p90Latency: 1550248,
                p99Latency: 6553767,
                requestCount: 11110,
                sourceNodeId: 2,
              },
            ],
            observationOnly: true,
          },
        ],
      },
      {
        id: 'rkpusf',
        label: 'todo-service',
        version: 'v1.0',
        type: 'service',
        buildPack: 'other',
        services: {
          'Kanushka Gayan:owto:rkpusf:Todo Service': {
            id: 'Kanushka Gayan:owto:rkpusf:Todo Service',
            label: '',
            type: 'HTTP',
            dependencyIds: [],
            deploymentMetadata: {
              gateways: {
                internet: {
                  isExposed: true,
                  observations: [
                    {
                      componentVersion: 'v1.0',
                      avgLatency: 2747368,
                      destinationNodeId: 1,
                      errorCount: 0,
                      p50Latency: 1676125,
                      p90Latency: 3430738,
                      p99Latency: 27453751,
                      requestCount: 22222,
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
        connections: [],
      },
      {
        id: 'nkgkqe',
        label: 'notification-service',
        version: 'v1.0',
        type: 'service',
        buildPack: 'other',
        services: {
          'Kanushka Gayan:owto:nkgkqe:Notification Service': {
            id: 'Kanushka Gayan:owto:nkgkqe:Notification Service',
            label: '',
            type: 'HTTP',
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
        connections: [],
      },
      {
        id: 'cmottt',
        label: 'user-service',
        version: 'v1.0',
        type: 'service',
        buildPack: 'other',
        services: {
          'Kanushka Gayan:owto:cmottt:User Service': {
            id: 'Kanushka Gayan:owto:cmottt:User Service',
            label: '',
            type: 'HTTP',
            dependencyIds: [],
            deploymentMetadata: {
              gateways: {
                internet: {
                  isExposed: true,
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
    ],
    modelVersion: '0.4.0',
  },
};
