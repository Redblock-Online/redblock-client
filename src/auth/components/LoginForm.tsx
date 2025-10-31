"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "../authStore";
import { Button } from "@/features/shared/ui";
import { useRouter } from "next/navigation";

/**
 * Login form component with email and password fields
 * 
 * @example
 * ```tsx
 * <LoginForm />
 * ```
 */
export default function LoginForm() {
  const router = useRouter();
  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!email || !password) {
      return;
    }

    try {
      await login({ email, password });
      // Redirect will happen via useEffect when isAuthenticated becomes true
    } catch (err) {
      // Error is handled by the store
      console.error("Login error:", err);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border-2 border-black  p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Input */}
        <div>
          <label htmlFor="email" className="block text-sm font-bold mb-2 uppercase tracking-wider">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border-2 border-black bg-white text-black font-mono focus:outline-none focus:ring-4 focus:ring-black/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="your@email.com"
            disabled={isLoading}
            required
            autoComplete="email"
          />
        </div>

        {/* Password Input */}
        <div>
          <label htmlFor="password" className="block text-sm font-bold mb-2 uppercase tracking-wider">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-black bg-white text-black font-mono focus:outline-none focus:ring-4 focus:ring-black/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed pr-12"
              placeholder="••••••••"
              disabled={isLoading}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold opacity-50 hover:opacity-100 transition-opacity text-black"
              disabled={isLoading}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="border-4 border-black bg-red-100 p-4">
            <p className="text-sm font-bold text-red-800">! {error}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isLoading || !email || !password}
        >
          {isLoading ? "LOGGING IN..." : "LOGIN"}
        </Button>

        {/* Register Link */}
        <div className="text-center">
          <p className="text-sm opacity-60">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => router.push("/register")}
              className="font-bold underline hover:opacity-100 transition-opacity"
              disabled={isLoading}
            >
              Register here
            </button>
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center pt-4">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-sm opacity-40 hover:opacity-100 transition-opacity"
            disabled={isLoading}
          >
            ← Back to Home
          </button>
        </div>
      </form>
    </div>
  );
}
