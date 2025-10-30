import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RegisterForm from "@/auth/components/RegisterForm";
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

describe("RegisterForm", () => {
  const mockRegister = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();

    // Default mock implementation
    vi.mocked(useAuthStore).mockReturnValue({
      register: mockRegister,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      isAuthenticated: false,
      user: null,
      token: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      loadStoredAuth: vi.fn(),
    });
  });

  it("should render register form with all fields", () => {
    render(<RegisterForm />);

    expect(screen.getByRole("textbox", { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("should handle input changes", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const nameInput = screen.getByRole("textbox", { name: /name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);

    await user.type(nameInput, "John Doe");
    await user.type(emailInput, "john@example.com");
    await user.type(passwordInput, "password123");
    await user.type(confirmInput, "password123");

    expect(nameInput).toHaveValue("John Doe");
    expect(emailInput).toHaveValue("john@example.com");
    expect(passwordInput).toHaveValue("password123");
    expect(confirmInput).toHaveValue("password123");
  });

  it("should show error when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);

    await user.type(passwordInput, "password123");
    await user.type(confirmInput, "different");

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("should submit form with valid data", async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValueOnce(undefined);

    render(<RegisterForm />);

    const nameInput = screen.getByRole("textbox", { name: /name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole("button", { name: /create account/i });

    await user.type(nameInput, "John Doe");
    await user.type(emailInput, "john@example.com");
    await user.type(passwordInput, "password123");
    await user.type(confirmInput, "password123");
    await user.click(submitButton);

    expect(mockClearError).toHaveBeenCalled();
    expect(mockRegister).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
      password_confirmation: "password123",
    });
  });

  it("should disable submit button when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const nameInput = screen.getByRole("textbox", { name: /name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole("button", { name: /create account/i });

    await user.type(nameInput, "John Doe");
    await user.type(emailInput, "john@example.com");
    await user.type(passwordInput, "password123");
    await user.type(confirmInput, "different");

    expect(submitButton).toBeDisabled();
  });

  it("should display error message when registration fails", () => {
    vi.mocked(useAuthStore).mockReturnValue({
      register: mockRegister,
      isLoading: false,
      error: "Email already exists",
      clearError: mockClearError,
      isAuthenticated: false,
      user: null,
      token: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      loadStoredAuth: vi.fn(),
    });

    render(<RegisterForm />);

    expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
  });

  it("should disable form during loading", () => {
    vi.mocked(useAuthStore).mockReturnValue({
      register: mockRegister,
      isLoading: true,
      error: null,
      clearError: mockClearError,
      isAuthenticated: false,
      user: null,
      token: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      loadStoredAuth: vi.fn(),
    });

    render(<RegisterForm />);

    const nameInput = screen.getByRole("textbox", { name: /name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const submitButton = screen.getByRole("button", { name: /creating account/i });

    expect(nameInput).toBeDisabled();
    expect(emailInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it("should redirect to home when authenticated", async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      register: mockRegister,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      isAuthenticated: true,
      user: { id: 1, name: "John Doe", email: "john@example.com" },
      token: "mock-token",
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      loadStoredAuth: vi.fn(),
    });

    render(<RegisterForm />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("should navigate to login page when clicking login link", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const loginLink = screen.getByRole("button", { name: /login here/i });
    await user.click(loginLink);

    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("should navigate to home when clicking back button", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const backButton = screen.getByRole("button", { name: /back to home/i });
    await user.click(backButton);

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("should toggle password visibility", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const passwordInput = screen.getByLabelText(/^password$/i);
    const toggleButtons = screen.getAllByRole("button", { name: /show password/i });
    const passwordToggle = toggleButtons[0];

    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(passwordToggle);
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(passwordToggle);
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
