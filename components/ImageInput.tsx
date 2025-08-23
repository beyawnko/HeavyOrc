
import React, { useCallback, useRef } from 'react';
import { UploadIcon, XCircleIcon } from './icons';
import { ImageState } from '../types';

interface ImageInputProps {
    image: ImageState | null;
    onImageChange: (image: ImageState | null) => void;
    disabled?: boolean;
}

const ImageInput: React.FC<ImageInputProps> = ({ image, onImageChange, disabled }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                // simple validation
                alert('Please select an image file.');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = (e.target?.result as string).split(',')[1];
                if (base64) {
                    onImageChange({
                        id: `${file.name}-${Date.now()}`,
                        file,
                        base64
                    });
                }
            };
            reader.readAsDataURL(file);
        }
    }, [onImageChange]);

    const handleRemoveImage = useCallback(() => {
        onImageChange(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset file input
        }
    }, [onImageChange]);

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
                Image (Optional)
            </label>
            {image ? (
                <div className="relative group w-full sm:w-64">
                    <img
                        src={URL.createObjectURL(image.file)}
                        alt="Image preview"
                        className="w-full sm:w-64 h-auto rounded-lg object-cover border-2 border-gray-600"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                        <button
                            onClick={handleRemoveImage}
                            disabled={disabled}
                            className="p-2 bg-red-600/80 text-white rounded-full hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50"
                            aria-label="Remove image"
                        >
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={triggerFileInput}
                    disabled={disabled}
                    className="w-full h-24 p-3 flex flex-col items-center justify-center bg-gray-900 border-2 border-dashed border-gray-600 rounded-lg hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <UploadIcon className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-sm text-gray-400">Drag and drop an image, or click to upload</span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        aria-hidden="true"
                    />
                </button>
            )}
        </div>
    );
};

export default ImageInput;