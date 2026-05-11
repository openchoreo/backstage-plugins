import { OpenChoreoEventRouter } from './OpenChoreoEventRouter';

// `determineSubTopic` is protected on `SubTopicEventRouter`. Subclassing to
// expose it is cleaner than poking through `as any` at every call site, and
// keeps the test honest about what is and isn't part of the public surface.
class TestableRouter extends OpenChoreoEventRouter {
  callDetermineSubTopic(payload: unknown): string | undefined {
    return this.determineSubTopic({
      topic: 'openchoreo',
      eventPayload: payload,
    });
  }
}

function newRouter(): TestableRouter {
  // The events service is unused by `determineSubTopic` itself, so a no-op
  // stub is sufficient for these unit tests. The real subscription path is
  // exercised by the integration tests in OpenChoreoEntityProvider.
  const events = {
    publish: jest.fn(),
    subscribe: jest.fn(),
  } as any;
  return new TestableRouter({ events });
}

describe('OpenChoreoEventRouter.determineSubTopic', () => {
  it('returns the lowercased kind so it composes to "openchoreo.<kind>"', () => {
    const router = newRouter();
    expect(router.callDetermineSubTopic({ kind: 'Component' })).toBe(
      'component',
    );
    expect(router.callDetermineSubTopic({ kind: 'DeploymentPipeline' })).toBe(
      'deploymentpipeline',
    );
    expect(router.callDetermineSubTopic({ kind: 'ClusterTrait' })).toBe(
      'clustertrait',
    );
  });

  it('returns undefined when the payload has no kind field', () => {
    const router = newRouter();
    expect(
      router.callDetermineSubTopic({ name: 'order-service' }),
    ).toBeUndefined();
  });

  it('returns undefined when kind is not a string', () => {
    const router = newRouter();
    expect(router.callDetermineSubTopic({ kind: 42 })).toBeUndefined();
    expect(router.callDetermineSubTopic({ kind: null })).toBeUndefined();
    expect(router.callDetermineSubTopic({ kind: { x: 1 } })).toBeUndefined();
  });

  it('returns undefined when the payload itself is empty', () => {
    const router = newRouter();
    expect(router.callDetermineSubTopic({})).toBeUndefined();
  });
});
