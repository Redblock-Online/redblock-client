import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginForm from "@/auth/components/LoginForm";
import { useAuthStore } from "@/auth/authStore";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock the auth store
vi.mock("@/auth/authStore", () => ({
  useAuthStore: vi.fn(),
}));

describe("LoginForm", () => {
  const mockLogin = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();

    // Default mock implementation
    vi.mocked(useAuthStore).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      isAuthenticated: false,
      user: null,
      token: null,
      register: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      loadStoredAuth: vi.fn(),
    });
  });

  it("should render login form with all fields", () => {
    render(<LoginForm />);

    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  it("should handle email input change", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    await user.type(emailInput, "test@example.com");

    expect(emailInput).toHaveValue("test@example.com");
  });

  it("should handle password input change", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const passwordInput = screen.getByPlaceholderText("••••••••");
    await user.type(passwordInput, "password123");

    expect(passwordInput).toHaveValue("password123");
  });

  it("should toggle password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const passwordInput = screen.getByPlaceholderText("••••••••");
    const toggleButton = screen.getByRole("button", { name: /show password/i });

    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("should submit form with valid credentials", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);

    render(<LoginForm />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText("••••••••");
    const submitButton = screen.getByRole("button", { name: /login/i });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    expect(mockClearError).toHaveBeenCalled();
    expect(mockLogin).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("should not submit form with empty fields", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const submitButton = screen.getByRole("button", { name: /login/i });
    await user.click(submitButton);

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("should display error message when login fails", () => {
    vi.mocked(useAuthStore).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: "Invalid credentials",
      clearError: mockClearError,
      isAuthenticated: false,
      user: null,
      token: null,
      register: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      loadStoredAuth: vi.fn(),
    });

    render(<LoginForm />);

    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it("should disable form during loading", () => {
    vi.mocked(useAuthStore).mockReturnValue({
      login: mockLogin,
      isLoading: true,
      error: null,
      clearError: mockClearError,
      isAuthenticated: false,
      user: null,
      token: null,
      register: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      loadStoredAuth: vi.fn(),
    });

    render(<LoginForm />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText("••••••••");
    const submitButton = screen.getByRole("button", { name: /logging in/i });

    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it("should redirect to home when authenticated", async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      isAuthenticated: true,
      user: { id: 1, name: "Test User", email: "test@example.com" },
      token: "mock-token",
      register: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      loadStoredAuth: vi.fn(),
    });

    render(<LoginForm />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("should navigate to register page when clicking register link", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const registerLink = screen.getByRole("button", { name: /register here/i });
    await user.click(registerLink);

    expect(mockPush).toHaveBeenCalledWith("/register");
  });

  it("should navigate to home when clicking back button", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const backButton = screen.getByRole("button", { name: /back to home/i });
    await user.click(backButton);

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("should disable submit button when fields are empty", () => {
    render(<LoginForm />);

    const submitButton = screen.getByRole("button", { name: /login/i });
    expect(submitButton).toBeDisabled();
  });

  it("should enable submit button when fields are filled", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText("••••••••");
    const submitButton = screen.getByRole("button", { name: /login/i });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");

    expect(submitButton).not.toBeDisabled();
  });
});
