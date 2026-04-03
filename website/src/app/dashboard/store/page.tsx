"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface Vendor {
  name?: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
}

const StoreProfilePage = () => {
  const { token } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVendorProfile = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/vendors/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (response.ok) {
          setVendor(data);
        } else {
          throw new Error(data.message || "Failed to fetch vendor profile");
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchVendorProfile();
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-gray-400 animate-pulse">
          Retrieving Dossier...
        </p>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-center">
        <div>
          <span className="font-cursive text-6xl text-gray-300 mb-2 block">
            Error
          </span>
          <p className="font-sans text-[10px] tracking-[0.2em] text-gray-500 uppercase mt-4">
            Unable to locate vendor records.
          </p>
        </div>
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

      <div className="min-h-screen bg-[#FCFCFA] text-black font-sans selection:bg-black selection:text-white px-6 py-12 md:px-16 lg:px-24">
        {/* Minimalist Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-black pb-8 mb-16 gap-6">
          <div>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.4em] text-gray-400 mb-3">
              Vendor Identification
            </p>
            <h1 className="font-editorial text-5xl md:text-6xl font-light tracking-tight text-black">
              The{" "}
              <span className="font-cursive text-6xl md:text-7xl lowercase text-gray-400 -ml-2">
                dossier
              </span>
            </h1>
          </div>
          <div className="text-right hidden md:block">
            <p className="font-sans text-[9px] uppercase tracking-[0.3em] text-gray-400">
              Status
            </p>
            <p className="font-editorial italic text-lg mt-1 text-black flex items-center justify-end gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-black block" />{" "}
              Active
            </p>
          </div>
        </div>

        {/* --- Main Profile Grid --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
          {/* Left Column: Brand Identity */}
          <div className="lg:col-span-7 flex flex-col">
            <h2 className="font-editorial text-5xl md:text-6xl tracking-tighter leading-none mb-8">
              {vendor.name || "Unnamed House"}
            </h2>

            <div className="border-t border-gray-200 pt-8 mt-4">
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-gray-400 mb-4">
                House Manifesto
              </p>
              <p className="font-editorial text-xl font-light leading-relaxed text-gray-800">
                {vendor.description ||
                  "No description provided. The archive speaks for itself."}
              </p>
            </div>
          </div>

          {/* Right Column: Contact & Coordinates */}
          <div className="lg:col-span-5 flex flex-col gap-10 border-l-0 lg:border-l border-gray-200 lg:pl-16">
            {/* Communication Block */}
            <div>
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-gray-400 mb-6 pb-2 border-b border-gray-100">
                Direct Line
              </p>
              <div className="space-y-6">
                <div>
                  <span className="block font-sans text-[8px] uppercase tracking-widest text-gray-400 mb-1">
                    Email Inquiry
                  </span>
                  <a
                    href={`mailto:${vendor.email}`}
                    className="font-sans text-sm tracking-widest text-black hover:text-gray-500 transition-colors"
                  >
                    {vendor.email || "—"}
                  </a>
                </div>
                <div>
                  <span className="block font-sans text-[8px] uppercase tracking-widest text-gray-400 mb-1">
                    Phone / Studio
                  </span>
                  <a
                    href={`tel:${vendor.phone}`}
                    className="font-sans text-sm tracking-widest text-black hover:text-gray-500 transition-colors"
                  >
                    {vendor.phone || "—"}
                  </a>
                </div>
                <div>
                  <span className="block font-sans text-[8px] uppercase tracking-widest text-gray-400 mb-1">
                    Digital Footprint
                  </span>
                  <a
                    href={vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-sans text-sm tracking-widest text-black hover:text-gray-500 transition-colors"
                  >
                    {vendor.website
                      ? vendor.website.replace(/^https?:\/\//, "")
                      : "—"}
                  </a>
                </div>
              </div>
            </div>

            {/* Headquarters Block */}
            {vendor.address && (
              <div className="mt-4">
                <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-gray-400 mb-6 pb-2 border-b border-gray-100">
                  Headquarters
                </p>
                <address className="not-italic space-y-1">
                  <p className="font-editorial text-lg text-black">
                    {vendor.address.line1}
                  </p>
                  <p className="font-sans text-xs tracking-widest text-gray-600 uppercase mt-2">
                    {vendor.address.city}, {vendor.address.state}
                  </p>
                  <p className="font-sans text-xs tracking-widest text-gray-400 uppercase">
                    {vendor.address.pincode}
                  </p>
                </address>
              </div>
            )}

            {/* Action Button */}
            <div className="mt-8 pt-8 border-t border-black">
              <button className="w-full border border-black bg-transparent py-4 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-black transition-colors duration-300 hover:bg-black hover:text-white">
                Request Profile Update
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StoreProfilePage;
