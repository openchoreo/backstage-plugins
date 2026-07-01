import { Project } from '../../../../types';

export const model2 = {
  id: 'f2b610c6-44e6-45b1-9d0e-a618edbe6294',
  name: '',
  components: [
    {
      id: '019d17c5-eb13-40c3-b4ef-180cf278898e',
      label: 'oders-mobile-app',
      version: '',
      type: 'external-consumer',
      buildPack: 'other',
      services: {},
      connections: [
        {
          id: 'Kanushka Gayan:224fd455-43d9-49a6-a91e-49d3cf83980e:order_processing_order_processing',
          type: 'http',
          label: 'order-processor',
          onPlatform: false,
        },
      ],
    },
    {
      id: '2da15a4d-b1f6-44d3-841e-d4e451bd4658',
      label: 'mobie-app',
      version: '',
      type: 'external-consumer',
      buildPack: 'other',
      services: {},
      connections: [
        {
          id: 'Kanushka Gayan:f2b610c6-44e6-45b1-9d0e-a618edbe6294:0483376e-2883-404d-8049-a2dd53539c19:postservice',
          type: 'http',
          label: 'postservice',
          onPlatform: true,
        },
      ],
    },
    {
      id: '81557de4-f919-4997-b02b-386e06f3e0d6',
      label: 'user-service',
      version: 'v2.0',
      type: 'service',
      buildPack: 'nodejs',
      services: {},
      connections: [
        {
          id: 'Kanushka Gayan:224fd455-43d9-49a6-a91e-49d3cf83980e:order_processing_order_processing',
          type: 'http',
          label: 'order-processor',
          onPlatform: false,
        },
      ],
    },
    {
      id: '0483376e-2883-404d-8049-a2dd53539c19',
      label: 'post-service',
      version: 'v1.0',
      type: 'service',
      buildPack: 'nodejs',
      services: {
        'Kanushka Gayan:f2b610c6-44e6-45b1-9d0e-a618edbe6294:0483376e-2883-404d-8049-a2dd53539c19:post_service':
          {
            id: 'Kanushka Gayan:f2b610c6-44e6-45b1-9d0e-a618edbe6294:0483376e-2883-404d-8049-a2dd53539c19:post_service',
            label: '',
            type: '',
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
          id: 'Kanushka Gayan:f2b610c6-44e6-45b1-9d0e-a618edbe6294:81557de4-f919-4997-b02b-386e06f3e0d6:user_service_user_service',
          type: 'http',
          label: 'User Service-User Service',
          onPlatform: true,
        },
      ],
    },
    {
      id: '5872bc97-0e3a-4fe2-a754-542ec100f17f',
      label: 'todo-service',
      version: 'v1.0',
      type: 'service',
      buildPack: 'python',
      services: {
        'Kanushka Gayan:f2b610c6-44e6-45b1-9d0e-a618edbe6294:5872bc97-0e3a-4fe2-a754-542ec100f17f:todo_service':
          {
            id: 'Kanushka Gayan:f2b610c6-44e6-45b1-9d0e-a618edbe6294:5872bc97-0e3a-4fe2-a754-542ec100f17f:todo_service',
            label: '',
            type: '',
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
    {
      id: '1c884340-8f16-423c-bd4c-488f37d51245',
      label: 'notification-service',
      version: 'v1.0',
      type: 'service',
      buildPack: 'php',
      services: {
        'Kanushka Gayan:f2b610c6-44e6-45b1-9d0e-a618edbe6294:1c884340-8f16-423c-bd4c-488f37d51245:notification_service':
          {
            id: 'Kanushka Gayan:f2b610c6-44e6-45b1-9d0e-a618edbe6294:1c884340-8f16-423c-bd4c-488f37d51245:notification_service',
            label: '',
            type: '',
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
      id: '1cfff922-cda2-49ed-81f5-3d17e9c52159',
      label: 'status-checker',
      version: '',
      type: 'scheduled-task',
      buildPack: 'nodejs',
      services: {},
      connections: [
        {
          id: 'Kanushka Gayan:f2b610c6-44e6-45b1-9d0e-a618edbe6294:5872bc97-0e3a-4fe2-a754-542ec100f17f:todo_service_todo_service',
          type: 'http',
          label: 'Todo Service-Todo Service',
          onPlatform: true,
        },
        {
          id: 'Kanushka Gayan:f2b610c6-44e6-45b1-9d0e-a618edbe6294:81557de4-f919-4997-b02b-386e06f3e0d6:user_service_user_service',
          type: 'http',
          label: 'User Service-User Service',
          onPlatform: true,
        },
      ],
    },
  ],
  modelVersion: '0.4.0',
} as Project;
