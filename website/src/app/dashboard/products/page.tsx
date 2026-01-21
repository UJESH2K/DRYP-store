'use client';

import { Product } from '@/types/Product';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image'; // Import Image component
import ProductForm from '@/components/ProductForm';
import { useAuth } from '@/contexts/AuthContext';

import ProductModal from '@/components/ProductModal';

const ProductsPage = () => {
  const { user, token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const formRef = useRef(null);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/products?vendor=${user._id}`);
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleDelete = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        const response = await fetch(`/api/products/${productId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          fetchProducts();
        } else {
          console.error('Failed to delete product');
        }
      } catch (error) {
        console.error('Failed to delete product:', error);
      }
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  useEffect(() => {
    fetchProducts();
  }, [user, fetchProducts]);

  const handleSaveSuccess = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
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
    <div className="p-8">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900">My Products</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-purple-700 text-lg font-semibold"
        >
          Add a New Product
        </button>
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSave}
        title="Add a New Product"
        product={editingProduct}
        isSubmitting={isSubmitting}
      >
        <ProductForm ref={formRef} onSave={handleSaveSuccess} />
      </ProductModal>

      <div>
        <h2 className="text-3xl font-bold mb-6 text-gray-900">Existing Products</h2>
        {loading ? (
          <p className="text-lg text-gray-600">Loading products...</p>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <div key={product._id} className="bg-white p-8 rounded-xl shadow-lg">
                {product.images && product.images.length > 0 && (
                  <div className="relative w-full h-56 mb-6">
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="rounded-lg object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-3 text-gray-900">{product.name}</h3>
                <div className="flex justify-between items-center">
                  <p className="text-xl text-gray-900 font-bold mt-4">Base Price: ${product.basePrice.toFixed(2)}</p>
                  <button
                    onClick={() => handleEdit(product)}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-600 text-sm font-semibold mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product._id)}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-md hover:bg-red-600 text-sm font-semibold"
                  >
                    Delete
                  </button>
                </div>

                {product.variants && product.variants.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-xl font-semibold mb-3 text-gray-800">Variants:</h4>
                    <ul className="space-y-4">
                      {product.variants.map((variant, index) => (
                        <li key={index} className="bg-gray-100 p-4 rounded-lg">
                          <p className="text-lg">
                            {Object.entries(variant.options).map(([key, value]) => (
                              <span key={key} className="mr-4">
                                <span className="font-semibold">{key}:</span> {value}
                              </span>
                            ))}
                          </p>
                          <p className="text-lg text-gray-800">Stock: {variant.stock}</p>
                          <p className="text-lg text-gray-800">Price: ${variant.price.toFixed(2)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-2xl text-gray-600">You have not added any products yet.</p>
            <p className="text-lg text-gray-500 mt-2">Click the &quot;Add a New Product&quot; button to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
