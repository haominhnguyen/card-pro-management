import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Spin } from 'antd';
import {
  authApi,
  type AuthUser,
  type LoginPayload,
  type RegisterPayload,
  type VerifyRegistrationPayload,
} from '../api/authApi';
import { setOnAuthFailure } from '../api/axiosClient';
import { setAccessToken, clearAccessToken } from './tokenStore';
import { queryClient } from '../hooks/queryClient';
import { isDemo, enterDemoMode, exitDemoMode, DEMO_USER } from '../demo/demoMode';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** true when running in trial / experience mode (no real session). */
  demo: boolean;
  login: (data: LoginPayload) => Promise<void>;
  /** Step 1: submit details → backend emails an OTP. Does NOT create a session. */
  register: (data: RegisterPayload) => Promise<void>;
  /** Step 2: confirm the emailed OTP → account created and logged in. */
  verifyRegistration: (data: VerifyRegistrationPayload) => Promise<void>;
  /** Enter trial mode — full app, in-memory seeded data, no backend. */
  enterDemo: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [demo, setDemo] = useState(isDemo());

  const clearSession = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus('unauthenticated');
    queryClient.clear();
  }, []);

  // Rehydrate on load. In trial mode (flag survives reloads via sessionStorage)
  // skip the network refresh entirely and restore the in-memory demo session.
  useEffect(() => {
    if (isDemo()) {
      setUser(DEMO_USER);
      setStatus('authenticated');
      setDemo(true);
      return;
    }
    let active = true;
    authApi
      .refresh()
      .then((session) => {
        if (!active) return;
        setAccessToken(session.accessToken);
        setUser(session.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        clearAccessToken();
        setStatus('unauthenticated');
      });
    return () => {
      active = false;
    };
  }, []);

  // When a protected request can't be refreshed, the axios interceptor calls this.
  useEffect(() => {
    setOnAuthFailure(() => {
      clearAccessToken();
      setUser(null);
      setStatus('unauthenticated');
    });
  }, []);

  const login = useCallback(async (data: LoginPayload) => {
    const session = await authApi.login(data);
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
    queryClient.invalidateQueries();
  }, []);

  const register = useCallback(async (data: RegisterPayload) => {
    // Triggers the verification email; the session is established later, in verifyRegistration.
    await authApi.register(data);
  }, []);

  const verifyRegistration = useCallback(async (data: VerifyRegistrationPayload) => {
    const session = await authApi.verifyRegistration(data);
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
    queryClient.invalidateQueries();
  }, []);

  const enterDemo = useCallback(() => {
    enterDemoMode();
    setDemo(true);
    setUser(DEMO_USER);
    setStatus('authenticated');
    queryClient.invalidateQueries();
  }, []);

  const logout = useCallback(async () => {
    // Trial mode has no server session — just drop the local one.
    if (isDemo()) {
      exitDemoMode();
      setDemo(false);
      clearSession();
      return;
    }
    try {
      await authApi.logout();
    } catch {
      // Even if the server call fails, drop the local session.
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, status, demo, login, register, verifyRegistration, enterDemo, logout }),
    [user, status, demo, login, register, verifyRegistration, enterDemo, logout],
  );

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spin size="large" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
