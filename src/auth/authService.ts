import type { AuthResponse, LoginCredentials, RegisterCredentials, User } from "./types";

// Re-export types for convenience
export type { LoginCredentials, RegisterCredentials };

/**
 * Get the backend API URL from environment variables
 */
function getBackendUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL is not defined in environment variables");
  }
  return url;
}

/**
 * Authentication service for handling JWT authentication with the backend
 */
export class AuthService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = getBackendUrl();
  }

  /**
   * Register a new user
   * 
   * @param credentials - User registration credentials
   * @returns Authentication response with token and user data
   * @throws Error if registration fails
   * 
   * @example
   * ```typescript
   * const authService = new AuthService();
   * const response = await authService.register({
   *   name: "John Doe",
   *   email: "john@example.com",
   *   password: "securePassword123",
   *   password_confirmation: "securePassword123"
   * });
   * ```
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Registration failed");
    }

    return response.json();
  }

  /**
   * Login with email and password
   * 
   * @param credentials - User login credentials
   * @returns Authentication response with token and user data
   * @throws Error if login fails
   * 
   * @example
   * ```typescript
   * const authService = new AuthService();
   * const response = await authService.login({
   *   email: "john@example.com",
   *   password: "securePassword123"
   * });
   * ```
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    return response.json();
  }

  /**
   * Get current user information
   * 
   * @param token - JWT access token
   * @returns User information
   * @throws Error if request fails
   * 
   * @example
   * ```typescript
   * const authService = new AuthService();
   * const user = await authService.getMe(token);
   * ```
   */
  async getMe(token: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/api/auth/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get user information");
    }

    return response.json();
  }

  /**
   * Logout the current user
   * 
   * @param token - JWT access token
   * @throws Error if logout fails
   * 
   * @example
   * ```typescript
   * const authService = new AuthService();
   * await authService.logout(token);
   * ```
   */
  async logout(token: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Logout failed");
    }
  }

  /**
   * Refresh the access token
   * 
   * @param token - Current JWT access token
   * @returns New authentication response with refreshed token
   * @throws Error if refresh fails
   * 
   * @example
   * ```typescript
   * const authService = new AuthService();
   * const response = await authService.refresh(token);
   * ```
   */
  async refresh(token: string): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Token refresh failed");
    }

    return response.json();
  }
}

/**
 * Singleton instance of the auth service
 * Lazy initialization to avoid issues with environment variables during tests
 */
let authServiceInstance: AuthService | null = null;

export const authService = {
  get instance(): AuthService {
    if (!authServiceInstance) {
      authServiceInstance = new AuthService();
    }
    return authServiceInstance;
  },
  
  // Proxy methods for convenience
  login: (credentials: LoginCredentials) => authService.instance.login(credentials),
  register: (credentials: RegisterCredentials) => authService.instance.register(credentials),
  getMe: (token: string) => authService.instance.getMe(token),
  logout: (token: string) => authService.instance.logout(token),
  refresh: (token: string) => authService.instance.refresh(token),
};
