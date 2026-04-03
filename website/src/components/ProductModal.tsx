"use client";

import { Product } from "@/types/Product";
import React, { useEffect } from "react";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  title: string;
  children: React.ReactNode;
  product?: Product;
  isSubmitting?: boolean;
}

const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  children,
  product,
  isSubmitting,
}) => {
  // --- Prevent Background Scrolling ---
  useEffect(() => {
    if (isOpen) {
      // Lock the scroll
      document.body.style.overflow = "hidden";
    } else {
      // Unlock the scroll
      document.body.style.overflow = "";
    }

    // Cleanup function to ensure scrolling unlocks if the component unmounts
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Hook rules dictate we put early returns AFTER the hooks
  if (!isOpen) {
    return null;
  }

  const modalTitle = product ? "Modify Dossier" : "New Archive Entry";
  const saveButtonText = product ? "Update Piece" : "Initialize Entry";

  return (
    <div className="fixed inset-0 z-50 flex w-full h-screen flex-col bg-[#FCFCFA] animate-in fade-in duration-300">
      {/* Strictly Anchored Full-Width Header */}
      <div className="flex-none flex items-center justify-between border-b border-black bg-[#FCFCFA] px-8 md:px-16 lg:px-24 py-8 z-20">
        <div>
          <p className="font-sans text-[8px] font-medium uppercase tracking-[0.4em] text-gray-400 mb-2">
            {product ? "Editing Mode" : "Creation Mode"}
          </p>
          <h2 className="font-editorial text-4xl font-light text-black tracking-tight">
            {modalTitle}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="group flex items-center gap-3 p-2 transition-colors"
        >
          <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-black group-hover:text-red-600 transition-colors">
            Close
          </span>
          <span className="text-2xl font-light leading-none group-hover:text-red-600 transition-colors">
            &times;
          </span>
        </button>
      </div>

      {/* Clean Scrolling Content Area */}
      <div className="flex-1 overflow-y-auto px-8 md:px-16 lg:px-24 py-12 lg:py-16">
        {/* We constrain the form width so it doesn't stretch awkwardly on ultrawide monitors */}
        <div className="max-w-5xl mx-auto">
          {React.cloneElement(
            children as React.ReactElement<{ product?: Product }>,
            { product },
          )}
        </div>
      </div>

      {/* Strictly Anchored Full-Width Footer */}
      <div className="flex-none flex items-center justify-between border-t border-black bg-[#FCFCFA] px-8 md:px-16 lg:px-24 py-6 z-20">
        <p className="font-sans text-[9px] uppercase tracking-[0.3em] text-gray-400 hidden sm:block">
          {isSubmitting ? "Syncing to network..." : "Awaiting confirmation"}
        </p>

        <div className="flex items-center justify-end w-full sm:w-auto gap-8">
          <button
            onClick={onClose}
            className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 hover:text-black transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            Discard
          </button>

          <button
            onClick={onSave}
            disabled={isSubmitting}
            className="group relative inline-flex overflow-hidden border border-black bg-black px-10 py-4 text-[10px] font-medium uppercase tracking-[0.3em] text-white transition-all duration-500 hover:text-black disabled:border-gray-300 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 h-full w-full translate-y-[100%] bg-[#FCFCFA] transition-transform duration-500 ease-[cubic-bezier(0.87,0,0.13,1)] group-hover:translate-y-0 group-disabled:hidden" />
            <span className="relative z-10 transition-colors duration-500">
              {isSubmitting ? "Authenticating..." : saveButtonText}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
