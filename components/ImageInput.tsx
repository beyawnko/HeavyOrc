
import React, { useCallback, useRef, useMemo, useEffect } from 'react';
import { UploadIcon, XCircleIcon } from '@/components/icons';
import { ImageState } from '@/types';

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

    const previewUrl = useMemo(() => (image ? URL.createObjectURL(image.file) : null), [image]);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    return (
        <div className="mt-4">
            <label className="block text-sm font-medium text-[var(--text)] mb-2">
                Image (Optional)
            </label>
            {image ? (
                <div className="relative group w-full sm:w-64">
                    {previewUrl && (
                        <img
                            src={previewUrl}
                            alt="Image preview"
                            className="w-full sm:w-64 h-auto rounded-lg object-cover border-2 border-[var(--line)]"
                        />
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                        <button
                            onClick={handleRemoveImage}
                            disabled={disabled}
                            className="p-2 bg-[var(--danger)] bg-opacity-80 text-[var(--text)] rounded-full hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--danger)] focus:ring-offset-2 focus:ring-offset-[var(--surface-1)] disabled:opacity-50"
                            aria-label="Remove image"
                        >
                            <XCircleIcon className="w-6 h-6" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={triggerFileInput}
                    disabled={disabled}
                    className="w-full h-24 p-3 flex flex-col items-center justify-center bg-[var(--surface-1)] border-2 border-dashed border-[var(--line)] rounded-lg hover:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <UploadIcon className="w-6 h-6 text-[var(--text-muted)] mb-1" aria-hidden="true" />
                    <span className="text-sm text-[var(--text-muted)]">Drag and drop an image, or click to upload</span>
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