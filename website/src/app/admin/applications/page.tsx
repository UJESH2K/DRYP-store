"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface Application {
  _id: string;
  studioName: string;
  email: string;
  websiteOrPortfolio: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface RegisteredVendor {
  _id: string;
  name?: string;
  description?: string;
  phone?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  owner: {
    _id: string;
    email: string;
    isActive: boolean;
    createdAt: string;
  };
}

interface Product {
  _id: string;
  name: string;
  basePrice: number;
  images: string[];
  isActive: boolean;
}

interface ModalConfig {
  isOpen: boolean;
  type: "alert" | "confirm";
  title: string;
  message: string;
  onConfirm?: () => void;
}

const AdminApplicationsPage = () => {
  const { token, user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"queue" | "directory">("queue");
  
  // Data States
  const [applications, setApplications] = useState<Application[]>([]);
  const [directory, setDirectory] = useState<RegisteredVendor[]>([]);
  
  // Dossier Modal States
  const [selectedVendor, setSelectedVendor] = useState<RegisteredVendor | null>(null);
  const [vendorProducts, setVendorProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // Loading & Processing States
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Custom Modal State
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    type: "alert",
    title: "",
    message: "",
  });

  useEffect(() => {
    if (token) {
      if (activeTab === "queue") fetchApplications();
      if (activeTab === "directory") fetchDirectory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab]);

  // --- MODAL HELPERS ---
  const showAlert = (title: string, message: string) => {
    setModalConfig({ isOpen: true, type: "alert", title, message });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, type: "confirm", title, message, onConfirm });
  };

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  // --- API CALLS ---
  const fetchApplications = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendors/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setApplications(await response.json());
    } catch (error) {
      console.error("Failed to fetch applications:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendors/admin/directory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setDirectory(await response.json());
    } catch (error) {
      console.error("Failed to fetch directory:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateApplication = async (id: string, status: "approved" | "rejected") => {
    setProcessingId(id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendors/applications/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        setApplications((prev) => prev.map((app) => (app._id === id ? { ...app, status } : app)));
      } else {
        const err = await response.json();
        showAlert("Update Failed", err.message || "An error occurred while updating the application.");
      }
    } catch (error) {
      console.error("Update failed:", error);
      showAlert("Network Error", "Failed to connect to the server.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleSuspension = (e: React.MouseEvent, vendorId: string) => {
    e.stopPropagation(); // Prevent opening the dossier modal when clicking suspend action

    showConfirm(
      "Alter Access Authorization",
      "Are you sure you want to alter this studio's access? An email will be dispatched automatically notifying them of the change.",
      async () => {
        setProcessingId(vendorId);
        try {
          const response = await fetch(`${API_BASE_URL}/api/vendors/admin/suspend/${vendorId}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            setDirectory((prev) => prev.map((v) => {
              if (v._id === vendorId) {
                return { ...v, owner: { ...v.owner, isActive: data.isActive } };
              }
              return v;
            }));
            
            // If they are currently viewing this vendor in the modal, update it there too
            if (selectedVendor && selectedVendor._id === vendorId) {
                setSelectedVendor(prev => prev ? { ...prev, owner: { ...prev.owner, isActive: data.isActive } } : null);
            }
          } else {
            const err = await response.json();
            showAlert("Action Failed", err.message || "Could not alter suspension status.");
          }
        } catch (error) {
          console.error("Suspension failed:", error);
          showAlert("Network Error", "Failed to connect to the server.");
        } finally {
          setProcessingId(null);
        }
      }
    );
  };

  const openVendorDossier = async (vendor: RegisteredVendor) => {
    setSelectedVendor(vendor);
    setLoadingProducts(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products?vendor=${vendor.owner._id}&limit=100`);
      if (response.ok) {
        setVendorProducts(await response.json());
      }
    } catch (error) {
      console.error("Failed to fetch vendor catalog:", error);
      showAlert("Fetch Failed", "Could not load the studio's archive.");
    } finally {
      setLoadingProducts(false);
    }
  };

  const closeVendorDossier = () => {
    setSelectedVendor(null);
    setVendorProducts([]);
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
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Playfair+Display:ital,wght@0,300;0,400;0,600;1,400&display=swap');
        .font-editorial { font-family: 'Playfair Display', serif; }
        .font-cursive { font-family: 'Pinyon Script', cursive; }

        @keyframes modalFadeIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-modal {
          animation: modalFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />

      {/* --- DOSSIER INSPECTION MODAL --- */}
      {selectedVendor && (
        <div className="fixed inset-0 z-40 bg-[#FCFCFA] overflow-y-auto selection:bg-black selection:text-white">
          <div className="min-h-screen p-8 md:p-16 lg:px-24">
            
            {/* Modal Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-black pb-8 mb-12 gap-6">
              <div>
                <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-gray-600 mb-2">
                  Dossier Inspection
                </p>
                <h2 className="font-editorial text-5xl text-gray-600 md:text-6xl font-light tracking-tight">
                  {selectedVendor.name || "Unnamed Studio"}
                </h2>
                <div className="mt-6 flex gap-4 items-center">
                  <span className={`font-sans text-[8px] font-bold uppercase tracking-[0.2em] px-4 py-2 border ${
                    selectedVendor.owner.isActive 
                      ? 'border-black text-black bg-transparent' 
                      : 'border-red-200 text-red-500 bg-red-50'
                  }`}>
                    {selectedVendor.owner.isActive ? 'System Status: Active' : 'System Status: Suspended'}
                  </span>
                  <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-gray-400">
                    ID: {selectedVendor._id}
                  </span>
                </div>
              </div>

              <button 
                onClick={closeVendorDossier}
                className="group relative inline-flex overflow-hidden border border-black px-8 py-4 text-[9px] font-bold uppercase tracking-[0.2em] text-black transition-all duration-500 hover:text-white"
              >
                <div className="absolute inset-0 h-full w-full translate-y-[100%] bg-black transition-transform duration-500 ease-[cubic-bezier(0.87,0,0.13,1)] group-hover:translate-y-0" />
                <span className="relative z-10 transition-colors duration-500">
                  Close File
                </span>
              </button>
            </div>

            {/* Modal Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
              
              {/* Left Column: Details */}
              <div className="lg:col-span-4 space-y-12">
                <div>
                  <h3 className="font-sans text-[9px] font-bold uppercase tracking-[0.3em] text-gray-700 border-b border-gray-200 pb-2 mb-6">Direct Line</h3>
                  <div className="space-y-6">
                    <div>
                      <p className="font-sans text-[8px] uppercase tracking-[0.2em] text-gray-700 mb-1">Email Inquiry</p>
                      <p className="font-sans text-[11px] text-gray-900 tracking-widest">{selectedVendor.owner.email}</p>
                    </div>
                    {selectedVendor.phone && (
                      <div>
                        <p className="font-sans text-[8px] uppercase tracking-[0.2em] text-gray-700 mb-1">Phone</p>
                        <p className="font-sans text-[11px] text-gray-900 tracking-widest">{selectedVendor.phone}</p>
                      </div>
                    )}
                    {selectedVendor.website && (
                      <div>
                        <p className="font-sans text-[8px] uppercase tracking-[0.2em] text-gray-700 mb-1">Digital Footprint</p>
                        <a href={selectedVendor.website} target="_blank" rel="noreferrer" className="font-sans text-gray-400 text-[11px] tracking-widest underline underline-offset-4 hover:text-black transition-colors">
                          {selectedVendor.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {selectedVendor.description && (
                  <div>
                    <h3 className="font-sans text-[9px] font-bold uppercase tracking-[0.3em] text-gray-700 border-b border-gray-200 pb-2 mb-6">House Manifesto</h3>
                    <p className="font-editorial text-lg leading-relaxed text-gray-800 whitespace-pre-wrap">
                      {selectedVendor.description}
                    </p>
                  </div>
                )}

                {(selectedVendor.address?.street || selectedVendor.address?.city) && (
                  <div>
                    <h3 className="font-sans text-[9px] font-bold uppercase tracking-[0.3em] text-gray-700 border-b border-gray-200 pb-2 mb-6">Headquarters</h3>
                    <address className="not-italic space-y-1">
                      <p className="font-editorial text-gray-900 text-lg">{selectedVendor.address.street}</p>
                      <p className="font-sans text-[10px] tracking-widest text-gray-700 uppercase mt-2">
                        {selectedVendor.address.city}, {selectedVendor.address.state}
                      </p>
                      <p className="font-sans text-[10px] tracking-widest text-gray-700 uppercase">
                        {selectedVendor.address.zipCode} {selectedVendor.address.country}
                      </p>
                    </address>
                  </div>
                )}
                
                {/* Admin Action inside the modal */}
                <div className="pt-8">
                  <button 
                     onClick={(e) => handleToggleSuspension(e, selectedVendor._id)}
                     disabled={processingId === selectedVendor._id}
                     className={`w-full py-4 font-sans text-[9px] font-bold uppercase tracking-[0.2em] transition-colors border disabled:opacity-50 ${
                       selectedVendor.owner.isActive 
                         ? 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50' 
                         : 'border-black text-black hover:bg-black hover:text-white'
                     }`}
                  >
                     {processingId === selectedVendor._id 
                        ? 'Processing...' 
                        : selectedVendor.owner.isActive 
                          ? 'Suspend Studio Access' 
                          : 'Restore Studio Access'
                     }
                  </button>
                </div>
              </div>

              {/* Right Column: Catalog */}
              <div className="lg:col-span-8">
                <h3 className="font-sans text-[9px] font-bold uppercase tracking-[0.3em] text-gray-400 border-b border-gray-200 pb-2 mb-8">
                  Active Archive ({vendorProducts.length} Items)
                </h3>
                
                {loadingProducts ? (
                  <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-gray-400 animate-pulse mt-12">Syncing Archive...</p>
                ) : vendorProducts.length === 0 ? (
                  <p className="font-editorial italic text-gray-400 text-xl mt-12">This studio has not curated any items yet.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {vendorProducts.map((product) => (
                      <div key={product._id} className="group cursor-pointer">
                        <div className="aspect-[3/4] bg-gray-100 overflow-hidden mb-4 border border-gray-200">
                          {product.images && product.images.length > 0 ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover transition-all duration-700 ease-out scale-105 group-hover:scale-100" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 font-editorial">No Image</div>
                          )}
                        </div>
                        <h4 className="font-editorial text-gray-500 text-lg leading-tight group-hover:text-black transition-colors line-clamp-1">{product.name}</h4>
                        <p className="font-sans text-[10px] tracking-widest text-gray-400 mt-2">${product.basePrice}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- MAIN DASHBOARD VIEW --- */}
      <div className={`min-h-screen bg-[#FCFCFA] text-black px-6 py-12 md:px-16 lg:px-24 selection:bg-black selection:text-white ${selectedVendor ? 'hidden' : 'block'}`}>
        
        {/* Admin Session Bar */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-gray-200 pb-4 mb-12 gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-40"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <p className="font-sans text-[9px] uppercase tracking-[0.2em] text-gray-400">
              Authorized User: <span className="text-black font-medium tracking-widest ml-1">{user?.email}</span>
            </p>
          </div>
          <div className="flex items-center gap-8">
            <p className="font-sans text-[9px] uppercase tracking-[0.2em] text-gray-400">
              Clearance Level: <span className="text-black font-medium tracking-widest ml-1">{user?.role}</span>
            </p>
            {logout && (
               <button onClick={logout} className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-red-400 hover:text-red-600 transition-colors underline underline-offset-4">
                 Sever Link
               </button>
            )}
          </div>
        </div>

        {/* Command Center Header & Tabs */}
        <header className="border-b border-black pb-8 mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <Link href="/" className="mb-8 block w-max">
              <span className="font-editorial text-2xl italic tracking-[0.2em] text-black hover:opacity-70 transition-opacity cursor-pointer">
                DRYP
              </span>
            </Link>

            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.4em] text-gray-400 mb-3">
              Command Center
            </p>
            <h1 className="font-editorial text-5xl md:text-6xl font-light tracking-tight text-black">
              System{" "}
              <span className="font-cursive text-6xl md:text-7xl lowercase text-gray-400 -ml-2">
                oversight
              </span>
            </h1>
          </div>
          
          <div className="flex gap-6 mb-2">
            <button 
              onClick={() => setActiveTab("queue")} 
              className={`border-b pb-1 font-sans text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${
                activeTab === 'queue' 
                  ? 'border-black text-black' 
                  : 'border-gray-300 text-gray-400 hover:text-black hover:border-black'
              }`}
            >
              Curation Queue
            </button>
            <button 
              onClick={() => setActiveTab("directory")} 
              className={`border-b pb-1 font-sans text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${
                activeTab === 'directory' 
                  ? 'border-black text-black' 
                  : 'border-gray-300 text-gray-400 hover:text-black hover:border-black'
              }`}
            >
              Registered Studios
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-gray-400 animate-pulse">
              Accessing Database...
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-20">
            {/* TAB 1: CURATION QUEUE */}
            {activeTab === "queue" && (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-black">
                    <th className="py-4 font-sans text-[9px] uppercase tracking-[0.3em] text-black font-medium">Date Received</th>
                    <th className="py-4 font-sans text-[9px] uppercase tracking-[0.3em] text-black font-medium">Studio Name</th>
                    <th className="py-4 font-sans text-[9px] uppercase tracking-[0.3em] text-black font-medium">Digital Footprint</th>
                    <th className="py-4 font-sans text-[9px] uppercase tracking-[0.3em] text-black font-medium text-center">Status</th>
                    <th className="py-4 font-sans text-[9px] uppercase tracking-[0.3em] text-black font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-32 text-center font-editorial italic text-gray-400 text-2xl">
                        The queue is currently empty.
                      </td>
                    </tr>
                  )}
                  {applications.map((app) => (
                    <tr key={app._id} className="border-b border-gray-200 group hover:bg-white transition-colors">
                      <td className="py-8 font-sans text-[10px] tracking-widest text-gray-500">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-8 font-editorial text-2xl text-black">
                        {app.studioName}
                      </td>
                      <td className="py-8">
                        <a 
                          href={app.websiteOrPortfolio} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="font-sans text-[9px] uppercase tracking-widest text-black underline underline-offset-4 hover:text-gray-500 transition-colors"
                        >
                          Review Portfolio
                        </a>
                      </td>
                      <td className="py-8 text-center">
                        <span className={`font-sans text-[8px] font-bold uppercase tracking-[0.2em] px-4 py-2 border ${
                          app.status === 'approved' 
                            ? 'border-black bg-black text-white' 
                            : app.status === 'rejected' 
                              ? 'border-gray-200 bg-gray-50 text-gray-400 line-through' 
                              : 'border-gray-300 text-black bg-transparent'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="py-8 text-right">
                        {app.status === 'pending' && (
                          <div className="flex justify-end items-center gap-6">
                            <button 
                              disabled={processingId === app._id} 
                              onClick={() => handleUpdateApplication(app._id, 'rejected')} 
                              className="font-sans text-[9px] font-medium uppercase tracking-[0.2em] text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>

                            <button 
                              disabled={processingId === app._id} 
                              onClick={() => handleUpdateApplication(app._id, 'approved')} 
                              className="group relative inline-flex overflow-hidden border border-black px-6 py-3 text-[9px] font-bold uppercase tracking-[0.2em] text-black transition-all duration-500 hover:text-white disabled:opacity-50 disabled:bg-gray-100 disabled:border-gray-200"
                            >
                              <div className="absolute inset-0 h-full w-full translate-y-[100%] bg-black transition-transform duration-500 ease-[cubic-bezier(0.87,0,0.13,1)] group-hover:translate-y-0 group-disabled:hidden" />
                              <span className="relative z-10 transition-colors duration-500">
                                Approve
                              </span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* TAB 2: REGISTERED STUDIOS */}
            {activeTab === "directory" && (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-black">
                    <th className="py-4 font-sans text-[9px] uppercase tracking-[0.3em] text-black font-medium">Join Date</th>
                    <th className="py-4 font-sans text-[9px] uppercase tracking-[0.3em] text-black font-medium">Studio Name</th>
                    <th className="py-4 font-sans text-[9px] uppercase tracking-[0.3em] text-black font-medium">Login Email</th>
                    <th className="py-4 font-sans text-[9px] uppercase tracking-[0.3em] text-black font-medium text-center">System Status</th>
                    <th className="py-4 font-sans text-[9px] uppercase tracking-[0.3em] text-black font-medium text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody>
                  {directory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-32 text-center font-editorial italic text-gray-400 text-2xl">
                        No studios registered yet.
                      </td>
                    </tr>
                  )}
                  {directory.map((vendor) => (
                    <tr 
                      key={vendor._id} 
                      onClick={() => openVendorDossier(vendor)}
                      className="border-b border-gray-200 group hover:bg-white transition-colors cursor-pointer"
                    >
                      <td className="py-8 font-sans text-[10px] tracking-widest text-gray-500">
                        {new Date(vendor.owner?.createdAt || Date.now()).toLocaleDateString()}
                      </td>
                      <td className="py-8 font-editorial text-2xl text-black group-hover:text-gray-500 transition-colors">
                        {vendor.name || 'Unnamed Studio'}
                      </td>
                      <td className="py-8 font-sans text-[10px] tracking-wider text-black">
                        {vendor.owner?.email || 'N/A'}
                      </td>
                      <td className="py-8 text-center">
                        {vendor.owner?.isActive ? (
                           <span className="font-sans text-[8px] font-bold uppercase tracking-[0.2em] px-4 py-2 border border-green-200 text-green-500 bg-green-100">
                             Active
                           </span>
                        ) : (
                           <span className="font-sans text-[8px] font-bold uppercase tracking-[0.2em] px-4 py-2 border border-red-200 text-red-500 bg-red-50">
                             Suspended
                           </span>
                        )}
                      </td>
                      <td className="py-8 text-right">
                         <button 
                            disabled={processingId === vendor._id}
                            onClick={(e) => handleToggleSuspension(e, vendor._id)}
                            className={`font-sans text-[9px] font-bold uppercase tracking-[0.2em] transition-colors underline underline-offset-4 disabled:opacity-50 ${
                              vendor.owner?.isActive 
                                ? 'text-gray-400 hover:text-red-500' 
                                : 'text-black hover:text-green-500'
                            }`}
                         >
                            {vendor.owner?.isActive ? 'Suspend Access' : 'Restore Access'}
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* --- CUSTOM MODAL OVERLAY --- */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#FCFCFA] border border-black p-10 md:p-14 max-w-lg w-full shadow-2xl animate-modal flex flex-col">
            
            <div className="mb-8">
              <h3 className="font-editorial text-4xl font-light text-black mb-4">
                {modalConfig.title}
              </h3>
              <div className="h-px w-12 bg-gray-300 mb-6"></div>
              <p className="font-sans text-[11px] leading-relaxed tracking-widest text-gray-500 uppercase">
                {modalConfig.message}
              </p>
            </div>

            <div className="flex justify-end items-center gap-6 mt-auto">
              {modalConfig.type === 'confirm' && (
                <button
                  onClick={closeModal}
                  className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  closeModal();
                  if (modalConfig.type === 'confirm' && modalConfig.onConfirm) {
                    modalConfig.onConfirm();
                  }
                }}
                className="group relative inline-flex overflow-hidden border border-black px-8 py-4 text-[9px] font-bold uppercase tracking-[0.2em] text-black transition-all duration-500 hover:text-white"
              >
                <div className="absolute inset-0 h-full w-full translate-y-[100%] bg-black transition-transform duration-500 ease-[cubic-bezier(0.87,0,0.13,1)] group-hover:translate-y-0" />
                <span className="relative z-10 transition-colors duration-500">
                  {modalConfig.type === 'confirm' ? 'Confirm Action' : 'Acknowledge'}
                </span>
              </button>
            </div>
            
          </div>
        </div>
      )}

    </>
  );
};

export default AdminApplicationsPage;