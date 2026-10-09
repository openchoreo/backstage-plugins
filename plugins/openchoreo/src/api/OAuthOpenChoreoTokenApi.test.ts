import { OAuthOpenChoreoTokenApi } from './OAuthOpenChoreoTokenApi';

const sessionState = { subscribe: jest.fn(), '[Symbol.observable]': jest.fn() };

const oauthApi = {
  getAccessToken: jest.fn(),
  getIdToken: jest.fn(),
  getProfile: jest.fn(),
  getBackstageIdentity: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  sessionState$: jest.fn(() => sessionState),
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  oauthApi.sessionState$.mockReturnValue(sessionState);
});

describe('OAuthOpenChoreoTokenApi', () => {
  it('passes request options through to the OAuth provider', async () => {
    oauthApi.getAccessToken.mockResolvedValue('token');
    const api = new OAuthOpenChoreoTokenApi(oauthApi);

    await expect(api.getToken({ optional: true })).resolves.toBe('token');
    expect(oauthApi.getAccessToken).toHaveBeenCalledWith(undefined, {
      optional: true,
    });
  });

  it('opens the login popup directly when signing in', async () => {
    oauthApi.getAccessToken.mockResolvedValue('token');
    const api = new OAuthOpenChoreoTokenApi(oauthApi);

    await api.signIn();

    expect(oauthApi.getAccessToken).toHaveBeenCalledWith(undefined, {
      instantPopup: true,
    });
  });

  it('exposes the provider session state', () => {
    const api = new OAuthOpenChoreoTokenApi(oauthApi);

    expect(api.sessionState$()).toBe(sessionState);
  });
});
