import { endpointFollowMessage } from './endpointFollowMessage';

const empty = { bound: [], removed: [], skipped: [], failed: [] };

describe('endpointFollowMessage', () => {
  it('says nothing when the component owns no Endpoints', () => {
    expect(endpointFollowMessage(undefined, 'promoted')).toBeUndefined();
    expect(endpointFollowMessage(empty, 'promoted')).toBeUndefined();
  });

  it('names the Endpoints that followed', () => {
    expect(
      endpointFollowMessage(
        {
          ...empty,
          bound: [{ endpoint: 'orders-api', releaseName: 'orders-api-r1' }],
          skipped: ['orders-auto'],
        },
        'promoted',
      ),
    ).toEqual({
      text: 'Endpoints promoted: orders-api. Endpoints deployed automatically: orders-auto.',
      failed: false,
    });
    expect(
      endpointFollowMessage(
        { ...empty, removed: ['orders-api'] },
        'undeployed',
      ),
    ).toEqual({ text: 'Endpoints removed: orders-api.', failed: false });
  });

  it('names the ones that did not follow, and why', () => {
    expect(
      endpointFollowMessage(
        {
          ...empty,
          failed: [
            { endpoint: 'orders-new', reason: 'it has no release yet' },
            { endpoint: '', reason: 'forbidden' },
          ],
        },
        'deployed',
      ),
    ).toEqual({
      text: "Endpoints that didn't follow: orders-new (it has no release yet); forbidden. Deploy, promote or remove them from each Endpoint's Deploy tab.",
      failed: true,
    });
  });
});
