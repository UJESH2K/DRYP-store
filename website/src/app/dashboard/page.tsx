"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function DashboardPage() {
  const { isAuthenticated, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FCFCFA]">
        <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-gray-400 animate-pulse">
          Initializing Studio...
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-12 md:px-16 lg:px-24">
      {/* Minimalist Header & Logout */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-black pb-8 mb-16 gap-6">
        <div>
          <p className="font-sans text-[10px] font-medium uppercase tracking-[0.4em] text-gray-400 mb-3">
            Secure Session
          </p>
          <h1 className="font-editorial text-5xl md:text-6xl font-light tracking-tight text-black">
            The{" "}
            <span className="font-cursive text-6xl md:text-7xl lowercase text-gray-400 -ml-2">
              atelier
            </span>
          </h1>
        </div>

        <button
          onClick={logout}
          className="group relative inline-flex overflow-hidden border border-black px-8 py-4 text-[10px] font-medium uppercase tracking-[0.3em] text-black transition-all duration-500 hover:text-white"
        >
          <div className="absolute inset-0 h-full w-full translate-y-[100%] bg-black transition-transform duration-500 ease-[cubic-bezier(0.87,0,0.13,1)] group-hover:translate-y-0" />
          <span className="relative z-10 transition-colors duration-500">
            Lock Studio
          </span>
        </button>
      </div>

      {/* Editorial Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
        {/* Abstract Welcome Message */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <h2 className="font-editorial text-4xl leading-snug tracking-tight text-black mb-6">
            Welcome to the Syndicate. <br />
            Your creative sanctuary awaits.
          </h2>
          <p className="font-sans text-[11px] font-light leading-relaxed tracking-[0.15em] text-gray-500 uppercase max-w-lg mb-10">
            Navigate through the portal using the left menu. Curate your
            archive, monitor global acquisitions, and manage your designer
            dossier with absolute precision.
          </p>

          <div className="flex gap-6">
            <Link
              href="/dashboard/products"
              className="border-b border-black pb-1 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-black hover:text-gray-500 hover:border-gray-500 transition-colors"
            >
              Curate Archive
            </Link>
            <Link
              href="/dashboard/store"
              className="border-b border-gray-300 pb-1 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-black hover:border-black transition-colors"
            >
              Update Profile
            </Link>
          </div>
        </div>

        {/* Conceptual Data Widget */}
        <div className="lg:col-span-5 bg-zinc-50 p-12 border border-gray-200 flex flex-col justify-between aspect-square lg:aspect-auto min-h-[400px] shadow-sm">
          <div>
            <p className="font-sans text-[9px] uppercase tracking-[0.4em] text-gray-400 mb-8">
              Current Status
            </p>
            <h3 className="font-editorial text-3xl italic text-gray-300">
              Awaiting <br /> Data Initialization
            </h3>
          </div>

          <div className="flex items-center gap-4 text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-black animate-pulse" />
            <span className="font-sans text-[9px] uppercase tracking-[0.3em]">
              System Online
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
