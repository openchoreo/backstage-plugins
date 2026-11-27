import { act, fireEvent, render, screen } from '@testing-library/react';
import { ComponentPicker } from './ComponentPicker';

// ``mock`` prefix: jest lets the hoisted factories below refer to it.
const mockQueryEntities = jest.fn();
// One instance, like the real useApi: a new one each render would start a
// new search each render. It stands in for the catalog and config APIs the
// check form's entity field reads.
const mockApi = {
  queryEntities: (...args: unknown[]) => mockQueryEntities(...args),
  getEntityFacets: async () => ({ facets: { kind: [] } }),
  getOptionalString: () => undefined,
  getOptionalConfig: () => undefined,
};

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: () => mockApi,
}));

const entity = (name: string, namespace = 'default', title?: string) => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name, namespace, ...(title ? { title } : {}) },
});

beforeEach(() => {
  mockQueryEntities.mockReset();
  mockQueryEntities.mockResolvedValue({
    items: [entity('order-api', 'shop', 'Order API'), entity('cart')],
  });
});

const box = () => screen.getByRole('textbox', { name: 'Entity to test on' });

describe('ComponentPicker', () => {
  it('searches every kind when the check is not limited to one', async () => {
    render(<ComponentPicker kinds={[]} onTest={jest.fn()} />);

    await act(async () => {
      fireEvent.mouseDown(box());
    });

    expect(mockQueryEntities).toHaveBeenCalledWith(
      expect.objectContaining({ filter: undefined }),
    );
  });

  it('lists the kinds the check applies to', async () => {
    render(<ComponentPicker kinds={['API']} onTest={jest.fn()} />);

    await act(async () => {
      fireEvent.mouseDown(box());
    });

    expect(mockQueryEntities).toHaveBeenCalledWith(
      expect.objectContaining({ filter: { kind: ['API'] } }),
    );
  });

  it('tests the picked entity by its full ref', async () => {
    const onTest = jest.fn();
    render(<ComponentPicker kinds={[]} onTest={onTest} />);
    const test = screen.getByRole('button', { name: 'Test' });
    expect(test).toBeDisabled();

    await act(async () => {
      fireEvent.focus(box());
      fireEvent.mouseDown(box());
    });
    const option = await screen.findByRole('option', { name: /Order API/ });
    await act(async () => {
      fireEvent.click(option);
    });
    await act(async () => {
      fireEvent.click(test);
    });

    expect(onTest).toHaveBeenCalledWith('component:shop/order-api');
  });

  it('can not test a name without its kind and namespace', async () => {
    render(<ComponentPicker kinds={[]} onTest={jest.fn()} />);

    await act(async () => {
      fireEvent.change(box(), { target: { value: 'order-api' } });
    });

    expect(screen.getByRole('button', { name: 'Test' })).toBeDisabled();
  });

  it('can not test while turned off', async () => {
    render(<ComponentPicker kinds={[]} disabled onTest={jest.fn()} />);

    expect(box()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Test' })).toBeDisabled();
  });
});
