import axiosClient from './axiosClient';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  name: string;
  password: string;
}

/** register() no longer logs in — the account is created only after email OTP verification. */
export interface PendingVerification {
  requiresVerification: true;
  email: string;
}

export interface VerifyRegistrationPayload {
  email: string;
  otp: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  password: string;
}

export interface SimpleResult {
  success: boolean;
  message: string;
}

export const authApi = {
  login: (data: LoginPayload): Promise<AuthSession> =>
    axiosClient.post('/api/auth/login', data),
  register: (data: RegisterPayload): Promise<PendingVerification> =>
    axiosClient.post('/api/auth/register', data),
  verifyRegistration: (data: VerifyRegistrationPayload): Promise<AuthSession> =>
    axiosClient.post('/api/auth/verify-registration', data),
  resendRegistrationOtp: (email: string): Promise<SimpleResult> =>
    axiosClient.post('/api/auth/resend-registration-otp', { email }),
  refresh: (): Promise<AuthSession> => axiosClient.post('/api/auth/refresh'),
  logout: (): Promise<{ success: boolean }> => axiosClient.post('/api/auth/logout'),
  me: (): Promise<AuthUser> => axiosClient.get('/api/auth/me'),
  forgotPassword: (email: string): Promise<SimpleResult> =>
    axiosClient.post('/api/auth/forgot-password', { email }),
  resetPassword: (data: ResetPasswordPayload): Promise<SimpleResult> =>
    axiosClient.post('/api/auth/reset-password', data),
};
