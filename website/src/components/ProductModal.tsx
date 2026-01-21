'use client';

import { Product } from '@/types/Product';
import React from 'react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  title: string;
  children: React.ReactNode;
  product?: Product;
  isSubmitting?: boolean;
}

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSave, title, children, product, isSubmitting }) => {
  if (!isOpen) {
    return null;
  }

  const modalTitle = product ? 'Edit Product' : title;
  const saveButtonText = product ? 'Save Changes' : 'Save Product';

  return (
    <div className="fixed inset-0 bg-gray-100 z-50 overflow-y-auto">
      <div className="flex flex-col min-h-screen">
        <div className="bg-white shadow-md sticky top-0 z-10">
          <div className="container mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold text-gray-900">{modalTitle}</h2>
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-red-600 text-4xl font-bold"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
        <div className="flex-grow container mx-auto px-6 py-8">
          {React.cloneElement(children as React.ReactElement<{ product?: Product }>, { product })}
        </div>
        <div className="bg-white shadow-md sticky bottom-0 z-10">
          <div className="container mx-auto px-6 py-4 flex justify-end items-center">
            <button
              onClick={onClose}
              className="text-lg font-semibold text-gray-700 hover:text-gray-900 mr-6"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="bg-purple-600 text-white px-8 py-3 rounded-lg shadow-md hover:bg-purple-700 text-lg font-semibold disabled:bg-gray-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : saveButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
