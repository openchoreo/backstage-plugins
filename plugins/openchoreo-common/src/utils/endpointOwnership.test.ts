import {
  endpointManagingComponent,
  endpointManagingReleaseLine,
} from './endpointOwnership';

describe('endpointManagingComponent', () => {
  it('returns the owning component', () => {
    expect(
      endpointManagingComponent({
        projectName: 'store',
        componentName: 'orders',
      }),
    ).toBe('orders');
  });

  it('is undefined for an Endpoint its project owns', () => {
    expect(endpointManagingComponent({ projectName: 'store' })).toBeUndefined();
    expect(
      endpointManagingComponent({ projectName: 'store', componentName: '' }),
    ).toBeUndefined();
    expect(endpointManagingComponent(undefined)).toBeUndefined();
  });
});

describe('endpointManagingReleaseLine', () => {
  it('returns the owning release line', () => {
    expect(
      endpointManagingReleaseLine({
        projectName: 'store',
        componentName: 'orders',
        releaseLineName: 'next',
      }),
    ).toBe('next');
  });

  it("returns '' for the component's main line", () => {
    expect(
      endpointManagingReleaseLine({
        projectName: 'store',
        componentName: 'orders',
      }),
    ).toBe('');
  });

  it('is undefined when no component owns the Endpoint', () => {
    expect(
      endpointManagingReleaseLine({
        projectName: 'store',
        releaseLineName: 'next',
      }),
    ).toBeUndefined();
  });
});
