"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_shop: "That doesn't look like a valid Shopify domain. Use the format your-store.myshopify.com.",
  invalid_platform: "Something went wrong — please try again from the website.",
  account_exists:
    "An account with this Shopify store's email already exists. Please log in first, then connect Shopify from your dashboard.",
  no_vendor_profile: "We couldn't find a studio profile linked to your account.",
  invalid_session: "Your session expired before Shopify could finish authenticating. Please try again.",
  oauth_failed: "Something went wrong connecting your Shopify store. Please try again.",
};

function ShopifyCallbackContent() {
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage(ERROR_MESSAGES[error] || "Shopify connection failed.");
      return;
    }

    if (!token) {
      setStatus("error");
      setMessage("No authentication token was returned by Shopify.");
      return;
    }

    (async () => {
      try {
        const [meRes, vendorRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/vendors/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!meRes.ok) throw new Error("Failed to load your account.");
        const { user } = await meRes.json();
        const vendor = vendorRes.ok ? await vendorRes.json() : null;

        login({ ...user, vendor }, token);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Failed to complete Shopify login.");
      }
    })();
  }, [searchParams, login]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#FCFCFA] text-black font-sans">
      <div className="max-w-sm w-full px-8 text-center">
        {status === "loading" ? (
          <p className="font-editorial text-xl italic text-gray-500">
            Connecting your Shopify store…
          </p>
        ) : (
          <>
            <p className="font-editorial text-xl italic text-black mb-4">Connection Failed</p>
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

export default function ShopifyCallbackPage() {
  return (
    <Suspense fallback={null}>
      <ShopifyCallbackContent />
    </Suspense>
  );
}
