"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  const navLinks = [
    { name: "Studio Home", path: "/dashboard" },
    { name: "Manual", path: "/dashboard/products" },
    { name: "Excel Import", path: "/dashboard/catalog-import" },
    { name: "Shopify Scrape", path: "/dashboard/shopify-scrape" },
    { name: "Analytics", path: "/dashboard/analytics" },
    { name: "Store Profile", path: "/dashboard/store" },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FCFCFA]">
        <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-gray-400 animate-pulse">
          Initializing Studio...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FCFCFA]">
        <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-gray-400 animate-pulse">
          Redirecting to login...
        </p>
      </div>
    );
  }

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

      <div className="flex min-h-screen bg-[#FCFCFA] text-black font-sans selection:bg-black selection:text-white">
        <aside className="hidden md:flex w-64 flex-col justify-between bg-[#050505] border-r border-white/10 fixed h-screen z-20 shadow-2xl shadow-black/50">
          <div>
            <div className="p-10 pb-16">
              <Link href="/" className="inline-block w-max">
                <h2 className="font-editorial text-3xl italic tracking-[0.2em] text-[#FCFCFA] hover:text-white hover:opacity-80 transition-opacity cursor-pointer">
                  DRYP
                </h2>
              </Link>
              <p className="font-sans text-[8px] uppercase tracking-[0.4em] text-gray-500 mt-2">
                Vendor Portal
              </p>
            </div>

            <nav className="flex flex-col gap-1 px-4">
              {navLinks.map((link) => {
                const isActive = pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    href={link.path}
                    className={`group flex items-center px-6 py-4 transition-all duration-500 ${
                      isActive ? "bg-[#FCFCFA]" : "hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`font-sans text-[10px] uppercase tracking-[0.2em] transition-colors duration-500 ${
                        isActive
                          ? "text-[#050505] font-bold"
                          : "text-gray-500 group-hover:text-white"
                      }`}
                    >
                      {link.name}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-10 border-t border-white/10">
            <p className="font-sans text-[8px] uppercase tracking-[0.3em] text-gray-600">
              © {new Date().getFullYear()} Syndicate
            </p>
          </div>
        </aside>

        <main className="flex-1 md:ml-64 bg-[#FCFCFA] min-h-screen relative">
          {children}
        </main>
      </div>
    </>
  );
}
