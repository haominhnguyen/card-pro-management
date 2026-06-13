import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from '../auth/tokenStore';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const axiosClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true, // send the httpOnly refresh cookie on auth calls
  headers: { 'Content-Type': 'application/json' },
});

// Bare client used ONLY for the refresh call so it bypasses the retry interceptor
// (prevents infinite refresh loops).
const refreshClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Notify the app (AuthContext) when the session is irrecoverably gone.
type AuthFailureHandler = () => void;
let onAuthFailure: AuthFailureHandler = () => {};
export const setOnAuthFailure = (handler: AuthFailureHandler): void => {
  onAuthFailure = handler;
};

// Attach the in-memory access token to every request.
axiosClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Dedupe concurrent refreshes: queued requests await the same in-flight refresh.
let refreshPromise: Promise<string> | null = null;

const doRefresh = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/api/auth/refresh')
      .then((res) => {
        const token = res.data.data.accessToken as string;
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

axiosClient.interceptors.response.use(
  // Backend wraps all responses in { data: ... } via TransformInterceptor — unwrap here
  (response) => response.data.data,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const url = original?.url ?? '';

    // Don't try to refresh for the auth endpoints themselves (a 401 there is a real
    // credential/session failure), and only retry once per request.
    const isAuthCall = url.includes('/api/auth/');

    if (status === 401 && !original?._retry && !isAuthCall) {
      original._retry = true;
      try {
        const token = await doRefresh();
        original.headers.Authorization = `Bearer ${token}`;
        return axiosClient(original);
      } catch {
        clearAccessToken();
        onAuthFailure();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
