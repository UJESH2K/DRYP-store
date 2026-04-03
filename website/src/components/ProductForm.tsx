"use client";

import { Product } from "@/types/Product";
import React, { useState, useImperativeHandle, useEffect } from "react";
import Image from "next/image";

import { useAuth } from "@/contexts/AuthContext";
import ImageCropper from "./ImageCropper";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// --- Minimalist Editorial Input Components ---
const Input = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false,
}) => (
  <div className="mb-6 relative">
    <label
      htmlFor={name}
      className="block font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-2 transition-colors focus-within:text-black"
    >
      {label}
    </label>
    <input
      type={type}
      name={name}
      id={name}
      value={value}
      onChange={onChange}
      className="block w-full border-b border-gray-200 bg-transparent pb-2 pt-1 text-sm text-black placeholder-gray-300 transition-all focus:border-black focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      placeholder={placeholder}
      disabled={disabled}
    />
  </div>
);

const TextArea = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  disabled = false,
}) => (
  <div className="mb-6 relative">
    <label
      htmlFor={name}
      className="block font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-2 transition-colors focus-within:text-black"
    >
      {label}
    </label>
    <textarea
      name={name}
      id={name}
      value={value}
      onChange={onChange}
      rows={3}
      className="block w-full border-b border-gray-200 bg-transparent pb-2 pt-1 text-sm text-black placeholder-gray-300 transition-all focus:border-black focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed"
      placeholder={placeholder}
      disabled={disabled}
    />
  </div>
);

const ProductForm = React.forwardRef(
  ({ onSave, product }: { onSave: () => void; product?: Product }, ref) => {
    const { token } = useAuth();
    const [formData, setFormData] = useState({
      name: "",
      description: "",
      brand: "",
      category: "",
      tags: "",
      basePrice: "",
    });
    const [variants, setVariants] = useState([
      { color: "", sizes: "", price: "", stock: {}, images: [] },
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [croppingImage, setCroppingImage] = useState<{
      variantIndex: number;
      image: string;
    } | null>(null);
    const [croppedImage, setCroppedImage] = useState<{
      variantIndex: number;
      file: File;
    } | null>(null);

    const resetForm = () => {
      setFormData({
        name: "",
        description: "",
        brand: "",
        category: "",
        tags: "",
        basePrice: "",
      });
      setVariants([{ color: "", sizes: "", price: "", stock: {}, images: [] }]);
    };

    const handleProductChange = (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleVariantChange = (index, e) => {
      const { name, value } = e.target;
      const newVariants = [...variants];
      newVariants[index][name] = value;

      if (name === "sizes") {
        const sizesArray = value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const newStock = {};
        sizesArray.forEach((size) => {
          newStock[size] = newVariants[index].stock[size] || "0";
        });
        newVariants[index].stock = newStock;
      }
      setVariants(newVariants);
    };

    const handleStockChange = (variantIndex, size, value) => {
      const newVariants = [...variants];
      newVariants[variantIndex].stock[size] = value;
      setVariants(newVariants);
    };

    const handleImageSelect = async (variantIndex, e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      for (const file of files) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = document.createElement("img");
          img.onload = () => {
            if (img.width > 736 || img.height > 981) {
              setCroppingImage({
                variantIndex,
                image: reader.result as string,
              });
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
        const file = new File([blob], "cropped-image.jpg", {
          type: "image/jpeg",
        });
        setCroppedImage({ variantIndex, file });
        setCroppingImage(null);
      }
    };

    const uploadImage = async (variantIndex, imageFile) => {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("image", imageFile);

      try {
        const res = await fetch(`${API_BASE_URL}/api/upload`, {
          method: "POST",
          body: formData,
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (res.ok && data.url) {
          const newVariants = [...variants];
          newVariants[variantIndex].images.push(data.url);
          setVariants(newVariants);
        } else {
          throw new Error(data.message || "Image upload failed");
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
      setVariants([
        ...variants,
        { color: "", sizes: "", price: "", stock: {}, images: [] },
      ]);
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
      const allVariantImages = variants.flatMap((v) => v.images);

      const productData = {
        ...formData,
        basePrice: parseFloat(formData.basePrice),
        tags: formData.tags.split(",").map((t) => t.trim()),
        images: allVariantImages,
        options: [],
        variants: [],
      };

      const allColors = variants.map((v) => v.color).filter(Boolean);
      const allSizes = [
        ...new Set(
          variants.flatMap((v) =>
            v.sizes
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ),
      ];

      if (allColors.length > 0)
        productData.options.push({ name: "Color", values: allColors });
      if (allSizes.length > 0)
        productData.options.push({ name: "Size", values: allSizes });

      variants.forEach((variant) => {
        const sizes = variant.sizes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        sizes.forEach((size) => {
          productData.variants.push({
            options: { Color: variant.color, Size: size },
            stock: parseInt(variant.stock[size] || "0", 10),
            price: parseFloat(variant.price || formData.basePrice),
            images: variant.images,
          });
        });
      });

      const method = product?._id ? "PUT" : "POST";
      const url = product?._id
        ? `${API_BASE_URL}/api/products/${product._id}`
        : `${API_BASE_URL}/api/products`;

      try {
        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(productData),
        });

        const result = await res.json();
        if (res.ok) {
          resetForm();
          if (onSave) onSave();
        } else {
          throw new Error(
            result.message ||
              `Failed to ${product?._id ? "update" : "create"} product`,
          );
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
          name: product.name || "",
          description: product.description || "",
          brand: product.brand || "",
          category: product.category || "",
          tags: Array.isArray(product.tags) ? product.tags.join(", ") : "",
          basePrice: product.basePrice || "",
        });

        if (product.variants && product.variants.length > 0) {
          setVariants(
            product.variants.map((v) => ({
              ...v,
              sizes: v.options && v.options.Size ? v.options.Size : "",
              color: v.options && v.options.Color ? v.options.Color : "",
              price: v.price || "",
              stock: v.stock || {},
              images: v.images || [],
            })),
          );
        } else {
          setVariants([
            { color: "", sizes: "", price: "", stock: {}, images: [] },
          ]);
        }
      }
    }, [product]);

    return (
      <form className="space-y-12">
        {croppingImage && (
          <ImageCropper
            image={croppingImage.image}
            onCropComplete={(croppedImageUrl) =>
              handleCropComplete(croppedImageUrl)
            }
            onCancel={() => setCroppingImage(null)}
          />
        )}

        {/* --- Core Details --- */}
        <div>
          <div className="grid grid-cols-1 gap-y-6 gap-x-8 md:grid-cols-12">
            <div className="md:col-span-8">
              <Input
                label="Product Name"
                name="name"
                value={formData.name}
                onChange={handleProductChange}
                placeholder="e.g. Oversized Linen Blazer"
                disabled={isSubmitting}
              />
            </div>
            <div className="md:col-span-4">
              <Input
                label="Base Price (USD)"
                name="basePrice"
                type="number"
                value={formData.basePrice}
                onChange={handleProductChange}
                placeholder="0.00"
                disabled={isSubmitting}
              />
            </div>
            <div className="md:col-span-12">
              <TextArea
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleProductChange}
                placeholder="Enter material, cut, and conceptual details..."
                disabled={isSubmitting}
              />
            </div>
            <div className="md:col-span-4">
              <Input
                label="Brand / House"
                name="brand"
                value={formData.brand}
                onChange={handleProductChange}
                placeholder="Brand Name"
                disabled={isSubmitting}
              />
            </div>
            <div className="md:col-span-4">
              <Input
                label="Category"
                name="category"
                value={formData.category}
                onChange={handleProductChange}
                placeholder="e.g. Outerwear"
                disabled={isSubmitting}
              />
            </div>
            <div className="md:col-span-4">
              <Input
                label="Tags (Comma Separated)"
                name="tags"
                value={formData.tags}
                onChange={handleProductChange}
                placeholder="SS26, Linen, Tailored"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* --- Variants --- */}
        <div className="pt-8 border-t border-black">
          <h3 className="font-editorial text-2xl font-light tracking-tight text-black mb-8">
            Collections & Variants
          </h3>

          <div className="space-y-12">
            {variants.map((variant, index) => (
              <div
                key={index}
                className="bg-gray-50/50 p-6 md:p-8 border border-gray-100 relative"
              >
                <div className="flex justify-between items-end border-b border-gray-200 pb-4 mb-8">
                  <h4 className="font-sans text-[10px] font-bold uppercase tracking-[0.3em] text-black">
                    Variant 0{index + 1}
                  </h4>
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-red-500 hover:text-red-800 transition-colors"
                      disabled={isSubmitting}
                    >
                      Remove Variant
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-y-6 gap-x-8 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <Input
                      label="Color / Wash"
                      name="color"
                      value={variant.color}
                      onChange={(e) => handleVariantChange(index, e)}
                      placeholder="e.g. Midnight Onyx"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Input
                      label="Sizes (Comma Separated)"
                      name="sizes"
                      value={variant.sizes}
                      onChange={(e) => handleVariantChange(index, e)}
                      placeholder="36, 38, 40"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Input
                      label="Price Override (Optional)"
                      name="price"
                      type="number"
                      value={variant.price}
                      onChange={(e) => handleVariantChange(index, e)}
                      placeholder="Leaves blank for base"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Dynamic Stock Grid */}
                  <div className="md:col-span-12 mt-2">
                    <h5 className="font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">
                      Inventory Allocation
                    </h5>
                    {variant.sizes ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-white p-6 border border-gray-100">
                        {Object.keys(variant.stock).map((size) => (
                          <Input
                            key={size}
                            label={`Size: ${size}`}
                            name={size}
                            type="number"
                            value={variant.stock[size]}
                            onChange={(e) =>
                              handleStockChange(index, size, e.target.value)
                            }
                            placeholder="0"
                            disabled={isSubmitting}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="font-sans text-[10px] uppercase tracking-widest text-gray-400 italic py-4">
                        Please specify sizes to allocate inventory.
                      </p>
                    )}
                  </div>

                  {/* Editorial Image Upload */}
                  <div className="md:col-span-12 mt-6">
                    <label className="block font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">
                      Lookbook Imagery
                    </label>
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center gap-4">
                        <label className="cursor-pointer bg-black text-white px-6 py-3 font-sans text-[9px] font-bold uppercase tracking-[0.2em] hover:bg-zinc-800 transition-colors">
                          <span>Upload Files</span>
                          <input
                            type="file"
                            multiple
                            onChange={(e) => handleImageSelect(index, e)}
                            className="hidden"
                            disabled={isSubmitting}
                          />
                        </label>
                        {isUploading && (
                          <span className="font-sans text-[10px] uppercase tracking-widest text-gray-500 animate-pulse">
                            Processing...
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-6">
                        {variant.images.map((imgUrl, imgIndex) => (
                          <div
                            key={imgIndex}
                            className="group relative w-24 h-32 md:w-32 md:h-40 bg-gray-100 overflow-hidden border border-gray-200"
                          >
                            <Image
                              src={imgUrl}
                              alt="Variant preview"
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 96px, 128px"
                            />

                            <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveImage(index, imgIndex)
                                }
                                className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-red-600 hover:text-red-900"
                                disabled={isSubmitting}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addVariant}
            className="mt-8 w-full border border-black bg-transparent py-4 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-black transition-colors duration-300 hover:bg-black hover:text-white"
            disabled={isSubmitting}
          >
            + Add New Variant
          </button>
        </div>
      </form>
    );
  },
);

ProductForm.displayName = "ProductForm";

export default ProductForm;
