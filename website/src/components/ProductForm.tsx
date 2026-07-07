"use client";

import { Product } from "@/types/Product";
import React, { useState, useImperativeHandle, useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import ImageCropper from "./ImageCropper";
import { getRenderableImageUrl, getS3StorageImages } from "@/lib/imageUrls";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const resolveApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
      return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
    }
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || "";
};

const normalizeRenderableUrl = (url: string) => {
  if (url.startsWith("/api/media?")) {
    return `${resolveApiBaseUrl()}${url}`;
  }
  return getRenderableImageUrl(url);
};

type ImageDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

type VariantState = {
  color: string;
  sizes: string;
  price: string;
  stock: Record<string, string>;
  images: string[];
  imageDrafts: ImageDraft[];
};

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
    
    // --- New Status State for Alerts ---
    const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
      type: null,
      message: ""
    });

    const [formData, setFormData] = useState({
      name: "",
      description: "",
      brand: "",
      category: "",
      tags: "",
      basePrice: "",
    });
    const [variants, setVariants] = useState<VariantState[]>([
      { color: "", sizes: "", price: "", stock: {}, images: [], imageDrafts: [] },
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [croppingImage, setCroppingImage] = useState<{
      variantIndex: number;
      image: string;
    } | null>(null);

    const revokeDraftPreviews = (variantList: VariantState[]) => {
      variantList.forEach((variant) => {
        variant.imageDrafts.forEach((draft) => {
          URL.revokeObjectURL(draft.previewUrl);
        });
      });
    };

    const resetForm = () => {
      revokeDraftPreviews(variants);
      setFormData({
        name: "",
        description: "",
        brand: "",
        category: "",
        tags: "",
        basePrice: "",
      });
      setVariants([{ color: "", sizes: "", price: "", stock: {}, images: [], imageDrafts: [] }]);
      setFormStatus({ type: null, message: "" });
    };

    const handleProductChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (formStatus.type === 'error') setFormStatus({ type: null, message: "" }); // Clear errors on typing
    };

    const handleVariantChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      const newVariants = [...variants];
      newVariants[index][name] = value;

      if (name === "sizes") {
        const sizesArray = value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const newStock: Record<string, string> = {};
        sizesArray.forEach((size) => {
          newStock[size] = newVariants[index].stock[size] || "0";
        });
        newVariants[index].stock = newStock;
      }
      setVariants(newVariants);
      if (formStatus.type === 'error') setFormStatus({ type: null, message: "" });
    };

    const handleStockChange = (variantIndex: number, size: string, value: string) => {
      const newVariants = [...variants];
      newVariants[variantIndex].stock[size] = value;
      setVariants(newVariants);
    };

    const appendDraftToVariant = (variantIndex: number, file: File) => {
      const draft: ImageDraft = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      };

      setVariants((previousVariants) => {
        const nextVariants = previousVariants.map((variant) => ({
          ...variant,
          images: [...variant.images],
          imageDrafts: [...variant.imageDrafts],
        }));

        nextVariants[variantIndex].imageDrafts.push(draft);
        return nextVariants;
      });
    };

    const removeDraftFromVariant = (variantIndex: number, draftId: string) => {
      setVariants((previousVariants) => {
        const nextVariants = previousVariants.map((variant) => ({
          ...variant,
          images: [...variant.images],
          imageDrafts: [...variant.imageDrafts],
        }));

        const draft = nextVariants[variantIndex].imageDrafts.find(
          (item) => item.id === draftId,
        );
        if (draft) {
          URL.revokeObjectURL(draft.previewUrl);
        }

        nextVariants[variantIndex].imageDrafts = nextVariants[
          variantIndex
        ].imageDrafts.filter((item) => item.id !== draftId);
        return nextVariants;
      });
    };

    const uploadImage = async (imageFile: File) => {
      if (!token) {
        throw new Error("You need to sign in again before uploading images.");
      }

      const apiBaseUrl = resolveApiBaseUrl();
      const presignResponse = await fetch(`${apiBaseUrl}/api/upload/presign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: imageFile.name,
          contentType: imageFile.type,
          fileSize: imageFile.size,
        }),
      });

      const presignData = await presignResponse.json();
      if (!presignResponse.ok) {
        throw new Error(
          presignData.message || "Failed to prepare image upload",
        );
      }

      const uploadResponse = await fetch(presignData.url, {
        method: "PUT",
        headers: {
          "Content-Type": imageFile.type,
        },
        body: imageFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("S3 rejected the image upload");
      }

      return presignData.viewUrl || presignData.publicUrl || presignData.url.split("?")[0];
    };

    const handleImageSelect = async (variantIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          setFormStatus({
            type: "error",
            message: "Please choose image files only.",
          });
          continue;
        }

        if (file.size > MAX_UPLOAD_BYTES) {
          setFormStatus({
            type: "error",
            message: "Image is too large. Please choose a file up to 10 MB.",
          });
          continue;
        }

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
              appendDraftToVariant(variantIndex, file);
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      }

      e.target.value = "";
    };

    const handleCropComplete = async (croppedImageUrl: string) => {
      if (croppingImage) {
        const { variantIndex } = croppingImage;
        try {
          const response = await fetch(croppedImageUrl);
          const blob = await response.blob();
          const file = new File([blob], "cropped-image.jpg", {
            type: "image/jpeg",
          });
          appendDraftToVariant(variantIndex, file);
        } finally {
          setCroppingImage(null);
        }
      }
    };

    const uploadQueuedImages = async () => {
      const nextVariants = variants.map((variant) => ({
        ...variant,
        images: [...variant.images],
        imageDrafts: [...variant.imageDrafts],
      }));

      for (const variant of nextVariants) {
        for (const draft of variant.imageDrafts) {
          const uploadedUrl = await uploadImage(draft.file);
          variant.images.push(uploadedUrl);
          URL.revokeObjectURL(draft.previewUrl);
        }
        variant.imageDrafts = [];
      }

      return nextVariants;
    };

    const handleRemoveImage = (variantIndex: number, imageIndex: number) => {
      const newVariants = [...variants];
      newVariants[variantIndex].images.splice(imageIndex, 1);
      setVariants(newVariants);
    };

    const handleRemoveDraft = (variantIndex: number, draftId: string) => {
      removeDraftFromVariant(variantIndex, draftId);
    };

    const addVariant = () => {
      setVariants([
        ...variants,
        { color: "", sizes: "", price: "", stock: {}, images: [], imageDrafts: [] },
      ]);
    };

    const removeVariant = (index: number) => {
      const newVariants = variants.filter((_, i) => i !== index);
      variants[index]?.imageDrafts.forEach((draft) => URL.revokeObjectURL(draft.previewUrl));
      setVariants(newVariants);
    };

    const handleSubmit = async (e) => {
      if (e) e.preventDefault();
      setFormStatus({ type: null, message: "" });

      setIsSubmitting(true);

      try {
        setIsUploading(true);
        const uploadedVariants = await uploadQueuedImages();
        setVariants(uploadedVariants);

        const allVariantImages = uploadedVariants.flatMap((variant) => variant.images);

        const productData = {
          ...formData,
          basePrice: parseFloat(formData.basePrice),
          tags: formData.tags.split(",").map((t) => t.trim()),
          images: getS3StorageImages(allVariantImages),
          options: [],
          variants: [],
        };

        const allColors = uploadedVariants.map((variant) => variant.color).filter(Boolean);
        const allSizes = [
          ...new Set(
            uploadedVariants.flatMap((variant) =>
              variant.sizes
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            ),
          ),
        ];

        if (allColors.length > 0) {
          productData.options.push({ name: "Color", values: allColors });
        }
        if (allSizes.length > 0) {
          productData.options.push({ name: "Size", values: allSizes });
        }

        uploadedVariants.forEach((variant) => {
          const sizes = variant.sizes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          sizes.forEach((size) => {
            productData.variants.push({
              options: { Color: variant.color, Size: size },
              stock: parseInt(variant.stock[size] || "0", 10),
            price: parseFloat(variant.price || formData.basePrice),
              images: getS3StorageImages(variant.images),
            });
          });
        });

        const method = product?._id ? "PUT" : "POST";
        const apiBaseUrl = resolveApiBaseUrl();
        const url = product?._id
          ? `${apiBaseUrl}/api/products/${product._id}`
          : `${apiBaseUrl}/api/products`;

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
          // Replaced alert with elegant status message and brief delay before closing
          setFormStatus({ 
            type: 'success', 
            message: `Dossier '${formData.name}' successfully ${product?._id ? "updated" : "archived"}.` 
          });
          
          setTimeout(() => {
            resetForm();
            if (onSave) onSave();
          }, 1200); // 1.2s delay so the user can read the success message
          
        } else {
          throw new Error(
            result.message ||
              `Failed to ${product?._id ? "update" : "create"} archive entry`,
          );
        }
      } catch (error) {
        // Replaced alert with elegant error status message
        setFormStatus({ type: 'error', message: `Network Sync Error: ${error.message}` });
        setIsSubmitting(false); // Only set false on error, so it stays "submitting" during success delay
      } finally {
        setIsUploading(false);
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
              stock: v.options && v.options.Size ? { [v.options.Size]: v.stock } : {},
              images: getS3StorageImages(v.images || []),
              imageDrafts: [],
            })),
          );
        } else {
          setVariants([
            { color: "", sizes: "", price: "", stock: {}, images: [], imageDrafts: [] },
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
              void handleCropComplete(croppedImageUrl)
            }
            onCancel={() => setCroppingImage(null)}
          />
        )}

        {/* --- Dynamic Status Banner --- */}
        {formStatus.message && (
          <div className={`border-l-2 p-5 text-sm tracking-wide ${formStatus.type === 'error' ? 'border-red-600 bg-red-50/50' : 'border-black bg-gray-50/50'}`}>
            <p className={`font-editorial italic text-xl mb-1 ${formStatus.type === 'error' ? 'text-red-700' : 'text-black'}`}>
              {formStatus.type === 'error' ? 'System Notice' : 'Confirmation'}
            </p>
            <p className="text-gray-600 font-light text-xs mt-1">
              {formStatus.message}
            </p>
          </div>
        )}

        {/* --- Core Details --- */}
        <div>
          <div className="grid grid-cols-1 gap-y-6 gap-x-8 md:grid-cols-12">
            <div className="md:col-span-8">
              <Input
                label="Piece Name"
                name="name"
                value={formData.name}
                onChange={handleProductChange}
                placeholder="e.g. Oversized Linen Blazer"
                disabled={isSubmitting || formStatus.type === 'success'}
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
                disabled={isSubmitting || formStatus.type === 'success'}
              />
            </div>
            <div className="md:col-span-12">
              <TextArea
                label="Conceptual Details"
                name="description"
                value={formData.description}
                onChange={handleProductChange}
                placeholder="Enter material, cut, and conceptual details..."
                disabled={isSubmitting || formStatus.type === 'success'}
              />
            </div>
            <div className="md:col-span-4">
              <Input
                label="Brand / House"
                name="brand"
                value={formData.brand}
                onChange={handleProductChange}
                placeholder="Brand Name"
                disabled={isSubmitting || formStatus.type === 'success'}
              />
            </div>
            <div className="md:col-span-4">
              <Input
                label="Category"
                name="category"
                value={formData.category}
                onChange={handleProductChange}
                placeholder="e.g. Outerwear"
                disabled={isSubmitting || formStatus.type === 'success'}
              />
            </div>
            <div className="md:col-span-4">
              <Input
                label="Tags (Comma Separated)"
                name="tags"
                value={formData.tags}
                onChange={handleProductChange}
                placeholder="SS26, Linen, Tailored"
                disabled={isSubmitting || formStatus.type === 'success'}
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
                      disabled={isSubmitting || formStatus.type === 'success'}
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
                      disabled={isSubmitting || formStatus.type === 'success'}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Input
                      label="Sizes (Comma Separated)"
                      name="sizes"
                      value={variant.sizes}
                      onChange={(e) => handleVariantChange(index, e)}
                      placeholder="36, 38, 40"
                      disabled={isSubmitting || formStatus.type === 'success'}
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
                      disabled={isSubmitting || formStatus.type === 'success'}
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
                            disabled={isSubmitting || formStatus.type === 'success'}
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
                        <label className={`cursor-pointer px-6 py-3 font-sans text-[9px] font-bold uppercase tracking-[0.2em] transition-colors ${isSubmitting || formStatus.type === 'success' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-black text-white hover:bg-zinc-800'}`}>
                          <span>Upload Files</span>
                          <input
                            type="file"
                            multiple
                            onChange={(e) => handleImageSelect(index, e)}
                            className="hidden"
                            disabled={isSubmitting || formStatus.type === 'success'}
                          />
                        </label>
                        {isUploading ? (
                          <span className="font-sans text-[10px] uppercase tracking-widest text-gray-500 animate-pulse">
                            Uploading to S3...
                          </span>
                        ) : variant.imageDrafts.length > 0 ? (
                          <span className="font-sans text-[10px] uppercase tracking-widest text-gray-500">
                            Preview ready
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-6">
                        {variant.images.map((imgUrl, imgIndex) => (
                          <div
                            key={imgIndex}
                            className="group relative w-24 h-32 md:w-32 md:h-40 bg-gray-100 overflow-hidden border border-gray-200"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={normalizeRenderableUrl(imgUrl)}
                              alt="Variant preview"
                              className="absolute inset-0 h-full w-full object-cover"
                            />

                            {(!isSubmitting && formStatus.type !== 'success') && (
                              <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveImage(index, imgIndex)
                                  }
                                  className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-red-600 hover:text-red-900"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        {variant.imageDrafts.map((draft) => (
                          <div
                            key={draft.id}
                            className="group relative w-24 h-32 md:w-32 md:h-40 bg-gray-100 overflow-hidden border border-gray-200"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={draft.previewUrl}
                              alt="Pending upload preview"
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div className="absolute left-2 top-2 bg-black/75 px-2 py-1 text-[8px] uppercase tracking-[0.25em] text-white">
                              Local preview
                            </div>

                            {(!isSubmitting && formStatus.type !== 'success') && (
                              <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDraft(index, draft.id)}
                                  className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-red-600 hover:text-red-900"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
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
            className="mt-8 w-full border border-black bg-transparent py-4 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-black transition-colors duration-300 hover:bg-black hover:text-white disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent"
            disabled={isSubmitting || formStatus.type === 'success'}
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
