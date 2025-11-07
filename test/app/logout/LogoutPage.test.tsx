import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen } from "@testing-library/react";
import LogoutPage from "../../../app/logout/page";

const logoutMock = vi.fn();
const setUserMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("@/auth/authStore", () => ({
  useAuthStore: (selector: (state: { logout: typeof logoutMock }) => unknown) =>
    selector({ logout: logoutMock }),
}));

vi.mock("@/features/game/ui/state", () => ({
  useMeStore: (selector: (state: { setUser: typeof setUserMock }) => unknown) =>
    selector({ setUser: setUserMock }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

describe("LogoutPage", () => {
  beforeEach(() => {
    logoutMock.mockReset();
    setUserMock.mockReset();
    replaceMock.mockReset();
  });

  it("logs out the user and redirects home", async () => {
    logoutMock.mockResolvedValueOnce(undefined);

    render(<LogoutPage />);

    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    expect(setUserMock).toHaveBeenCalledWith(null);
    expect(replaceMock).toHaveBeenCalledWith("/");
  });

  it("redirects home even if logout fails", async () => {
    logoutMock.mockRejectedValueOnce(new Error("network error"));

    render(<LogoutPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    expect(setUserMock).not.toHaveBeenCalled();
  });

  it("shows signing out message while processing", () => {
    logoutMock.mockReturnValue(new Promise(() => {}));

    render(<LogoutPage />);

    expect(screen.getByText(/signing out/i)).toBeInTheDocument();
    expect(screen.getByText(/closing your session/i)).toBeInTheDocument();
  });
});
