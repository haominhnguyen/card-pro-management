/**
 * Access token lives in memory only (never localStorage) to limit XSS exposure.
 * On page reload it's gone — the app rehydrates by calling /auth/refresh, which
 * uses the httpOnly refresh cookie the browser sends automatically.
 */
let accessToken: string | null = null;

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const clearAccessToken = (): void => {
  accessToken = null;
};
