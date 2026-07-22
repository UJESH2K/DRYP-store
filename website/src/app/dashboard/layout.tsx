"use client";

import React, { useState, useEffect } from "react";
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
  const { isAuthenticated, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { name: "Studio Home", path: "/dashboard", short: "Home" },
    { name: "Manual", path: "/dashboard/products", short: "Products" },
    { name: "Excel Import", path: "/dashboard/catalog-import", short: "Excel" },
    { name: "Shopify Scrape", path: "/dashboard/shopify-scrape", short: "Shopify" },
    { name: "Analytics", path: "/dashboard/analytics", short: "Analytics" },
    { name: "Store Profile", path: "/dashboard/store", short: "Profile" },
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

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
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

      {/* ── Mobile header bar ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#FCFCFA]/95 backdrop-blur-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-5 h-14">
          <Link href="/dashboard" className="block">
            <span className="font-editorial text-2xl italic tracking-[0.15em] text-black">
              DRYP
            </span>
          </Link>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 -mr-2 text-black"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ── Mobile nav overlay ── */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          {/* Drawer */}
          <nav className="absolute top-0 left-0 bottom-0 w-72 bg-[#050505] pt-16 px-6 flex flex-col shadow-2xl shadow-black/50">
            <div className="flex flex-col gap-1 flex-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    href={link.path}
                    className={`group flex items-center px-5 py-4 transition-all duration-300 ${
                      isActive ? "bg-[#FCFCFA]" : "hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`font-sans text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 ${
                        isActive
                          ? "text-[#050505] font-bold"
                          : "text-gray-500 group-hover:text-white"
                      }`}
                    >
                      {link.name}
                    </span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-black" />
                    )}
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-white/10 pt-6 pb-8">
              <button
                onClick={handleLogout}
                className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors w-full text-left"
              >
                Lock Studio
              </button>
              <p className="font-sans text-[8px] uppercase tracking-[0.3em] text-gray-600 mt-6">
                © {new Date().getFullYear()} Syndicate
              </p>
            </div>
          </nav>
        </div>
      )}

      <div className="flex min-h-screen bg-[#FCFCFA] text-black font-sans selection:bg-black selection:text-white">
        {/* Desktop sidebar */}
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
            <button
              onClick={logout}
              className="font-sans text-[8px] uppercase tracking-[0.3em] text-gray-600 hover:text-gray-400 transition-colors"
            >
              Lock Studio
            </button>
            <p className="font-sans text-[8px] uppercase tracking-[0.3em] text-gray-700 mt-2">
              © {new Date().getFullYear()} Syndicate
            </p>
          </div>
        </aside>

        <main className="flex-1 md:ml-64 bg-[#FCFCFA] min-h-screen relative pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </>
  );
}
