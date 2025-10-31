import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { get, post, put, del, apiFetch } from "@/ui/react/api/http";

// Mock fetch
global.fetch = vi.fn();

describe("HTTP API with JWT Token", () => {
  let localStorageMock: Record<string, string>;
  let fetchCallCount: number;

  beforeEach(() => {
    fetchCallCount = 0;
    
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

    // Mock document.cookie for CSRF token
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "XSRF-TOKEN=test-csrf-token",
    });

    // Mock fetch response
    vi.mocked(fetch).mockImplementation(async () => {
      fetchCallCount++;
      return {
        ok: true,
        json: async () => ({ success: true }),
        headers: new Headers(),
        status: 200,
        statusText: "OK",
      } as Response;
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("JWT Token Injection", () => {
    it("should add Authorization header with JWT token for GET requests", async () => {
      localStorageMock["redblock.auth.token"] = "test-jwt-token";

      await get("/api/users");

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.any(Headers),
        })
      );

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = callArgs[1]?.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer test-jwt-token");
    });

    it("should add Authorization header with JWT token for POST requests", async () => {
      localStorageMock["redblock.auth.token"] = "test-jwt-token";

      await post("/api/users", { name: "John" });

      // Find the POST request (not the CSRF request)
      const postCall = vi.mocked(fetch).mock.calls.find(call => 
        call[0]?.toString().includes("/api/users") && call[1]?.method === "POST"
      );
      expect(postCall).toBeDefined();
      const headers = postCall![1]?.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer test-jwt-token");
    });

    it("should add Authorization header with JWT token for PUT requests", async () => {
      localStorageMock["redblock.auth.token"] = "test-jwt-token";

      await put("/api/users/1", { name: "John Updated" });

      // Find the PUT request (not the CSRF request)
      const putCall = vi.mocked(fetch).mock.calls.find(call => 
        call[0]?.toString().includes("/api/users/1") && call[1]?.method === "PUT"
      );
      expect(putCall).toBeDefined();
      const headers = putCall![1]?.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer test-jwt-token");
    });

    it("should add Authorization header with JWT token for DELETE requests", async () => {
      localStorageMock["redblock.auth.token"] = "test-jwt-token";

      await del("/api/users/1");

      // Find the DELETE request (not the CSRF request)
      const delCall = vi.mocked(fetch).mock.calls.find(call => 
        call[0]?.toString().includes("/api/users/1") && call[1]?.method === "DELETE"
      );
      expect(delCall).toBeDefined();
      const headers = delCall![1]?.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer test-jwt-token");
    });

    it("should not add Authorization header if no token exists", async () => {
      // No token in localStorage

      await get("/api/users");

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = callArgs[1]?.headers as Headers;
      expect(headers.get("Authorization")).toBeNull();
    });

    it("should handle localStorage errors gracefully", async () => {
      // Mock localStorage to throw error
      vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
        throw new Error("localStorage not available");
      });

      await get("/api/users");

      // Should not throw and should make the request without token
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe("Content-Type Header", () => {
    it("should set Content-Type to application/json for POST with json body", async () => {
      await post("/api/users", { name: "John" });

      const postCall = vi.mocked(fetch).mock.calls.find(call => 
        call[0]?.toString().includes("/api/users") && call[1]?.method === "POST"
      );
      const headers = postCall![1]?.headers as Headers;
      expect(headers.get("Content-Type")).toBe("application/json");
    });

    it("should set Content-Type to application/json for PUT with json body", async () => {
      await put("/api/users/1", { name: "John" });

      const putCall = vi.mocked(fetch).mock.calls.find(call => 
        call[0]?.toString().includes("/api/users/1") && call[1]?.method === "PUT"
      );
      const headers = putCall![1]?.headers as Headers;
      expect(headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("Request Body", () => {
    it("should stringify json body for POST requests", async () => {
      const data = { name: "John", email: "john@example.com" };
      await post("/api/users", data);

      const postCall = vi.mocked(fetch).mock.calls.find(call => 
        call[0]?.toString().includes("/api/users") && call[1]?.method === "POST"
      );
      expect(postCall![1]?.body).toBe(JSON.stringify(data));
    });

    it("should stringify json body for PUT requests", async () => {
      const data = { name: "John Updated" };
      await put("/api/users/1", data);

      const putCall = vi.mocked(fetch).mock.calls.find(call => 
        call[0]?.toString().includes("/api/users/1") && call[1]?.method === "PUT"
      );
      expect(putCall![1]?.body).toBe(JSON.stringify(data));
    });
  });

  describe("Credentials", () => {
    it("should include credentials in all requests", async () => {
      await get("/api/users");

      const callArgs = vi.mocked(fetch).mock.calls[0];
      expect(callArgs[1]?.credentials).toBe("include");
    });
  });

  describe("URL Building", () => {
    it("should build correct URL for relative paths", async () => {
      await get("/api/users");

      const callArgs = vi.mocked(fetch).mock.calls[0];
      expect(callArgs[0]).toContain("/api/users");
    });

    it("should handle absolute URLs", async () => {
      await get("https://example.com/api/users");

      const callArgs = vi.mocked(fetch).mock.calls[0];
      expect(callArgs[0]).toBe("https://example.com/api/users");
    });
  });
});
