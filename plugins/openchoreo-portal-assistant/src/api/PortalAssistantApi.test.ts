import {
  BACKSTAGE_IDENTITY_HEADER,
  PortalAssistantClient,
} from './PortalAssistantApi';

/**
 * The headers streamChat sends. The fake response fails, so the test stops
 * right after the request without needing a streaming body.
 */
async function chatHeaders(
  getCredentials: () => Promise<{ token?: string }>,
): Promise<Record<string, string>> {
  const fetch = jest.fn(async () => ({
    ok: false,
    statusText: 'stop here',
    json: async () => ({}),
  }));
  const client = new PortalAssistantClient({
    discoveryApi: { getBaseUrl: async () => 'http://backstage/api/x' } as any,
    fetchApi: { fetch } as any,
    identityApi: { getCredentials } as any,
  });

  await expect(
    client.streamChat({ messages: [] } as any, () => {}),
  ).rejects.toThrow('stop here');

  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('http://backstage/api/x/api/v1alpha1/portal-assistant/chat');
  return init.headers as Record<string, string>;
}

describe('PortalAssistantClient.streamChat', () => {
  it("sends the signed-in user's Backstage token in its own header", async () => {
    const headers = await chatHeaders(async () => ({ token: 'user-token' }));

    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'x-openchoreo-direct': 'true',
      [BACKSTAGE_IDENTITY_HEADER]: 'user-token',
    });
  });

  it('leaves the header out when there is no token', async () => {
    const headers = await chatHeaders(async () => ({}));

    expect(headers).not.toHaveProperty(BACKSTAGE_IDENTITY_HEADER);
    expect(headers['x-openchoreo-direct']).toBe('true');
  });

  it('still sends the chat when the token cannot be read', async () => {
    const headers = await chatHeaders(async () => {
      throw new Error('session expired');
    });

    expect(headers).not.toHaveProperty(BACKSTAGE_IDENTITY_HEADER);
  });
});
