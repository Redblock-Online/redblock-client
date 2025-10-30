"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "../authStore";
import Button from "@/ui/react/components/Button";
import { useRouter } from "next/navigation";

/**
 * Registration form component with name, email, password, and password confirmation fields
 * 
 * @example
 * ```tsx
 * <RegisterForm />
 * ```
 */
export default function RegisterForm() {
  const router = useRouter();
  const { register, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!name || !email || !password || !passwordConfirmation) {
      return;
    }

    if (password !== passwordConfirmation) {
      return;
    }

    try {
      await register({ name, email, password, password_confirmation: passwordConfirmation });
      // Redirect will happen via useEffect when isAuthenticated becomes true
    } catch (err) {
      // Error is handled by the store
      console.error("Registration error:", err);
    }
  };

  const passwordsMatch = password === passwordConfirmation || passwordConfirmation === "";

  return (
    <div className="w-full max-w-md bg-white border-2 border-black p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name Input */}
        <div>
          <label htmlFor="name" className="block text-sm font-bold mb-2 uppercase tracking-wider">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 border-2 border-black bg-white text-black font-mono focus:outline-none focus:ring-4 focus:ring-black/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Your name"
            disabled={isLoading}
            required
            autoComplete="name"
          />
        </div>

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
              autoComplete="new-password"
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

        {/* Password Confirmation Input */}
        <div>
          <label htmlFor="password_confirmation" className="block text-sm font-bold mb-2 uppercase tracking-wider">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="password_confirmation"
              type={showPasswordConfirmation ? "text" : "password"}
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              className={`w-full px-4 py-3 border-2 ${passwordsMatch ? 'border-black' : 'border-red-500'} bg-white text-black font-mono focus:outline-none focus:ring-4 focus:ring-black/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed pr-12`}
              placeholder="••••••••"
              disabled={isLoading}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold opacity-50 hover:opacity-100 transition-opacity text-black"
              disabled={isLoading}
              aria-label={showPasswordConfirmation ? "Hide password" : "Show password"}
            >
              {showPasswordConfirmation ? "HIDE" : "SHOW"}
            </button>
          </div>
          {!passwordsMatch && passwordConfirmation && (
            <p className="text-xs text-red-600 mt-1 font-bold">Passwords do not match</p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="border-2 border-black bg-red-100 p-4">
            <p className="text-sm font-bold text-red-800">! {error}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isLoading || !name || !email || !password || !passwordConfirmation || !passwordsMatch}
        >
          {isLoading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
        </Button>

        {/* Login Link */}
        <div className="text-center">
          <p className="text-sm opacity-60">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="font-bold underline hover:opacity-100 transition-opacity"
              disabled={isLoading}
            >
              Login here
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
