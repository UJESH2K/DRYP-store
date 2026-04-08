"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface Vendor {
  _id?: string; 
  owner?: string; // Added owner reference
  name?: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  logo?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
}

const StoreProfilePage = () => {
  // CRITICAL FIX: Destructure 'user' from useAuth
  const { token, user } = useAuth();
  
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [archiveImages, setArchiveImages] = useState<string[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Vendor>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!token) return; 
    fetchVendorProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchVendorProfile = async () => {
    setLoading(true);
    try {
      // 1. Fetch the Vendor Profile
      const response = await fetch(`${API_BASE_URL}/api/vendors/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (response.ok) {
        setVendor(data);
        setFormData(data); 

        // 2. CRITICAL FIX: Fetch products using the User ID (owner), not the Vendor Profile ID
        const vendorOwnerId = user?._id || data.owner;

        if (vendorOwnerId) {
          try {
            const prodRes = await fetch(`${API_BASE_URL}/api/products?vendor=${vendorOwnerId}&limit=20`);
            if (prodRes.ok) {
              const products = await prodRes.json();
              
              // Extract all images from root and variants
              const allImages = products.flatMap((p: any) => [
                ...(p.images || []),
                ...(p.variants?.flatMap((v: any) => v.images || []) || [])
              ]);
              
              // Deduplicate and limit to 10 images
              const uniqueImages = Array.from(new Set(allImages)).slice(0, 10) as string[];
              setArchiveImages(uniqueImages);
            }
          } catch (err) {
            console.error("Failed to fetch archive images:", err);
          }
        }

      } else {
        console.error("Failed to fetch vendor profile:", data.message);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, [name]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendors/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updatedVendor = await response.json();
        setVendor(updatedVendor);
        setIsEditing(false);
      } else {
        const errData = await response.json();
        alert(`Error: ${errData.message}`);
      }
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-gray-400 animate-pulse">
          Retrieving Dossier...
        </p>
      </div>
    );
  }

  if (!vendor) return null; 

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
        </div>

        {isEditing ? (
          /* --- EDIT MODE FORM --- */
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-12">
            
            <div className="space-y-6">
              <h3 className="font-editorial text-3xl mb-8 border-b border-gray-200 pb-4">Brand Identity</h3>
              <div>
                <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">Studio Name</label>
                <input type="text" name="name" value={formData.name || ""} onChange={handleInputChange} className="w-full border-b border-gray-300 bg-transparent py-2 text-lg focus:border-black focus:outline-none transition-colors" required />
              </div>
              <div>
                <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">House Manifesto (Description)</label>
                <textarea name="description" value={formData.description || ""} onChange={handleInputChange} rows={4} className="w-full border border-gray-300 bg-transparent p-4 text-sm focus:border-black focus:outline-none transition-colors" />
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="font-editorial text-3xl mb-8 border-b border-gray-200 pb-4">Direct Line</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">Phone</label>
                  <input type="tel" name="phone" value={formData.phone || ""} onChange={handleInputChange} className="w-full border-b border-gray-300 bg-transparent py-2 text-sm focus:border-black focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">Website</label>
                  <input type="url" name="website" value={formData.website || ""} onChange={handleInputChange} placeholder="https://" className="w-full border-b border-gray-300 bg-transparent py-2 text-sm focus:border-black focus:outline-none transition-colors" />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="font-editorial text-3xl mb-8 border-b border-gray-200 pb-4">Headquarters</h3>
              <div>
                <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">Street Address</label>
                <input type="text" name="street" value={formData.address?.street || ""} onChange={handleAddressChange} className="w-full border-b border-gray-300 bg-transparent py-2 text-sm focus:border-black focus:outline-none transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">City</label>
                  <input type="text" name="city" value={formData.address?.city || ""} onChange={handleAddressChange} className="w-full border-b border-gray-300 bg-transparent py-2 text-sm focus:border-black focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">State/Region</label>
                  <input type="text" name="state" value={formData.address?.state || ""} onChange={handleAddressChange} className="w-full border-b border-gray-300 bg-transparent py-2 text-sm focus:border-black focus:outline-none transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">Zip/Postal Code</label>
                  <input type="text" name="zipCode" value={formData.address?.zipCode || ""} onChange={handleAddressChange} className="w-full border-b border-gray-300 bg-transparent py-2 text-sm focus:border-black focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">Country</label>
                  <input type="text" name="country" value={formData.address?.country || ""} onChange={handleAddressChange} className="w-full border-b border-gray-300 bg-transparent py-2 text-sm focus:border-black focus:outline-none transition-colors" />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-8 border-t border-black">
              <button type="button" onClick={() => setIsEditing(false)} className="flex-1 border border-gray-300 bg-transparent py-4 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-gray-500 hover:text-black transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="flex-1 border border-black bg-black py-4 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-white hover:bg-gray-800 transition-colors">
                {isSaving ? "Saving..." : "Commit Changes"}
              </button>
            </div>
          </form>

        ) : (

          /* --- VIEW MODE --- */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
            
            {/* Left Column (Manifesto & Visual Archive) */}
            <div className="lg:col-span-7 flex flex-col">
              <h2 className="font-editorial text-5xl md:text-6xl tracking-tighter leading-none mb-8">
                {vendor.name || "Unnamed House"}
              </h2>
              <div className="border-t border-gray-200 pt-8 mt-4">
                <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-gray-400 mb-4">
                  House Manifesto
                </p>
                <p className="font-editorial text-xl font-light leading-relaxed text-gray-800 whitespace-pre-wrap">
                  {vendor.description || "No description provided. The archive speaks for itself."}
                </p>
              </div>

              {/* Visual Archive Collage */}
              {archiveImages.length > 0 && (
                <div className="mt-16 border-t border-gray-200 pt-8">
                  <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-gray-400 mb-8">
                    Visual Archive
                  </p>
                  
                  {/* Masonry Layout */}
                  <div className="columns-2 md:columns-3 gap-4 space-y-4">
                    {archiveImages.map((imgUrl, index) => (
                      <div key={index} className="break-inside-avoid overflow-hidden bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={imgUrl} 
                          alt={`Archive piece ${index + 1}`} 
                          className="w-full h-auto object-cover grayscale hover:grayscale-0 transition-all duration-700 ease-in-out hover:scale-105"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column (Contact Data) */}
            <div className="lg:col-span-5 flex flex-col gap-10 border-l-0 lg:border-l border-gray-200 lg:pl-16">
              
              <div>
                <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-gray-400 mb-6 pb-2 border-b border-gray-100">
                  Direct Line
                </p>
                <div className="space-y-6">
                  <div>
                    <span className="block font-sans text-[8px] uppercase tracking-widest text-gray-400 mb-1">Email Inquiry</span>
                    <span className="font-sans text-sm tracking-widest text-black">{vendor.email || "—"}</span>
                  </div>
                  <div>
                    <span className="block font-sans text-[8px] uppercase tracking-widest text-gray-400 mb-1">Phone / Studio</span>
                    <span className="font-sans text-sm tracking-widest text-black">{vendor.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="block font-sans text-[8px] uppercase tracking-widest text-gray-400 mb-1">Digital Footprint</span>
                    {vendor.website ? (
                       <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="font-sans text-sm tracking-widest text-black hover:underline">
                         {vendor.website.replace(/^https?:\/\//, "")}
                       </a>
                    ) : (
                      <span className="font-sans text-sm tracking-widest text-black">—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Show address section if they have at least a street or a city */}
              {(vendor.address?.street || vendor.address?.city) && (
                <div className="mt-4">
                  <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-gray-400 mb-6 pb-2 border-b border-gray-100">
                    Headquarters
                  </p>
                  <address className="not-italic space-y-1">
                    <p className="font-editorial text-lg text-black">{vendor.address.street}</p>
                    <p className="font-sans text-xs tracking-widest text-gray-600 uppercase mt-2">
                      {vendor.address.city}, {vendor.address.state}
                    </p>
                    <p className="font-sans text-xs tracking-widest text-gray-400 uppercase">
                      {vendor.address.zipCode} {vendor.address.country && `• ${vendor.address.country}`}
                    </p>
                  </address>
                </div>
              )}

              {/* Action Button */}
              <div className="mt-8 pt-8 border-t border-black">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="w-full border border-black bg-transparent py-4 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-black transition-colors duration-300 hover:bg-black hover:text-white"
                >
                  Update Profile Data
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default StoreProfilePage;