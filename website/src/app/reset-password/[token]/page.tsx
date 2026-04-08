"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

const ResetPasswordPage = () => {
  const params = useParams();
  const token = params.token as string;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // Frontend validation matching our strict backend rules
  const validatePassword = (pass: string) => {
    const rules = [
      pass.length >= 8,
      /[A-Z]/.test(pass),
      /[a-z]/.test(pass),
      /[0-9]/.test(pass)
    ];
    return rules.every(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    if (!validatePassword(password)) {
      setStatus("error");
      setMessage("Password must be 8+ characters with uppercase, lowercase, and numbers.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setMessage(data.message || "Failed to reset password.");
      }
    } catch (error) {
      setStatus("error");
      setMessage("A network error occurred. Please try again.");
    }
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Playfair+Display:ital,wght@0,300;0,400;0,600;1,400&display=swap');
        .font-editorial { font-family: 'Playfair Display', serif; }
        .font-cursive { font-family: 'Pinyon Script', cursive; }
      `,
        }}
      />
      <div className="min-h-screen bg-[#FCFCFA] text-black font-sans selection:bg-black selection:text-white flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          
          <div className="text-center mb-12">
            <h1 className="font-editorial text-4xl md:text-5xl font-light tracking-tight mb-4">
              New <span className="font-cursive text-5xl md:text-6xl lowercase text-gray-400">credentials</span>
            </h1>
            <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gray-500">
              Enter your new security phrase
            </p>
          </div>

          {status === "success" ? (
            <div className="border border-black p-8 text-center space-y-6">
              <p className="font-editorial text-xl">Access Restored</p>
              <p className="font-sans text-xs tracking-widest text-gray-500 leading-relaxed">
                Your password has been successfully reset. You may now log in to the portal.
              </p>
              <Link href="/login" className="block w-full bg-black text-white py-4 font-sans text-[10px] uppercase tracking-[0.3em] hover:bg-gray-800 transition-colors">
                Proceed to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-b border-gray-300 bg-transparent py-3 text-lg focus:border-black focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border-b border-gray-300 bg-transparent py-3 text-lg focus:border-black focus:outline-none transition-colors"
                  required
                />
              </div>

              {status === "error" && (
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-red-600 text-center">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full border border-black bg-black text-white py-4 font-sans text-[10px] uppercase tracking-[0.3em] hover:bg-transparent hover:text-black transition-colors disabled:opacity-50"
              >
                {status === "loading" ? "Processing..." : "Commit Credentials"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default ResetPasswordPage;