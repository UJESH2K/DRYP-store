"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google login was cancelled.",
  no_code: "No authorization code was returned by Google.",
  invalid_state: "Your session expired. Please try again.",
  token_exchange_failed: "Failed to exchange Google credentials. Please try again.",
  no_email: "Your Google account does not have an email address associated with it.",
  oauth_failed: "Something went wrong signing in with Google. Please try again.",
};

function GoogleCallbackContent() {
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage(ERROR_MESSAGES[error] || "Google sign-in failed.");
      return;
    }

    if (!token) {
      setStatus("error");
      setMessage("No authentication token was returned by Google.");
      return;
    }

    (async () => {
      try {
        const [meRes, vendorRes] = await Promise.all([
          fetch(`/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/vendors/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!meRes.ok) throw new Error("Failed to load your account.");
        const { user } = await meRes.json();
        const vendor = vendorRes.ok ? await vendorRes.json() : null;

        login({ ...user, vendor }, token);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Failed to complete Google login.");
      }
    })();
  }, [searchParams, login]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#FCFCFA] text-black font-sans">
      <div className="max-w-sm w-full px-8 text-center">
        {status === "loading" ? (
          <p className="font-editorial text-xl italic text-gray-500">
            Signing in with Google…
          </p>
        ) : (
          <>
            <p className="font-editorial text-xl italic text-black mb-4">Sign In Failed</p>
            <p className="text-sm text-gray-500 mb-8">{message}</p>
            <Link
              href="/login"
              className="inline-block bg-black py-3 px-8 text-xs font-medium uppercase tracking-[0.3em] text-white hover:bg-zinc-800 transition-colors"
            >
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
