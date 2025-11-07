"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/auth/authStore";
import { useMeStore } from "@/features/game/ui/state";

export default function LogoutPage() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const setUser = useMeStore((state) => state.setUser);

  useEffect(() => {
    let isActive = true;

    const performLogout = async () => {
      try {
        await logout();
        if (isActive) {
          setUser(null);
        }
      } catch (error) {
        console.error("[LogoutPage] Failed to logout", error);
      } finally {
        if (isActive) {
          router.replace("/");
        }
      }
    };

    void performLogout();

    return () => {
      isActive = false;
    };
  }, [logout, router, setUser]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#323232] text-[#cccccc]">
      <div className="text-center space-y-2">
        <p className="text-sm uppercase tracking-wider text-[#999999]">Signing out</p>
        <p className="text-xl font-bold">Closing your session...</p>
      </div>
    </div>
  );
}
