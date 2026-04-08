"use client";

import React, { useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

const ApplicationPage = () => {
  const [formData, setFormData] = useState({
    studioName: "",
    email: "",
    websiteOrPortfolio: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/vendors/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setMessage(data.message || "Failed to submit application.");
      }
    } catch (error) {
      setStatus("error");
      setMessage("A network error occurred. Please try again.");
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
      <div className="min-h-screen bg-[#FCFCFA] text-black font-sans selection:bg-black selection:text-white flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          
          <div className="text-center mb-12">
            <h1 className="font-editorial text-4xl md:text-5xl font-light tracking-tight mb-4">
              Studio <span className="font-cursive text-5xl md:text-6xl lowercase text-gray-400">application</span>
            </h1>
            <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gray-500 leading-relaxed mt-4">
              Submit your dossier for review. <br/> Access is strictly curated.
            </p>
          </div>

          {status === "success" ? (
            <div className="border border-black p-8 text-center space-y-6">
              <p className="font-editorial text-xl">Dossier Received</p>
              <p className="font-sans text-xs tracking-widest text-gray-500 leading-relaxed">
                Your application has been added to the archive for review. You will receive an electronic transmission once a decision has been made.
              </p>
              <Link href="/" className="block w-full bg-black text-white py-4 font-sans text-[10px] uppercase tracking-[0.3em] hover:bg-gray-800 transition-colors">
                Return to Surface
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <div>
                <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">
                  Studio / Brand Name
                </label>
                <input
                  type="text"
                  name="studioName"
                  value={formData.studioName}
                  onChange={handleInputChange}
                  className="w-full border-b border-gray-300 bg-transparent py-3 text-lg focus:border-black focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full border-b border-gray-300 bg-transparent py-3 text-lg focus:border-black focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2">
                  Digital Footprint (URL)
                </label>
                <input
                  type="url"
                  name="websiteOrPortfolio"
                  placeholder="https://..."
                  value={formData.websiteOrPortfolio}
                  onChange={handleInputChange}
                  className="w-full border-b border-gray-300 bg-transparent py-3 text-sm focus:border-black focus:outline-none transition-colors"
                  required
                />
                <p className="font-sans text-[8px] uppercase tracking-[0.1em] text-gray-400 mt-2">
                  Link your portfolio, Instagram, or current storefront.
                </p>
              </div>

              {status === "error" && (
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-red-600 text-center">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full border border-black bg-black text-white py-4 font-sans text-[10px] uppercase tracking-[0.3em] hover:bg-transparent hover:text-black transition-colors disabled:opacity-50"
              >
                {status === "loading" ? "Transmitting..." : "Submit Application"}
              </button>

              <div className="text-center pt-4 border-t border-gray-200">
                <Link href="/login" className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors">
                  Already approved? Login here
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default ApplicationPage;