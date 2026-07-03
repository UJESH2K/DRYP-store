"use client";

import React, { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const DEFAULT_PAGE_SIZE = 10;

interface ProductDraft {
  name: string;
  category: string;
  basePrice: number;
  images: string[];
  options?: { name: string; values: string[] }[];
  variants?: unknown[];
  sku?: string;
  stock?: number;
  preview?: {
    variantCount: number;
    priceRange: [number, number];
    compareAtPrice?: number;
    productUrl?: string;
  };
}

interface SkippedRow {
  row?: number;
  reason: string;
}

interface CatalogImportPanelProps {
  token: string;
  previewEndpoint: string; // e.g. /api/vendors/admin/catalog-preview or /api/vendors/me/catalog-preview
  importEndpoint: string; // e.g. /api/vendors/admin/{vendorId}/catalog-import or /api/vendors/me/catalog-import
  disabled?: boolean; // e.g. admin hasn't picked a target vendor yet
  onImported?: (count: number) => void;
}

export default function CatalogImportPanel({
  token,
  previewEndpoint,
  importEndpoint,
  disabled,
  onImported,
}: CatalogImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [products, setProducts] = useState<ProductDraft[] | null>(null);
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
  const [error, setError] = useState("");
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pageSizeInput, setPageSizeInput] = useState(String(DEFAULT_PAGE_SIZE));
  const [currentPage, setCurrentPage] = useState(1);

  const resetPreview = () => {
    setProducts(null);
    setSkippedRows([]);
    setImportedCount(null);
    setError("");
    setCurrentPage(1);
  };

  const applyPageSize = (value: string) => {
    setPageSizeInput(value);
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      setPageSize(parsed);
      setCurrentPage(1);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setError("");
    setImportedCount(null);
    setIsPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}${previewEndpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to parse the file.");

      setProducts(data.products);
      setSkippedRows(data.skippedRows || []);
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse the file.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!products || products.length === 0) return;
    setError("");
    setIsImporting(true);
    try {
      const res = await fetch(`${API_BASE_URL}${importEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ products }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to import the catalog.");

      setImportedCount(data.imported);
      setProducts(null);
      setFile(null);
      onImported?.(data.imported);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import the catalog.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="border-l border-black bg-white p-4 text-sm tracking-wide shadow-sm">
          <p className="font-editorial italic text-black text-base mb-1">Import Failed</p>
          <p className="text-gray-500 font-light text-xs mt-1">{error}</p>
        </div>
      )}

      {importedCount !== null && (
        <div className="border-l border-black bg-white p-4 text-sm tracking-wide shadow-sm">
          <p className="font-editorial italic text-black text-base mb-1">Import Complete</p>
          <p className="text-gray-500 font-light text-xs mt-1">
            {importedCount} product{importedCount === 1 ? "" : "s"} imported successfully.
          </p>
        </div>
      )}

      {!products ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <input
            type="file"
            accept=".xlsx,.csv"
            disabled={disabled}
            onChange={(e) => {
              resetPreview();
              setFile(e.target.files?.[0] || null);
            }}
            className="font-sans text-xs text-gray-600 file:mr-4 file:border file:border-black file:bg-transparent file:px-4 file:py-2 file:text-[9px] file:uppercase file:tracking-[0.2em] file:cursor-pointer disabled:opacity-40"
          />
          <button
            onClick={handlePreview}
            disabled={!file || isPreviewing || disabled}
            className="border border-black bg-black py-3 px-6 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-white hover:bg-zinc-800 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
          >
            {isPreviewing ? "Parsing…" : "Preview Catalog"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {skippedRows.length > 0 && (
            <div className="border-l border-gray-300 bg-gray-50 p-4 text-xs text-gray-500">
              {skippedRows.length} row{skippedRows.length === 1 ? "" : "s"} skipped:{" "}
              {skippedRows.map((r, i) => (
                <span key={i}>
                  {r.row ? `Row ${r.row} (${r.reason})` : r.reason}
                  {i < skippedRows.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          )}

          {(() => {
            const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
            const safePage = Math.min(currentPage, totalPages);
            const start = (safePage - 1) * pageSize;
            const paginatedProducts = products.slice(start, start + pageSize);
            const showPagination = products.length > DEFAULT_PAGE_SIZE;

            return (
              <>
                {showPagination && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <label className="flex items-center gap-2 font-sans text-[9px] uppercase tracking-widest text-gray-400">
                      Rows per page
                      <input
                        type="number"
                        min={1}
                        value={pageSizeInput}
                        onChange={(e) => applyPageSize(e.target.value)}
                        className="w-16 border-b border-gray-300 bg-transparent py-1 px-1 text-sm text-black focus:border-black focus:outline-none transition-colors"
                      />
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        className="font-sans text-[9px] uppercase tracking-widest text-gray-500 hover:text-black disabled:text-gray-300 disabled:cursor-not-allowed"
                      >
                        ← Prev
                      </button>
                      <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400">
                        Page {safePage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        className="font-sans text-[9px] uppercase tracking-widest text-gray-500 hover:text-black disabled:text-gray-300 disabled:cursor-not-allowed"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto border border-gray-200">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-black bg-gray-50">
                        <th className="py-3 px-4 font-sans text-[9px] uppercase tracking-[0.2em] text-black font-medium">
                          Image
                        </th>
                        <th className="py-3 px-4 font-sans text-[9px] uppercase tracking-[0.2em] text-black font-medium">
                          Product
                        </th>
                        <th className="py-3 px-4 font-sans text-[9px] uppercase tracking-[0.2em] text-black font-medium">
                          Category
                        </th>
                        <th className="py-3 px-4 font-sans text-[9px] uppercase tracking-[0.2em] text-black font-medium">
                          Variants
                        </th>
                        <th className="py-3 px-4 font-sans text-[9px] uppercase tracking-[0.2em] text-black font-medium">
                          Price
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts.map((p, i) => (
                        <tr key={start + i} className="border-b border-gray-100">
                          <td className="py-3 px-4">
                            {p.images?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.images[0]} alt={p.name} className="w-12 h-12 object-cover bg-gray-100" />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100" />
                            )}
                          </td>
                          <td className="py-3 px-4 font-sans text-sm text-black">{p.name}</td>
                          <td className="py-3 px-4 font-sans text-xs text-gray-500 uppercase tracking-wide">
                            {p.category}
                          </td>
                          <td className="py-3 px-4 font-sans text-xs text-gray-500">
                            {p.preview?.variantCount ?? 1}
                          </td>
                          <td className="py-3 px-4 font-sans text-xs text-gray-700">
                            {p.preview && p.preview.priceRange[0] !== p.preview.priceRange[1]
                              ? `₹${p.preview.priceRange[0]} – ₹${p.preview.priceRange[1]}`
                              : `₹${p.basePrice}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}

          <div className="flex gap-4">
            <button
              onClick={resetPreview}
              className="flex-1 border border-gray-300 bg-transparent py-3 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-gray-500 hover:text-black transition-colors"
            >
              Start Over
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={isImporting || disabled}
              className="flex-1 border border-black bg-black py-3 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-white hover:bg-zinc-800 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {isImporting ? "Importing…" : `Confirm Import (${products.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
