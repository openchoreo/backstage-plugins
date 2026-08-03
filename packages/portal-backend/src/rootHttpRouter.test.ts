import { portalRootHttpRouterServiceFactory } from './rootHttpRouter';

describe('portalRootHttpRouterServiceFactory', () => {
  it('overrides the root HTTP router service', () => {
    const factory = portalRootHttpRouterServiceFactory as any;
    expect(factory.$$type).toBe('@backstage/BackendFeature');
    expect(factory.service.id).toBe('core.rootHttpRouter');
    expect(factory.service.scope).toBe('root');
  });
});
