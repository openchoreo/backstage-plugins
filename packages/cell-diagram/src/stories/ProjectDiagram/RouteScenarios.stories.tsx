import { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { CellDiagram } from '../../Diagram';
import { Container } from '../utils';
import {
  CellBounds,
  Component,
  ComponentType,
  Project,
  Route,
  RouteBranch,
} from '../../types';

const service = (id: string, calls: string[] = []): Component => {
  const [label, badge] = id.split('@');
  return {
    id,
    label,
    badge,
    version: '1',
    type: ComponentType.SERVICE,
    services: {},
    connections: calls.map(target => ({ id: `default:shop:${target}` })),
  };
};

const project = (components: Component[], routes: Route[]): Project => ({
  id: 'shop',
  name: 'shop',
  modelVersion: '0.4.0',
  components,
  routes,
});

const route = (
  id: string,
  from: Route['from'],
  branches: RouteBranch[],
): Route => ({
  id,
  name: id,
  ...(from && { from }),
  branches,
});

const north = { boundary: CellBounds.NorthBound };
const west = { boundary: CellBounds.WestBound };
const caller = (componentId: string) => ({ componentId });

const meta: Meta<typeof CellDiagram> = {
  title: 'Project Diagram/Endpoint Route Scenarios',
  component: CellDiagram,
  decorators: [
    (Story, context) => (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: context.args.mode === 'dark' ? '#0f1117' : '#ffffff',
        }}
      >
        <Container>
          <Story />
        </Container>
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  args: { onRouteClick: action('route clicked'), mode: 'dark' },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** One external Endpoint, one backend: the simplest case. */
export const S1Single: Story = {
  args: {
    project: project(
      [service('web', ['api']), service('api')],
      [route('web', north, [{ componentId: 'web' }])],
    ),
  },
};

/** A canary at the gateway, 90/10, with a plain dependency behind it. */
export const S2GatewayCanary: Story = {
  args: {
    project: project(
      [service('web', ['api']), service('web@canary', ['api']), service('api')],
      [
        route('web', north, [
          { componentId: 'web', label: '90%' },
          { componentId: 'web@canary', label: '10%' },
        ]),
      ],
    ),
  },
};

/** A canary in the mesh: one caller, its Endpoint split 80/20. */
export const S3MeshCanary: Story = {
  args: {
    project: project(
      [service('web', ['api']), service('api'), service('api@v2')],
      [
        route('web', north, [{ componentId: 'web' }]),
        route('api', caller('web'), [
          { componentId: 'api', label: '80%' },
          { componentId: 'api@v2', label: '20%' },
        ]),
      ],
    ),
  },
};

/** An internal Endpoint, split from the west gateway. */
export const S4InternalGateway: Story = {
  args: {
    project: project(
      [service('admin'), service('admin@next'), service('db-proxy')],
      [
        route('admin', west, [
          { componentId: 'admin', label: '50%' },
          { componentId: 'admin@next', label: '50%' },
        ]),
      ],
    ),
  },
};

/** One Endpoint on both gateways, external and internal. */
export const S5BothGateways: Story = {
  args: {
    project: project(
      [service('api'), service('api@blue'), service('worker')],
      [
        route('api', north, [
          { componentId: 'api', label: '100%' },
          { componentId: 'api@blue', label: '0%', faded: true },
        ]),
        route('api', west, [
          { componentId: 'api', label: '100%' },
          { componentId: 'api@blue', label: '0%', faded: true },
        ]),
      ],
    ),
  },
};

/** Endpoints nothing in the project calls: one project-only, one from other projects. */
export const S6Uncalled: Story = {
  args: {
    project: project(
      [
        service('web', ['api']),
        service('api'),
        service('jobs'),
        service('jobs@v2'),
        service('reports'),
        service('reports@beta'),
      ],
      [
        route('web', north, [{ componentId: 'web' }]),
        route('jobs', undefined, [
          { componentId: 'jobs', label: '70%' },
          { componentId: 'jobs@v2', label: '30%' },
        ]),
        route('reports', west, [
          { componentId: 'reports', label: '100%' },
          { componentId: 'reports@beta', label: 'if header x-beta: 1' },
        ]),
      ],
    ),
  },
};

/** Two Endpoints on the same component, each with its own split. */
export const S7TwoEndpointsOneComponent: Story = {
  args: {
    project: project(
      [
        service('web', ['orders']),
        service('admin', ['orders']),
        service('orders'),
        service('orders@fast'),
      ],
      [
        route('web', north, [{ componentId: 'web' }]),
        route('orders-api', caller('web'), [
          { componentId: 'orders', label: '95%' },
          { componentId: 'orders@fast', label: '5%' },
        ]),
        route('orders-admin', caller('admin'), [
          { componentId: 'orders', label: '100%' },
          { componentId: 'orders@fast', label: 'copy 50%', copy: true },
        ]),
      ],
    ),
  },
};

/** Splits in a chain: the caller's split leads to lines that call another split. */
export const S8Chain: Story = {
  args: {
    project: project(
      [
        service('web', ['cart']),
        service('cart', ['pricing']),
        service('cart@v2', ['pricing']),
        service('pricing'),
        service('pricing@rules'),
      ],
      [
        route('web', north, [{ componentId: 'web' }]),
        route('cart', caller('web'), [
          { componentId: 'cart', label: '90%' },
          { componentId: 'cart@v2', label: '10%' },
        ]),
        ...['cart', 'cart@v2'].map(c =>
          route('pricing', caller(c), [
            { componentId: 'pricing', label: '100%' },
            { componentId: 'pricing@rules', label: 'if cookie rules=on' },
          ]),
        ),
      ],
    ),
  },
};

const storefronts = ['storefront', 'storefront@buy-now', 'storefront@redesign'];

/**
 * A full project: an A/B gateway split over three lines, every line calling
 * a mesh split, a mirror, an internal Endpoint, an uncalled one, and plain
 * dependencies with no Endpoint.
 */
export const S9Large: Story = {
  args: {
    project: project(
      [
        ...storefronts.map(id => service(id, ['catalog', 'reviews', 'cart'])),
        service('catalog', ['inventory']),
        service('inventory'),
        service('cart', ['payments']),
        service('payments'),
        service('payments@shadow'),
        service('reviews'),
        service('reviews@star-ratings'),
        service('backoffice', ['inventory']),
        service('backoffice@next', ['inventory']),
        service('search'),
        service('search@v2'),
      ],
      [
        route('shop', north, [
          { componentId: 'storefront', label: '100%' },
          { componentId: 'storefront@buy-now', label: 'if cookie beta=yes' },
          {
            componentId: 'storefront@redesign',
            label: 'if header x-preview: green',
          },
        ]),
        ...storefronts.map(c =>
          route('reviews-api', caller(c), [
            { componentId: 'reviews', label: '75%' },
            { componentId: 'reviews@star-ratings', label: '25%' },
          ]),
        ),
        route('payments-api', caller('cart'), [
          { componentId: 'payments', label: '100%' },
          { componentId: 'payments@shadow', label: 'copy 10%', copy: true },
        ]),
        route('backoffice', west, [
          { componentId: 'backoffice', label: '50%' },
          { componentId: 'backoffice@next', label: '50%' },
        ]),
        route('search-api', undefined, [
          { componentId: 'search', label: '100%' },
          { componentId: 'search@v2', label: '0%', faded: true },
        ]),
      ],
    ),
  },
};
