import { create } from "zustand";
import { authService } from "./authService";
import type { User, LoginCredentials, RegisterCredentials } from "./types";

const TOKEN_STORAGE_KEY = "redblock.auth.token";
const USER_STORAGE_KEY = "redblock.auth.user";

/**
 * Authentication state
 */
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Authentication actions
 */
interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  clearError: () => void;
}

/**
 * Combined auth store type
 */
type AuthStore = AuthState & AuthActions;

/**
 * Load token from localStorage
 */
function loadToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Save token to localStorage
 */
function saveToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Remove token from localStorage
 */
function removeToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load user from localStorage
 */
function loadUser(): User | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

/**
 * Save user to localStorage
 */
function saveUser(user: User): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Remove user from localStorage
 */
function removeUser(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Authentication store using Zustand
 * 
 * @example
 * ```typescript
 * const { login, user, isAuthenticated } = useAuthStore();
 * 
 * await login({ email: "user@example.com", password: "password" });
 * ```
 */
export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  /**
   * Login with email and password
   */
  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(credentials);
      saveToken(response.access_token);
      saveUser(response.user);
      set({
        user: response.user,
        token: response.access_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Login failed";
      set({
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  /**
   * Register a new user
   */
  register: async (credentials: RegisterCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register(credentials);
      saveToken(response.access_token);
      saveUser(response.user);
      set({
        user: response.user,
        token: response.access_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Registration failed";
      set({
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  /**
   * Logout the current user
   */
  logout: async () => {
    const { token } = get();
    set({ isLoading: true, error: null });
    try {
      if (token) {
        await authService.logout(token);
      }
    } catch (error) {
      // Continue with logout even if API call fails
      console.error("Logout error:", error);
    } finally {
      removeToken();
      removeUser();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  /**
   * Refresh the access token
   */
  refreshToken: async () => {
    const { token } = get();
    if (!token) {
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const response = await authService.refresh(token);
      saveToken(response.access_token);
      saveUser(response.user);
      set({
        user: response.user,
        token: response.access_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      // If refresh fails, logout the user
      removeToken();
      removeUser();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: "Session expired. Please login again.",
      });
    }
  },

  /**
   * Load stored authentication from localStorage and validate the token
   */
  loadStoredAuth: async () => {
    const token = loadToken();
    const user = loadUser();
    
    if (!token || !user) {
      set({ isLoading: false });
      return;
    }

    // Set loading state while validating
    set({ isLoading: true });

    // Validate the token by calling the /me endpoint
    try {
      const validatedUser = await authService.getMe(token);
      set({
        user: validatedUser,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      // Token is invalid or expired, clear storage
      console.warn("Stored token is invalid or expired, clearing auth data");
      removeToken();
      removeUser();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  /**
   * Clear error message
   */
  clearError: () => {
    set({ error: null });
  },
}));
