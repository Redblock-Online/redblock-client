/**
 * User information returned from the backend
 */
export interface User {
  id: number;
  name: string;
  email: string;
}

/**
 * Authentication response from the backend
 */
export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration credentials
 */
export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

/**
 * Authentication error response
 */
export interface AuthError {
  message: string;
  errors?: Record<string, string[]>;
}
