import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthService } from "@/auth/authService";
import type { AuthResponse, LoginCredentials, RegisterCredentials, User } from "@/auth/types";

// Mock environment variable before importing
vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "https://test-api.redblock.online");

describe("AuthService", () => {
  let authService: AuthService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    
    authService = new AuthService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("login", () => {
    it("should successfully login with valid credentials", async () => {
      const credentials: LoginCredentials = {
        email: "test@example.com",
        password: "password123",
      };

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

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authService.login(credentials);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://test-api.redblock.online/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(credentials),
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should throw error on failed login", async () => {
      const credentials: LoginCredentials = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Invalid credentials" }),
      });

      await expect(authService.login(credentials)).rejects.toThrow("Invalid credentials");
    });
  });

  describe("register", () => {
    it("should successfully register a new user", async () => {
      const credentials: RegisterCredentials = {
        name: "New User",
        email: "newuser@example.com",
        password: "password123",
        password_confirmation: "password123",
      };

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

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authService.register(credentials);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://test-api.redblock.online/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(credentials),
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should throw error on failed registration", async () => {
      const credentials: RegisterCredentials = {
        name: "New User",
        email: "invalid-email",
        password: "password123",
        password_confirmation: "password123",
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Invalid email format" }),
      });

      await expect(authService.register(credentials)).rejects.toThrow("Invalid email format");
    });
  });

  describe("getMe", () => {
    it("should successfully get user information", async () => {
      const token = "mock-token";
      const mockUser: User = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const result = await authService.getMe(token);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://test-api.redblock.online/api/auth/me",
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      expect(result).toEqual(mockUser);
    });

    it("should throw error with invalid token", async () => {
      const token = "invalid-token";

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Unauthorized" }),
      });

      await expect(authService.getMe(token)).rejects.toThrow("Unauthorized");
    });
  });

  describe("logout", () => {
    it("should successfully logout", async () => {
      const token = "mock-token";

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await authService.logout(token);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://test-api.redblock.online/api/auth/logout",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    });

    it("should throw error on failed logout", async () => {
      const token = "invalid-token";

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Logout failed" }),
      });

      await expect(authService.logout(token)).rejects.toThrow("Logout failed");
    });
  });

  describe("refresh", () => {
    it("should successfully refresh token", async () => {
      const token = "old-token";
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

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authService.refresh(token);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://test-api.redblock.online/api/auth/refresh",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should throw error on failed refresh", async () => {
      const token = "expired-token";

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Token expired" }),
      });

      await expect(authService.refresh(token)).rejects.toThrow("Token expired");
    });
  });

  describe("constructor", () => {
    it("should throw error if NEXT_PUBLIC_BACKEND_URL is not defined", () => {
      vi.unstubAllEnvs();
      
      expect(() => new AuthService()).toThrow(
        "NEXT_PUBLIC_BACKEND_URL is not defined in environment variables"
      );
      
      // Restore the env variable for other tests
      vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "https://test-api.redblock.online");
    });
  });
});
