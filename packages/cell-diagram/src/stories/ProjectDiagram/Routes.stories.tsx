import { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { CellDiagram } from '../../Diagram';
import { Container } from '../utils';
import { CellBounds, ComponentType, Project, Route } from '../../types';

const service = (
  id: string,
  label: string,
  badge?: string,
  calls: string[] = [],
) => ({
  id,
  label,
  badge,
  version: '1',
  type: ComponentType.WEB_APP,
  services: {},
  connections: calls.map(target => ({ id: `default:bookstore:${target}` })),
});

const bookstore = (routes: Route[]): Project => ({
  id: 'bookstore',
  name: 'bookstore',
  modelVersion: '0.4.0',
  components: [
    service('storefront', 'storefront', 'main', ['catalog', 'reviews']),
    service('storefront@redesign', 'storefront', 'redesign', [
      'catalog',
      'reviews',
    ]),
    service('catalog', 'catalog'),
    service('reviews', 'reviews', 'main'),
    service('reviews@star-ratings', 'reviews', 'star-ratings'),
  ],
  routes,
});

const meta: Meta<typeof CellDiagram> = {
  title: 'Project Diagram/Endpoint Routes',
  component: CellDiagram,
  decorators: [
    Story => (
      <Container>
        <Story />
      </Container>
    ),
  ],
  parameters: { layout: 'centered' },
  args: { onRouteClick: action('route clicked') },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const OneBackend: Story = {
  args: {
    project: bookstore([
      {
        id: 'shop',
        name: 'Shop',
        from: { boundary: CellBounds.NorthBound },
        branches: [{ componentId: 'storefront' }],
      },
    ]),
  },
};

export const SplitAtTheGateway: Story = {
  args: {
    project: bookstore([
      {
        id: 'shop',
        name: 'Shop',
        from: { boundary: CellBounds.NorthBound },
        branches: [
          { componentId: 'storefront', label: '0%', faded: true },
          { componentId: 'storefront@redesign', label: '100%' },
        ],
        details: {
          subtitle: 'external · default split',
          rows: [
            { label: 'storefront', value: '0%' },
            { label: 'storefront @ redesign', value: '100%' },
          ],
        },
      },
    ]),
  },
};

export const SplitInTheMesh: Story = {
  args: {
    project: bookstore([
      {
        id: 'reviews-api',
        name: 'Reviews API',
        from: { componentId: 'storefront' },
        branches: [
          { componentId: 'reviews', label: '90%' },
          { componentId: 'reviews@star-ratings', label: '10%' },
        ],
        details: {
          subtitle: 'namespace · default split · own split in development',
          rows: [
            { label: 'reviews', value: '90%' },
            { label: 'reviews @ star-ratings', value: '10%' },
          ],
        },
      },
    ]),
  },
};

export const ConditionAndCopy: Story = {
  args: {
    project: bookstore([
      {
        id: 'shop',
        name: 'Shop',
        from: { boundary: CellBounds.NorthBound },
        branches: [
          { componentId: 'storefront', label: '100%' },
          { componentId: 'storefront@redesign', label: 'if cookie beta=yes' },
        ],
      },
      {
        id: 'reviews-api',
        name: 'Reviews API',
        from: { componentId: 'storefront' },
        branches: [
          { componentId: 'reviews', label: '100%' },
          {
            componentId: 'reviews@star-ratings',
            label: 'copy 10%',
            copy: true,
          },
        ],
      },
    ]),
  },
};

const callers = ['storefront', 'storefront@buy-now', 'storefront@redesign'];

export const ManyLines: Story = {
  args: {
    project: {
      ...bookstore([
        {
          id: 'shop',
          name: 'Shop',
          from: { boundary: CellBounds.NorthBound },
          branches: [
            { componentId: 'storefront', label: '100%' },
            { componentId: 'storefront@buy-now', label: 'if cookie beta=yes' },
            {
              componentId: 'storefront@redesign',
              label: 'if header x-preview: green',
            },
          ],
        },
        ...callers.map(caller => ({
          id: 'reviews-api',
          name: 'Reviews API',
          from: { componentId: caller },
          branches: [
            { componentId: 'reviews', label: '100%' },
            { componentId: 'reviews@star-ratings', label: '0%', faded: true },
          ],
        })),
      ]),
      components: [
        ...callers.map((id, i) =>
          service(id, 'storefront', ['main', 'buy-now', 'redesign'][i], [
            'catalog',
            'reviews',
          ]),
        ),
        service('catalog', 'catalog'),
        service('reviews', 'reviews', 'main'),
        service('reviews@star-ratings', 'reviews', 'star-ratings'),
      ],
    },
  },
};
