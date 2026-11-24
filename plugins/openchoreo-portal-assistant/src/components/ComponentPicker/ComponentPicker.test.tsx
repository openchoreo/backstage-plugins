import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ComponentPicker } from './ComponentPicker';

// ``mock`` prefix: jest lets the hoisted factories below refer to it.
const mockQueryEntities = jest.fn();
// One instance, like the real useApi: a new one each render would start a
// new search each render.
const mockCatalogApi = {
  queryEntities: (...args: unknown[]) => mockQueryEntities(...args),
};

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: () => mockCatalogApi,
}));

jest.mock('@backstage/plugin-catalog-react', () => ({
  catalogApiRef: { id: 'plugin.catalog.service' },
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

const box = () => screen.getByRole('textbox', { name: 'Component to test on' });

async function open() {
  await act(async () => {
    fireEvent.mouseDown(box());
  });
}

describe('ComponentPicker', () => {
  it('lists Components when the check is not limited to a kind', async () => {
    render(<ComponentPicker kinds={[]} onTest={jest.fn()} />);

    await open();

    expect(await screen.findAllByRole('option')).toHaveLength(2);
    expect(mockQueryEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { kind: ['component'] },
        fullTextFilter: undefined,
        limit: 20,
      }),
    );
    expect(box()).toHaveAttribute('placeholder', 'Search components');
  });

  it('lists the kinds the check applies to', async () => {
    render(<ComponentPicker kinds={['API']} onTest={jest.fn()} />);

    await waitFor(() =>
      expect(mockQueryEntities).toHaveBeenCalledWith(
        expect.objectContaining({ filter: { kind: ['API'] } }),
      ),
    );
    expect(box()).toHaveAttribute('placeholder', 'Search apis');
  });

  it('searches the catalog for what is typed', async () => {
    render(<ComponentPicker kinds={[]} onTest={jest.fn()} />);

    await act(async () => {
      fireEvent.change(box(), { target: { value: 'ord' } });
    });

    await waitFor(() =>
      expect(mockQueryEntities).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fullTextFilter: {
            term: 'ord',
            fields: ['metadata.name', 'metadata.title'],
          },
        }),
      ),
    );
  });

  it('tests the picked entity by its full ref', async () => {
    const onTest = jest.fn();
    render(<ComponentPicker kinds={[]} onTest={onTest} />);
    const test = screen.getByRole('button', { name: 'Test' });
    expect(test).toBeDisabled();

    await open();
    const option = await screen.findByRole('option', { name: /Order API/ });
    // Its title, with the ref it will test.
    expect(option).toHaveTextContent('component:shop/order-api');
    await act(async () => {
      fireEvent.click(option);
    });
    await act(async () => {
      fireEvent.click(test);
    });

    expect(onTest).toHaveBeenCalledWith('component:shop/order-api');
  });

  it('can not test while turned off', async () => {
    render(<ComponentPicker kinds={[]} disabled onTest={jest.fn()} />);

    expect(box()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Test' })).toBeDisabled();
  });

  it('says when the catalog can not be read', async () => {
    mockQueryEntities.mockRejectedValue(new Error('down'));
    render(<ComponentPicker kinds={[]} onTest={jest.fn()} />);

    expect(
      await screen.findByText("Couldn't load components from the catalog."),
    ).toBeInTheDocument();
  });
});
