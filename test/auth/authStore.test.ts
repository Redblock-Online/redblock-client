import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAuthStore } from "@/auth/authStore";
import { authService } from "@/auth/authService";
import type { AuthResponse } from "@/auth/types";

// Mock the authService
vi.mock("@/auth/authService", () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    getMe: vi.fn(),
  },
}));

describe("useAuthStore", () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    // Mock localStorage
    localStorageMock = {};
    const localStorageImpl = {
      getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      length: 0,
      clear: vi.fn(),
      key: vi.fn(),
    };
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => localStorageImpl);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("login", () => {
    it("should successfully login and update state", async () => {
      const mockResponse: AuthResponse = {
        access_token: "mock-token",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: 1,
          name: "Test User",
          email: "test@example.com",
        },
      };

      vi.mocked(authService.login).mockResolvedValueOnce(mockResponse);

      const { login } = useAuthStore.getState();
      await login({ email: "test@example.com", password: "password123" });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockResponse.user);
      expect(state.token).toBe(mockResponse.access_token);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should handle login error", async () => {
      const errorMessage = "Invalid credentials";
      vi.mocked(authService.login).mockRejectedValueOnce(new Error(errorMessage));

      const { login } = useAuthStore.getState();
      
      await expect(
        login({ email: "test@example.com", password: "wrong" })
      ).rejects.toThrow(errorMessage);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it("should save token and user to localStorage on successful login", async () => {
      const mockResponse: AuthResponse = {
        access_token: "mock-token",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: 1,
          name: "Test User",
          email: "test@example.com",
        },
      };

      vi.mocked(authService.login).mockResolvedValueOnce(mockResponse);

      const { login } = useAuthStore.getState();
      await login({ email: "test@example.com", password: "password123" });

      expect(localStorageMock["redblock.auth.token"]).toBe("mock-token");
      expect(localStorageMock["redblock.auth.user"]).toBe(JSON.stringify(mockResponse.user));
    });
  });

  describe("register", () => {
    it("should successfully register and update state", async () => {
      const mockResponse: AuthResponse = {
        access_token: "mock-token",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: 2,
          name: "New User",
          email: "newuser@example.com",
        },
      };

      vi.mocked(authService.register).mockResolvedValueOnce(mockResponse);

      const { register } = useAuthStore.getState();
      await register({
        name: "New User",
        email: "newuser@example.com",
        password: "password123",
        password_confirmation: "password123",
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockResponse.user);
      expect(state.token).toBe(mockResponse.access_token);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should handle registration error", async () => {
      const errorMessage = "Email already exists";
      vi.mocked(authService.register).mockRejectedValueOnce(new Error(errorMessage));

      const { register } = useAuthStore.getState();
      
      await expect(
        register({
          name: "New User",
          email: "existing@example.com",
          password: "password123",
          password_confirmation: "password123",
        })
      ).rejects.toThrow(errorMessage);

      const state = useAuthStore.getState();
      expect(state.error).toBe(errorMessage);
    });
  });

  describe("logout", () => {
    it("should successfully logout and clear state", async () => {
      // Set initial authenticated state
      useAuthStore.setState({
        user: { id: 1, name: "Test User", email: "test@example.com" },
        token: "mock-token",
        isAuthenticated: true,
      });

      vi.mocked(authService.logout).mockResolvedValueOnce(undefined);

      const { logout } = useAuthStore.getState();
      await logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should clear localStorage on logout", async () => {
      localStorageMock["redblock.auth.token"] = "mock-token";
      localStorageMock["redblock.auth.user"] = JSON.stringify({ id: 1, name: "Test User", email: "test@example.com" });

      useAuthStore.setState({
        user: { id: 1, name: "Test User", email: "test@example.com" },
        token: "mock-token",
        isAuthenticated: true,
      });

      vi.mocked(authService.logout).mockResolvedValueOnce(undefined);

      const { logout } = useAuthStore.getState();
      await logout();

      expect(localStorageMock["redblock.auth.token"]).toBeUndefined();
      expect(localStorageMock["redblock.auth.user"]).toBeUndefined();
    });

    it("should logout even if API call fails", async () => {
      useAuthStore.setState({
        user: { id: 1, name: "Test User", email: "test@example.com" },
        token: "mock-token",
        isAuthenticated: true,
      });

      vi.mocked(authService.logout).mockRejectedValueOnce(new Error("Network error"));

      const { logout } = useAuthStore.getState();
      await logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("refreshToken", () => {
    it("should successfully refresh token", async () => {
      useAuthStore.setState({
        token: "old-token",
        user: { id: 1, name: "Test User", email: "test@example.com" },
        isAuthenticated: true,
      });

      const mockResponse: AuthResponse = {
        access_token: "new-token",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: 1,
          name: "Test User",
          email: "test@example.com",
        },
      };

      vi.mocked(authService.refresh).mockResolvedValueOnce(mockResponse);

      const { refreshToken } = useAuthStore.getState();
      await refreshToken();

      const state = useAuthStore.getState();
      expect(state.token).toBe("new-token");
      expect(state.isAuthenticated).toBe(true);
    });

    it("should logout on failed refresh", async () => {
      useAuthStore.setState({
        token: "expired-token",
        user: { id: 1, name: "Test User", email: "test@example.com" },
        isAuthenticated: true,
      });

      vi.mocked(authService.refresh).mockRejectedValueOnce(new Error("Token expired"));

      const { refreshToken } = useAuthStore.getState();
      await refreshToken();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe("Session expired. Please login again.");
    });

    it("should do nothing if no token exists", async () => {
      useAuthStore.setState({
        token: null,
        user: null,
        isAuthenticated: false,
      });

      const { refreshToken } = useAuthStore.getState();
      await refreshToken();

      expect(authService.refresh).not.toHaveBeenCalled();
    });
  });

  describe("loadStoredAuth", () => {
    it("should load stored authentication from localStorage", () => {
      const mockUser = { id: 1, name: "Test User", email: "test@example.com" };
      localStorageMock["redblock.auth.token"] = "stored-token";
      localStorageMock["redblock.auth.user"] = JSON.stringify(mockUser);

      const { loadStoredAuth } = useAuthStore.getState();
      loadStoredAuth();

      const state = useAuthStore.getState();
      expect(state.token).toBe("stored-token");
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it("should not load if token or user is missing", () => {
      localStorageMock["redblock.auth.token"] = "stored-token";
      // No user in localStorage

      const { loadStoredAuth } = useAuthStore.getState();
      loadStoredAuth();

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("clearError", () => {
    it("should clear error message", () => {
      useAuthStore.setState({ error: "Some error" });

      const { clearError } = useAuthStore.getState();
      clearError();

      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });
  });
});
