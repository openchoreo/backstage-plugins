/*
 * Cookie manager for OpenChoreo IDP access tokens.
 *
 * Stores the IDP access token in an HttpOnly cookie so it's automatically
 * sent with all requests, including permission checks.
 *
 * Based on Backstage's OAuthCookieManager pattern.
 */

import { CookieOptions, Request, Response } from 'express';

const COOKIE_NAME = 'openchoreo-idp-token';
const MAX_COOKIE_SIZE = 4000;
const THOUSAND_DAYS_MS = 1000 * 24 * 60 * 60 * 1000;

export interface IdpTokenCookieManagerOptions {
  /** Base URL of the backend (e.g., http://localhost:7007) */
  baseUrl: string;
  /** Base URL of the app (e.g., http://localhost:3000) */
  appUrl: string;
  /** Session duration in milliseconds. Defaults to 1000 days. */
  sessionDurationMs?: number;
}

/**
 * Manages the IDP access token cookie for OpenChoreo authentication.
 *
 * The cookie is:
 * - HttpOnly: prevents XSS access
 * - Secure: only sent over HTTPS in production
 * - SameSite: 'lax' by default, 'none' for cross-origin setups
 */
export class IdpTokenCookieManager {
  private readonly maxAge: number;
  private readonly secure: boolean;
  private readonly sameSite: 'lax' | 'none' | 'strict';
  private readonly path: string;

  constructor(options: IdpTokenCookieManagerOptions) {
    const { baseUrl, appUrl, sessionDurationMs } = options;

    this.maxAge = sessionDurationMs ?? THOUSAND_DAYS_MS;

    const backendUrl = new URL(baseUrl);
    const frontendUrl = new URL(appUrl);

    // Use secure cookies if backend is HTTPS
    this.secure = backendUrl.protocol === 'https:';

    // If frontend and backend are on different domains, need SameSite=none
    // But this only works with secure cookies
    if (backendUrl.hostname !== frontendUrl.hostname && this.secure) {
      this.sameSite = 'none';
    } else {
      this.sameSite = 'lax';
    }

    // Path scoped to /api to cover all backend routes
    this.path = '/api';
  }

  private getCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: this.sameSite,
      path: this.path,
      maxAge: this.maxAge,
    };
  }

  /**
   * Sets the IDP access token cookie.
   */
  setToken(res: Response, token: string): void {
    if (token.length > MAX_COOKIE_SIZE) {
      // For very large tokens, we'd need chunking like Backstage does
      // For now, just set it and let the browser handle truncation warning
      console.warn(
        `IDP token exceeds recommended cookie size (${token.length} > ${MAX_COOKIE_SIZE})`,
      );
    }

    res.cookie(COOKIE_NAME, token, this.getCookieOptions());
  }

  /**
   * Gets the IDP access token from the request cookies.
   */
  getToken(req: Request): string | undefined {
    return req.cookies?.[COOKIE_NAME];
  }

  /**
   * Removes the IDP access token cookie.
   */
  removeToken(res: Response): void {
    res.cookie(COOKIE_NAME, '', {
      ...this.getCookieOptions(),
      maxAge: 0,
    });
  }

  /**
   * The cookie name used for the IDP token.
   */
  static get cookieName(): string {
    return COOKIE_NAME;
  }
}
