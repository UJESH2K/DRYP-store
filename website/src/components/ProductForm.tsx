'use client';

import { Product } from '@/types/Product';
import React, { useState, useImperativeHandle, useEffect } from 'react';
import Image from 'next/image';

import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// A reusable input component for styling consistency
import ImageCropper from './ImageCropper';

const Input = ({ label, name, value, onChange, type = 'text', placeholder, disabled = false }) => (
  <div className="mb-4">
    <label htmlFor={name} className="block text-lg font-medium text-gray-800 mb-1">
      {label}
    </label>
    <div className="mt-1">
      <input
        type={type}
        name={name}
        id={name}
        value={value}
        onChange={onChange}
        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-lg disabled:bg-gray-200 p-3"
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  </div>
);

const TextArea = ({ label, name, value, onChange, placeholder, disabled = false }) => (
    <div className="mb-4">
      <label htmlFor={name} className="block text-lg font-medium text-gray-800 mb-1">
        {label}
      </label>
      <div className="mt-1">
        <textarea
          name={name}
          id={name}
          value={value}
          onChange={onChange}
          rows={4}
          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-lg disabled:bg-gray-200 p-3"
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
    </div>
  );

const ProductForm = React.forwardRef(({ onSave, product }: { onSave: () => void; product?: Product }, ref) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    brand: '',
    category: '',
    tags: '',
    basePrice: '',
  });
  const [variants, setVariants] = useState([{ color: '', sizes: '', price: '', stock: {}, images: [] }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [croppingImage, setCroppingImage] = useState<{ variantIndex: number; image: string } | null>(null);
  const [croppedImage, setCroppedImage] = useState<{ variantIndex: number; file: File } | null>(null);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      brand: '',
      category: '',
      tags: '',
      basePrice: '',
    });
    setVariants([{ color: '', sizes: '', price: '', stock: {}, images: [] }]);
  };

  const handleProductChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleVariantChange = (index, e) => {
    const { name, value } = e.target;
    console.log(`handleVariantChange: index=${index}, name=${name}, value=${value}`);
    const newVariants = [...variants];
    newVariants[index][name] = value;

    if (name === 'sizes') {
        const sizesArray = value.split(',').map(s => s.trim()).filter(Boolean);
        const newStock = {};
        sizesArray.forEach(size => {
            newStock[size] = newVariants[index].stock[size] || '0';
        });
        newVariants[index].stock = newStock;
    }
    setVariants(newVariants);
  };

  const handleStockChange = (variantIndex, size, value) => {
    const newVariants = [...variants];
    newVariants[variantIndex].stock[size] = value;
    setVariants(newVariants);
  }

  const handleImageSelect = async (variantIndex, e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.onload = () => {
          if (img.width > 736 || img.height > 981) {
            setCroppingImage({ variantIndex, image: reader.result as string });
          } else {
            uploadImage(variantIndex, file);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async (croppedImageUrl: string) => {
    if (croppingImage) {
      const { variantIndex } = croppingImage;
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });
      setCroppedImage({ variantIndex, file });
      setCroppingImage(null);
    }
  };

  const uploadImage = async (variantIndex, imageFile) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', imageFile);

    try {
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.url) {
        const newVariants = [...variants];
        newVariants[variantIndex].images.push(data.url);
        setVariants(newVariants);
      } else {
        throw new Error(data.message || 'Image upload failed');
      }
    } catch (error) {
      alert(`Error uploading image: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (variantIndex, imageIndex) => {
    const newVariants = [...variants];
    newVariants[variantIndex].images.splice(imageIndex, 1);
    setVariants(newVariants);
  };

  const addVariant = () => {
    setVariants([...variants, { color: '', sizes: '', price: '', stock: {}, images: [] }]);
  };

  const removeVariant = (index) => {
    const newVariants = variants.filter((_, i) => i !== index);
    setVariants(newVariants);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (croppedImage) {
      await uploadImage(croppedImage.variantIndex, croppedImage.file);
      setCroppedImage(null);
    }

    setIsSubmitting(true);

    const allVariantImages = variants.flatMap(v => v.images);
    
    const productData = {
      ...formData,
      basePrice: parseFloat(formData.basePrice),
      tags: formData.tags.split(',').map(t => t.trim()),
      images: allVariantImages,
      options: [],
      variants: [],
    };
    
    const allColors = variants.map(v => v.color).filter(Boolean);
    const allSizes = [...new Set(variants.flatMap(v => v.sizes.split(',').map(s => s.trim()).filter(Boolean)))];
    
    if (allColors.length > 0) {
      productData.options.push({ name: 'Color', values: allColors });
    }
    if (allSizes.length > 0) {
      productData.options.push({ name: 'Size', values: allSizes });
    }

    variants.forEach(variant => {
      const sizes = variant.sizes.split(',').map(s => s.trim()).filter(Boolean);
      sizes.forEach(size => {
        const newVariantPayload = {
          options: { Color: variant.color, Size: size },
          stock: parseInt(variant.stock[size] || '0', 10),
          price: parseFloat(variant.price || formData.basePrice),
          images: variant.images,
        };
        productData.variants.push(newVariantPayload);
      });
    });

    const method = product?._id ? 'PUT' : 'POST';
    const url = product?._id ? `${API_BASE_URL}/api/products/${product._id}` : `${API_BASE_URL}/api/products`;

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(productData),
        });

        const result = await res.json();
        if (res.ok) {
            alert(`Product '${formData.name}' ${product?._id ? 'updated' : 'created'} successfully!`);
            resetForm();
            if (onSave) {
              onSave();
            }
        } else {
            throw new Error(result.message || `Failed to ${product?._id ? 'update' : 'create'} product`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  useImperativeHandle(ref, () => ({
    submit: handleSubmit,
    clearForm: resetForm,
    isSubmitting,
  }));

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        brand: product.brand || '',
        category: product.category || '',
        tags: Array.isArray(product.tags) ? product.tags.join(', ') : '',
        basePrice: product.basePrice || '',
      });

      if (product.variants && product.variants.length > 0) {
        setVariants(product.variants.map(v => ({
          ...v,
          sizes: v.options && v.options.Size ? v.options.Size : '',
          color: v.options && v.options.Color ? v.options.Color : '',
          price: v.price || '',
          stock: v.stock || {},
          images: v.images || [],
        })));
      } else {
        setVariants([{ color: '', sizes: '', price: '', stock: {}, images: [] }]);
      }
    }
  }, [product]);

  return (
    <form className="space-y-8">
      {croppingImage && (
        <ImageCropper
          image={croppingImage.image}
          onCropComplete={(croppedImageUrl) => {
            console.log('onCropComplete called with:', croppedImageUrl);
            handleCropComplete(croppedImageUrl);
          }}
          onCancel={() => setCroppingImage(null)}
        />
      )}
      {/* Product Details Section */}
      <div className="bg-white p-8 shadow-lg rounded-xl">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Product Details</h2>
        <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6">
          <div className="sm:col-span-4">
            <Input label="Product Name" name="name" value={formData.name} onChange={handleProductChange} placeholder="e.g., Classic Denim Jacket" disabled={isSubmitting} />
          </div>
          <div className="sm:col-span-6"><TextArea label="Description" name="description" value={formData.description} onChange={handleProductChange} placeholder="A brief description of the product." disabled={isSubmitting} /></div>
          <div className="sm:col-span-3"><Input label="Brand" name="brand" value={formData.brand} onChange={handleProductChange} placeholder="e.g., Urban Threads" disabled={isSubmitting} /></div>
          <div className="sm:col-span-3"><Input label="Category" name="category" value={formData.category} onChange={handleProductChange} placeholder="e.g., Jackets" disabled={isSubmitting} /></div>
          <div className="sm:col-span-4"><Input label="Tags (comma-separated)" name="tags" value={formData.tags} onChange={handleProductChange} placeholder="e.g., Outerwear, Casual, Denim" disabled={isSubmitting} /></div>
          <div className="sm:col-span-2"><Input label="Base Price" name="basePrice" type="number" value={formData.basePrice} onChange={handleProductChange} placeholder="e.g., 99.99" disabled={isSubmitting} /></div>
        </div>
      </div>

      {/* Variants Section */}
      <div className="bg-white p-8 shadow-lg rounded-xl">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Product Variants</h2>
        <div className="space-y-8">
          {variants.map((variant, index) => (
            <div key={index} className="border-t border-gray-200 pt-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Variant {index + 1}</h3>
                {variants.length > 1 && <button type="button" onClick={() => removeVariant(index)} className="text-red-600 hover:text-red-800 font-semibold" disabled={isSubmitting}>Remove</button>}
              </div>
              <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6">
                <div className="sm:col-span-2"><Input label="Color" name="color" value={variant.color} onChange={(e) => handleVariantChange(index, e)} placeholder="e.g., Classic Blue" disabled={isSubmitting} /></div>
                <div className="sm:col-span-2"><Input label="Sizes (comma-separated)" name="sizes" value={variant.sizes} onChange={(e) => handleVariantChange(index, e)} placeholder="e.g., S, M, L" disabled={isSubmitting} /></div>
                <div className="sm:col-span-2"><Input label="Variant Price" name="price" type="number" value={variant.price} onChange={(e) => handleVariantChange(index, e)} placeholder="Overrides base price" disabled={isSubmitting} /></div>
                
                <div className="sm:col-span-6">
  <h4 className="text-lg font-medium text-gray-800 mb-2">Stock per Size</h4>
  {variant.sizes ? (
    <div className="grid grid-cols-3 gap-4">
      {Object.keys(variant.stock).map(size => (
        <Input
          key={size}
          label={`Stock for ${size}`}
          name={size}
          type="number"
          value={variant.stock[size]}
          onChange={(e) => handleStockChange(index, size, e.target.value)}
          placeholder="0"
          disabled={isSubmitting}
        />
      ))}
    </div>
  ) : (
    <p className="text-gray-600">Enter sizes to add stock.</p>
  )}
</div>

                <div className="sm:col-span-6">
                    <label className="block text-lg font-medium text-gray-800">Variant Images</label>
                    <div className="mt-2 flex items-center gap-4">
                        <input type="file" multiple onChange={(e) => handleImageSelect(index, e)} className="text-lg text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-lg file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200" disabled={isSubmitting} />
                        {isUploading && <span className="text-lg text-gray-600">Uploading...</span>}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4">
                        {variant.images.map((imgUrl, imgIndex) => (
                            <div key={imgIndex} className="relative">
                                <Image src={imgUrl} alt="product preview" fill className="rounded-xl object-cover shadow-md" sizes="96px" />
                                <button type="button" onClick={() => handleRemoveImage(index, imgIndex)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold" disabled={isSubmitting}>&times;</button>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addVariant} className="mt-8 w-full rounded-lg border-2 border-dashed border-gray-400 bg-white py-3 text-lg font-semibold text-gray-800 shadow-sm hover:bg-gray-100" disabled={isSubmitting}>Add Another Variant</button>
      </div>
    </form>
  );
});

ProductForm.displayName = 'ProductForm';

export default ProductForm;
