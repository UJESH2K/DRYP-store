"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

const OPTIONS = [
  {
    title: "Manual",
    subtitle: "Curate Archive",
    description: "Add products one by one with full control over every detail — images, variants, pricing, and metadata.",
    href: "/dashboard/products",
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="12" x2="12" y2="18" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
  },
  {
    title: "Excel",
    subtitle: "Import Catalog",
    description: "Upload a spreadsheet (.xlsx or .csv) to bulk-import your entire catalog. We auto-group variants.",
    href: "/dashboard/catalog-import",
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    title: "Shopify",
    subtitle: "Link Scraper",
    description: "Paste a Shopify product URL and we'll automatically extract all product data, images, and pricing.",
    href: "/dashboard/shopify-scrape",
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
];

export default function DashboardPage() {
  // Auth gate is enforced by dashboard/layout.tsx — only authenticated vendors reach here.
  const { logout, user } = useAuth();

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
        .font-editorial { font-family: 'Playfair Display', serif; }
        .font-cursive { font-family: 'Pinyon Script', cursive; }
      `,
        }}
      />

      <div className="min-h-screen bg-[#FCFCFA] px-5 sm:px-8 py-10 md:px-16 md:py-12 lg:px-24 selection:bg-black selection:text-white">
        {/* Minimalist Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-black pb-6 md:pb-8 mb-10 md:mb-16 gap-6">
          <div>
            <Link href="/" className="mb-6 md:mb-8 hidden md:block w-max">
              <span className="font-editorial text-2xl italic tracking-[0.2em] text-black hover:opacity-70 transition-opacity cursor-pointer">
                DRYP
              </span>
            </Link>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.4em] text-gray-400 mb-3">
              Secure Session
            </p>
            <h1 className="font-editorial text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-black">
              Welcome,{" "}
              <span className="font-cursive text-5xl sm:text-6xl md:text-7xl lowercase text-gray-400 -ml-2">
                {user?.name || "vendor"}
              </span>
            </h1>
          </div>

          <button
            onClick={logout}
            className="group relative inline-flex overflow-hidden border border-black px-6 md:px-8 py-3 md:py-4 text-[10px] font-medium uppercase tracking-[0.3em] text-black transition-all duration-500 hover:text-white self-start md:self-auto"
          >
            <div className="absolute inset-0 h-full w-full translate-y-[100%] bg-black transition-transform duration-500 ease-[cubic-bezier(0.87,0,0.13,1)] group-hover:translate-y-0" />
            <span className="relative z-10 transition-colors duration-500">
              Lock Studio
            </span>
          </button>
        </div>

        {/* Onboarding Prompt */}
        <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.4em] text-gray-400 mb-8 md:mb-12">
          Choose how to add products to your studio
        </p>

        {/* Three Option Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {OPTIONS.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className="group block bg-white border border-gray-200 p-6 md:p-10 transition-all duration-500 hover:border-black hover:shadow-lg hover:-translate-y-1"
            >
              <div className="text-gray-300 group-hover:text-black transition-colors duration-500 mb-8">
                {option.icon}
              </div>
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.35em] text-gray-400 mb-3">
                {option.subtitle}
              </p>
              <h3 className="font-editorial text-3xl mb-4 group-hover:tracking-tight transition-all duration-500">
                {option.title}
              </h3>
              <p className="font-sans text-[11px] font-light leading-relaxed tracking-[0.05em] text-gray-500">
                {option.description}
              </p>
              <div className="mt-8 flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.3em] text-gray-400 group-hover:text-black transition-colors duration-500">
                <span>Enter Studio</span>
                <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Editorial Footer */}
        <div className="mt-20 pt-8 border-t border-gray-200 flex items-center gap-4 text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-black" />
          <span className="font-sans text-[9px] uppercase tracking-[0.3em]">
            Studio Online
          </span>
        </div>
      </div>
    </>
  );
}
