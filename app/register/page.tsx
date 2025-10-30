"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import RegisterForm from "@/auth/components/RegisterForm";
import { useAuthStore } from "@/auth/authStore";

/**
 * Register page component
 * Displays the registration form with Redblock branding
 */
export default function RegisterPage() {
  const { loadStoredAuth } = useAuthStore();

  // Load stored authentication on mount
  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  return (
    <div className="fixed inset-0 bg-[radial-gradient(#fff,#fff)] flex flex-col items-center justify-center text-black">
      {/* Background grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,#000_49%,#000_51%,transparent_51%),linear-gradient(0deg,transparent_49%,#000_49%,#000_51%,transparent_51%)] [background-size:80px_80px] opacity-10 z-[1]" />

      {/* Decorative cubes */}
      <div
        className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float will-change-transform"
        style={{ top: "10%", left: "15%", transform: "translate3d(0, 0, 0) rotate(15deg)" }}
      />
      <div
        className="absolute w-10 h-10 border-2 border-black bg-[#ff0000] z-[2] animate-float will-change-transform"
        style={{ top: "20%", right: "20%", transform: "translate3d(0, 0, 0) rotate(-10deg)" }}
      />
      <div
        className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float will-change-transform"
        style={{ bottom: "30%", left: "10%", transform: "translate3d(0, 0, 0) rotate(25deg)" }}
      />
      <div
        className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float will-change-transform"
        style={{ bottom: "15%", right: "15%", transform: "translate3d(0, 0, 0) rotate(-20deg)" }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center p-8 w-full max-w-2xl">
        {/* Logo */}
        <Image
          src="/logo.png"
          alt="Logo"
          width={498}
          height={410}
          priority
          className="h-[120px] w-auto mx-auto translate-x-[20px] mb-6"
          sizes="(max-width: 768px) 40vw, 300px"
        />

        {/* Title */}
        <h1 className="text-4xl font-bold mb-2 uppercase tracking-wider">Register</h1>
        <p className="text-sm opacity-60 mb-8">Create your Redblock account</p>

        {/* Register Form */}
        <RegisterForm />
      </div>
    </div>
  );
}
