"use client";

import React, { useState, useRef, useImperativeHandle } from "react";
import ReactCrop, { Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
}

export interface ImageCropperRef {
  crop: () => void;
}

const ImageCropper = React.forwardRef<ImageCropperRef, ImageCropperProps>(
  ({ image, onCropComplete, onCancel }, ref) => {
    const [crop, setCrop] = useState<Crop>({
      unit: "px",
      width: 736,
      height: 981,
      x: 0,
      y: 0,
    });
    const imgRef = useRef<HTMLImageElement>(null);

    const getCroppedImg = (
      image: HTMLImageElement,
      crop: Crop,
    ): Promise<string> => {
      const canvas = document.createElement("canvas");
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(
          image,
          crop.x * scaleX,
          crop.y * scaleY,
          crop.width * scaleX,
          crop.height * scaleY,
          0,
          0,
          crop.width,
          crop.height,
        );
      }

      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"));
            return;
          }
          const fileUrl = window.URL.createObjectURL(blob);
          resolve(fileUrl);
        }, "image/jpeg");
      });
    };

    const handleCrop = async () => {
      if (imgRef.current && crop.width && crop.height) {
        const croppedImageUrl = await getCroppedImg(imgRef.current, crop);
        onCropComplete(croppedImageUrl);
      }
    };

    useImperativeHandle(ref, () => ({
      crop: handleCrop,
    }));

    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#050505]/95 backdrop-blur-md selection:bg-white selection:text-black p-6 md:p-12">
        
        {/* --- Header (Fixed) --- */}
        <div className="flex-none text-center mb-6">
          <h3 className="font-editorial text-2xl italic tracking-[0.1em] text-white mb-2">
            Adjust Frame
          </h3>
          <p className="font-sans text-[9px] uppercase tracking-[0.3em] text-white/50">
            Required Aspect Ratio: 3:4
          </p>
        </div>

        {/* --- Image Area (Flexible & Constrained) --- */}
        {/* min-h-0 is a crucial flexbox property that prevents the child from blowing past the parent's boundaries */}
        <div className="flex-1 min-h-0 flex items-center justify-center w-full max-w-4xl mx-auto overflow-hidden">
          <div className="p-2 border border-white/10 bg-black/50 shadow-2xl max-h-full max-w-full flex items-center justify-center overflow-auto">
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={image}
                alt="Crop preview"
                className="max-h-[60vh] md:max-h-[65vh] object-contain mx-auto block"
              />
            </ReactCrop>
          </div>
        </div>

        {/* --- Footer / Buttons (Fixed) --- */}
        <div className="flex-none mt-8 flex items-center justify-center gap-8">
          <button
            onClick={onCancel}
            className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 hover:text-white transition-colors"
          >
            Discard
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              handleCrop();
            }}
            className="bg-white text-black px-10 py-4 font-sans text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-gray-200 transition-colors"
          >
            Confirm Crop
          </button>
        </div>
        
      </div>
    );
  },
);

ImageCropper.displayName = "ImageCropper";

export default ImageCropper;