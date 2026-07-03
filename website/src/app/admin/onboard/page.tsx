"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import CatalogImportPanel from "@/components/CatalogImportPanel";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface DirectoryVendor {
  _id: string;
  name?: string;
  owner: { email: string };
}

export default function AdminOnboardPage() {
  const { token, user, logout } = useAuth();

  const [directory, setDirectory] = useState<DirectoryVendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");

  const [form, setForm] = useState({ name: "", email: "", description: "", phone: "", website: "" });
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState("");
  const [onboardSuccess, setOnboardSuccess] = useState("");

  useEffect(() => {
    if (!token || user?.role !== "admin") return;
    fetch(`${API_BASE_URL}/api/vendors/admin/directory`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then(setDirectory)
      .catch(() => setDirectory([]));
  }, [token, user]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError("");
    setOnboardSuccess("");
    setIsOnboarding(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/admin/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to onboard vendor.");

      setOnboardSuccess(`${data.vendor.name} onboarded. A claim-account email was sent to ${data.vendor.email}.`);
      setDirectory((prev) => [...prev, { _id: data.vendor._id, name: data.vendor.name, owner: { email: data.vendor.email } }]);
      setSelectedVendorId(data.vendor._id);
      setForm({ name: "", email: "", description: "", phone: "", website: "" });
    } catch (err) {
      setOnboardError(err instanceof Error ? err.message : "Failed to onboard vendor.");
    } finally {
      setIsOnboarding(false);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FCFCFA]">
        <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-red-600">
          Access Denied: Administrative Credentials Required
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

      <div className="min-h-screen bg-[#FCFCFA] text-black px-6 py-12 md:px-16 lg:px-24 selection:bg-black selection:text-white">
        {/* Admin Session Bar */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-gray-200 pb-4 mb-12 gap-4">
          <p className="font-sans text-[9px] uppercase tracking-[0.2em] text-gray-400">
            Authorized User: <span className="text-black font-medium tracking-widest ml-1">{user?.email}</span>
          </p>
          <div className="flex items-center gap-8">
            <Link
              href="/admin/applications"
              className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors"
            >
              Back to Command Center
            </Link>
            {logout && (
              <button
                onClick={logout}
                className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-red-400 hover:text-red-600 transition-colors underline underline-offset-4"
              >
                Sever Link
              </button>
            )}
          </div>
        </div>

        <header className="border-b border-black pb-8 mb-12">
          <p className="font-sans text-[10px] font-medium uppercase tracking-[0.4em] text-gray-400 mb-3">
            Command Center
          </p>
          <h1 className="font-editorial text-5xl md:text-6xl font-light tracking-tight text-black">
            Onboard a{" "}
            <span className="font-cursive text-6xl md:text-7xl lowercase text-gray-400 -ml-2">studio</span>
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-6xl">
          {/* Onboard Form */}
          <section>
            <h2 className="font-editorial text-2xl mb-6 border-b border-gray-200 pb-3">
              1. Create Vendor Account
            </h2>

            {onboardError && (
              <div className="mb-4 border-l border-black bg-white p-4 text-xs text-gray-500">{onboardError}</div>
            )}
            {onboardSuccess && (
              <div className="mb-4 border-l border-black bg-white p-4 text-xs text-gray-500">{onboardSuccess}</div>
            )}

            <form onSubmit={handleOnboard} className="space-y-5">
              <div>
                <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">
                  Studio / Brand Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                  className="w-full border-b border-gray-300 bg-transparent py-2 text-base focus:border-black focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleFormChange}
                  required
                  className="w-full border-b border-gray-300 bg-transparent py-2 text-base focus:border-black focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  rows={3}
                  className="w-full border border-gray-300 bg-transparent p-3 text-sm focus:border-black focus:outline-none transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleFormChange}
                    className="w-full border-b border-gray-300 bg-transparent py-2 text-sm focus:border-black focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    name="website"
                    value={form.website}
                    onChange={handleFormChange}
                    placeholder="https://"
                    className="w-full border-b border-gray-300 bg-transparent py-2 text-sm focus:border-black focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isOnboarding}
                className="w-full border border-black bg-black py-4 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-white hover:bg-zinc-800 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {isOnboarding ? "Creating…" : "Create Vendor & Send Claim Email"}
              </button>
            </form>
          </section>

          {/* Catalog Import */}
          <section>
            <h2 className="font-editorial text-2xl mb-6 border-b border-gray-200 pb-3">2. Import Catalog</h2>

            <div className="mb-6">
              <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">
                Target Studio
              </label>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full border-b border-gray-300 bg-transparent py-2 text-sm focus:border-black focus:outline-none transition-colors"
              >
                <option value="">Select a studio…</option>
                {directory.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name || v.owner.email}
                  </option>
                ))}
              </select>
            </div>

            {token && (
              <CatalogImportPanel
                token={token}
                previewEndpoint="/api/vendors/admin/catalog-preview"
                importEndpoint={`/api/vendors/admin/${selectedVendorId}/catalog-import`}
                disabled={!selectedVendorId}
              />
            )}
            {!selectedVendorId && (
              <p className="mt-3 font-sans text-[10px] uppercase tracking-widest text-gray-400">
                Select a studio above before uploading a catalog.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
