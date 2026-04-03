"use client";

import { Product } from "@/types/Product";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import ProductForm from "@/components/ProductForm";
import { useAuth } from "@/contexts/AuthContext";
import ProductModal from "@/components/ProductModal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const ProductsPage = () => {
  const { user, token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const formRef = useRef<{ isSubmitting: boolean; submit: () => void; clearForm: () => void } | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/products?vendor=${user._id}`,
      );
      console.log(user._id);
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleDelete = async (productId: string | undefined) => {
    if (
      window.confirm(
        "Are you certain you wish to remove this piece from your archive?",
      )
    ) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/products/${productId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (response.ok) {
          fetchProducts();
        } else {
          console.error("Failed to delete product");
        }
      } catch (error) {
        console.error("Failed to delete product:", error);
      }
    }
  };

  const handleEdit = (product: Product | undefined) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  useEffect(() => {
    fetchProducts();
  }, [user, fetchProducts]);

  const handleSaveSuccess = () => {
    setIsModalOpen(false);
    setEditingProduct(undefined);
    if (formRef.current) {
      formRef.current.clearForm();
    }
    fetchProducts();
  };

  const handleSave = () => {
    if (formRef.current) {
      formRef.current.submit();
    }
  };

  const isSubmitting = formRef.current?.isSubmitting || false;

  return (
    <>
      {/* Injecting our editorial fonts */}
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
              Vendor Dashboard
            </p>
            <h1 className="font-editorial text-5xl md:text-6xl font-light tracking-tight text-black">
              The{" "}
              <span className="font-cursive text-6xl md:text-7xl lowercase text-gray-400 -ml-2">
                archive
              </span>
            </h1>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="group relative inline-flex overflow-hidden bg-black px-8 py-4 text-[10px] font-medium uppercase tracking-[0.3em] text-white transition-all duration-500 hover:tracking-[0.4em]"
          >
            <div className="absolute inset-0 h-full w-full -translate-x-full bg-zinc-800 transition-transform duration-700 ease-[cubic-bezier(0.87,0,0.13,1)] group-hover:translate-x-0" />
            <span className="relative z-10 transition-colors duration-500">
              Add to Collection
            </span>
          </button>
        </div>

        {/* Modal Component */}
        <ProductModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingProduct(undefined);
          }}
          onSave={handleSave}
          title={editingProduct ? "Edit Piece" : "Add New Piece"}
          product={editingProduct}
          isSubmitting={isSubmitting}
        >
          <ProductForm ref={formRef} onSave={handleSaveSuccess} />
        </ProductModal>

        {/* Products Grid */}
        <div>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-gray-400 animate-pulse">
                Retrieving Collection...
              </p>
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
              {products.map((product) => (
                <div key={product._id} className="group relative flex flex-col">
                  {/* High-Fashion Image Container (4:5 Aspect Ratio) */}
                  <div className="relative w-full aspect-4/5 overflow-hidden bg-[#F2F2F0] mb-5">
                    {product.images && product.images.length > 0 ? (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-[15s] ease-out group-hover:scale-110"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="font-editorial italic text-gray-400">
                          No Imagery
                        </span>
                      </div>
                    )}

                    {/* Hover Actions Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity duration-500 group-hover:opacity-100 flex flex-col items-center justify-center gap-4">
                      <button
                        onClick={() => handleEdit(product)}
                        className="bg-white px-6 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-black hover:bg-gray-200 transition-colors w-32"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(product._id)}
                        className="bg-red-900 px-6 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white hover:bg-red-950 transition-colors w-32"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-editorial text-xl font-normal text-black pr-4 leading-snug">
                        {product.name}
                      </h3>
                      <p className="font-sans text-[11px] font-medium tracking-widest text-black uppercase mt-1 shrink-0">
                        ${product.basePrice.toFixed(2)}
                      </p>
                    </div>

                    {/* Minimalist Variants List */}
                    {product.variants && product.variants.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400 mb-3">
                          Available Variants
                        </p>
                        <div className="flex flex-col gap-2">
                          {product.variants.map((variant, index) => (
                            <div
                              key={index}
                              className="flex justify-between items-center text-[10px] tracking-wider text-gray-600"
                            >
                              <span className="uppercase">
                                {variant.options ? Object.entries(variant.options).map(([key, value]) => `${key}: ${value}`).join(" · ") : ''}
                              </span>
                              <div className="flex gap-3 text-gray-400">
                                <span>QTY: {Object.values(variant.stock).reduce((sum, qty) => sum + qty, 0)}</span>
                                <span className="text-black">
                                  ${variant.price.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              {/* Elegant Empty State */}
              <span className="font-cursive text-7xl text-gray-300 mb-2">
                Empty
              </span>
              <h2 className="font-editorial text-3xl font-light tracking-tight text-black mb-6">
                The Archive is Bare
              </h2>
              <p className="font-sans text-[10px] tracking-[0.2em] text-gray-500 uppercase max-w-md leading-relaxed">
                Your studio currently holds no pieces. Click &quot;Add to
                Collection&quot; above to begin curating your storefront.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProductsPage;
