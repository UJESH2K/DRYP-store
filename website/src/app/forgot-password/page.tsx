"use client";

import React, { useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message || "If an account exists, a reset link has been sent.");
      } else {
        setStatus("error");
        setMessage(data.message || "Failed to process request.");
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
              Password <span className="font-cursive text-5xl md:text-6xl lowercase text-gray-400">recovery</span>
            </h1>
            <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gray-500">
              Enter your email to receive a secure reset token
            </p>
          </div>

          {status === "success" ? (
            <div className="border border-black p-8 text-center space-y-6">
              <p className="font-editorial text-xl">Transmission Sent</p>
              <p className="font-sans text-xs tracking-widest text-gray-500 leading-relaxed">
                {message} Please check your inbox and spam folder. The link will expire in 10 minutes.
              </p>
              <Link href="/login" className="block w-full bg-black text-white py-4 font-sans text-[10px] uppercase tracking-[0.3em] hover:bg-gray-800 transition-colors">
                Return to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {status === "loading" ? "Requesting..." : "Send Reset Link"}
              </button>

              <div className="text-center pt-4 border-t border-gray-200">
                <Link href="/login" className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors">
                  Cancel and return to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default ForgotPasswordPage;