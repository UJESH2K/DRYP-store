"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import CatalogImportPanel from "@/components/CatalogImportPanel";

export default function CatalogImportPage() {
  const { token, user } = useAuth();
  const [importedCount, setImportedCount] = useState<number | null>(null);

  if (!token) return null;

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

      <div className="min-h-screen bg-[#FCFCFA] text-black px-5 sm:px-8 py-10 md:px-16 md:py-12 lg:px-24 selection:bg-black selection:text-white">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-black pb-6 md:pb-8 mb-10 md:mb-16 gap-6">
          <div>
            <Link href="/dashboard" className="mb-6 md:mb-8 hidden md:block w-max">
              <span className="font-editorial text-2xl italic tracking-[0.2em] text-black hover:opacity-70 transition-opacity cursor-pointer">
                DRYP
              </span>
            </Link>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.4em] text-gray-400 mb-3">
              Vendor Identification
            </p>
            <h1 className="font-editorial text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-black">
              Import{" "}
              <span className="font-cursive text-5xl sm:text-6xl md:text-7xl lowercase text-gray-400 -ml-2">
                catalog
              </span>
            </h1>
          </div>
        </div>

        <div className="max-w-3xl">
          <p className="font-sans text-[11px] font-light leading-relaxed tracking-[0.15em] text-gray-500 uppercase max-w-xl mb-10">
            Upload a spreadsheet (.xlsx or .csv) of your products. Each row should
            represent one Colour/Size combination — we&apos;ll group them into
            products with variants automatically. Re-uploading the same file
            updates existing products rather than duplicating them.
          </p>

          {user?.role !== "vendor" ? (
            <p className="font-sans text-[10px] uppercase tracking-widest text-red-500">
              Only vendor accounts can import a catalog.
            </p>
          ) : (
            <CatalogImportPanel
              token={token}
              previewEndpoint="/api/vendors/me/catalog-preview"
              importEndpoint="/api/vendors/me/catalog-import"
              onImported={setImportedCount}
            />
          )}

          {importedCount !== null && (
            <div className="mt-10 pt-8 border-t border-gray-200">
              <Link
                href="/dashboard/products"
                className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-black hover:text-gray-500 transition-colors"
              >
                View Your Archive →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
