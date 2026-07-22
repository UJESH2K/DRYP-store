"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

interface ScrapedProduct {
  name: string;
  description: string;
  brand: string;
  category: string;
  basePrice: number;
  images: string[];
  tags: string[];
}

export default function ShopifyScrapePage() {
  const { token } = useAuth();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ScrapedProduct | null>(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) return null;

  const handlePreview = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setPreview(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/products/shopify-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to preview");
      }

      const data = await res.json();
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch product data");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    setError("");

    try {
      const res = await fetch("/api/products/shopify-scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to import");
      }

      setSuccess(true);
      setPreview(null);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import product");
    } finally {
      setImporting(false);
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

      <div className="min-h-screen bg-[#FCFCFA] text-black px-5 sm:px-8 py-10 md:px-16 md:py-12 lg:px-24 selection:bg-black selection:text-white">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-black pb-6 md:pb-8 mb-10 md:mb-16 gap-6">
          <div>
            <Link href="/dashboard" className="mb-6 md:mb-8 hidden md:block w-max">
              <span className="font-editorial text-2xl italic tracking-[0.2em] text-black hover:opacity-70 transition-opacity cursor-pointer">
                DRYP
              </span>
            </Link>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.4em] text-gray-400 mb-3">
              Automated Intake
            </p>
            <h1 className="font-editorial text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-black">
              Link{" "}
              <span className="font-cursive text-5xl sm:text-6xl md:text-7xl lowercase text-gray-400 -ml-2">
                scraper
              </span>
            </h1>
          </div>
        </div>

        <div className="max-w-3xl">
          <p className="font-sans text-[11px] font-light leading-relaxed tracking-[0.15em] text-gray-500 uppercase max-w-xl mb-8 md:mb-10">
            Paste a Shopify product URL below. We&apos;ll extract the product details, images, and pricing automatically.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-10 md:mb-12">
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
                setPreview(null);
                setSuccess(false);
              }}
              placeholder="https://your-store.myshopify.com/products/example"
              className="flex-1 border-b border-gray-300 bg-transparent py-3 text-sm focus:border-black focus:outline-none transition-colors min-w-0"
              onKeyDown={(e) => e.key === "Enter" && handlePreview()}
            />
            <button
              onClick={handlePreview}
              disabled={!url.trim() || loading}
              className="border border-black bg-black px-6 md:px-8 py-3 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-white hover:bg-zinc-800 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {loading ? "Scanning..." : "Preview"}
            </button>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200">
              <p className="font-sans text-[10px] uppercase tracking-widest text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-8 p-6 bg-zinc-50 border border-black">
              <p className="font-editorial text-2xl mb-2">Product Imported</p>
              <p className="font-sans text-[10px] uppercase tracking-widest text-gray-500 mb-6">
                The product has been added to your catalog.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setSuccess(false)}
                  className="border border-black bg-transparent px-6 py-3 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-black hover:bg-black hover:text-white transition-colors"
                >
                  Import Another
                </button>
                <Link
                  href="/dashboard/products"
                  className="border border-black bg-black px-6 py-3 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-white hover:bg-zinc-800 transition-colors"
                >
                  View Catalog
                </Link>
              </div>
            </div>
          )}

          {preview && (
            <div className="border border-gray-200 bg-white p-8">
              <h2 className="font-editorial text-3xl mb-6 border-b border-gray-100 pb-4">Preview</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  {preview.images.length > 0 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview.images[0]}
                      alt={preview.name}
                      className="w-full h-80 object-cover bg-zinc-50"
                    />
                  )}
                  {preview.images.length > 1 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto">
                      {preview.images.slice(1, 5).map((img, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={img} alt="" className="w-16 h-16 object-cover bg-zinc-50 flex-shrink-0" />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="font-sans text-[8px] uppercase tracking-widest text-gray-400 mb-1">Name</p>
                    <p className="font-editorial text-2xl">{preview.name}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[8px] uppercase tracking-widest text-gray-400 mb-1">Brand</p>
                    <p className="font-sans text-sm">{preview.brand || "—"}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[8px] uppercase tracking-widest text-gray-400 mb-1">Category</p>
                    <p className="font-sans text-sm">{preview.category || "Uncategorized"}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[8px] uppercase tracking-widest text-gray-400 mb-1">Price</p>
                    <p className="font-editorial text-3xl">${preview.basePrice.toFixed(2)}</p>
                  </div>
                  {preview.description && (
                    <div>
                      <p className="font-sans text-[8px] uppercase tracking-widest text-gray-400 mb-1">Description</p>
                      <p className="font-sans text-xs text-gray-600 leading-relaxed line-clamp-4">{preview.description}</p>
                    </div>
                  )}
                  {preview.tags.length > 0 && (
                    <div>
                      <p className="font-sans text-[8px] uppercase tracking-widest text-gray-400 mb-1">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {preview.tags.map((tag, i) => (
                          <span key={i} className="bg-zinc-100 px-3 py-1 font-sans text-[9px] uppercase tracking-wider">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-gray-200">
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex-1 border border-black bg-black py-4 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-white hover:bg-zinc-800 transition-colors disabled:opacity-40"
                >
                  {importing ? "Importing..." : "Import to Catalog"}
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="flex-1 border border-gray-300 bg-transparent py-4 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-gray-500 hover:text-black transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
