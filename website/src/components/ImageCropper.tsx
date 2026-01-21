'use client';

import Image from 'next/image';
import React, { useState, useRef, useImperativeHandle } from 'react';
import ReactCrop, { Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
}

export interface ImageCropperRef {
  crop: () => void;
}

const ImageCropper = React.forwardRef<ImageCropperRef, ImageCropperProps>(({ image, onCropComplete, onCancel }, ref) => {
  const [crop, setCrop] = useState<Crop>({
    unit: 'px',
    width: 736,
    height: 981,
    x: 0,
    y: 0,
  });
  const imgRef = useRef<HTMLImageElement>(null);

  const getCroppedImg = (image: HTMLImageElement, crop: Crop): Promise<string> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

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
        crop.height
      );
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        const fileUrl = window.URL.createObjectURL(blob);
        resolve(fileUrl);
      }, 'image/jpeg');
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50">
      <div className="max-w-4xl w-full p-4">
        <ReactCrop crop={crop} onChange={(c) => setCrop(c)}>
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={imgRef} src={image} alt="Crop preview" />
        </ReactCrop>
      </div>
      <div className="mt-4 flex space-x-4">
        <button
          onClick={(e) => {
            e.preventDefault();
            handleCrop();
          }}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-purple-700 text-lg font-semibold"
        >
          Crop Image
        </button>
        <button
          onClick={onCancel}
          className="text-lg font-semibold text-gray-300 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
});

ImageCropper.displayName = 'ImageCropper';

export default ImageCropper;
