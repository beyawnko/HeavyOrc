import React, { useCallback, useRef, useEffect } from 'react';
import { 
    XCircleIcon,
    PlusIcon,
    SlidersHorizontalIcon,
    MicrophoneIcon,
    SparklesIcon,
    LoadingSpinner,
} from './icons';
import { ImageState } from '../types';

const MAX_IMAGES = 5;
const MAX_TEXTAREA_HEIGHT = 200; // Max height in pixels before scrolling

interface PromptInputProps {
    prompt: string;
    onPromptChange: (prompt: string) => void;
    images: ImageState[];
    onImagesChange: (images: ImageState[]) => void;
    onSubmit: () => void;
    isLoading?: boolean;
    disabled?: boolean;
}

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = (reader.result as string)?.split(',')[1];
            if (result) {
                resolve(result);
            } else {
                reject(new Error("Failed to read file as base64."));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

const PromptInput: React.FC<PromptInputProps> = ({
    prompt,
    onPromptChange,
    images,
    onImagesChange,
    onSubmit,
    isLoading = false,
    disabled = false
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        let currentImages = [...images];

        for (const file of Array.from(files)) {
            if (currentImages.length >= MAX_IMAGES) {
                alert(`You can only upload a maximum of ${MAX_IMAGES} images.`);
                break;
            }
            if (!file.type.startsWith('image/')) continue;

            try {
                const base64 = await readFileAsBase64(file);
                const newImage: ImageState = {
                    id: `${file.name}-${Date.now()}`,
                    file,
                    base64
                };
                currentImages.push(newImage);
            } catch (error) {
                console.error("Error reading file:", error);
                alert("There was an error processing one of the images.");
            }
        }
        
        onImagesChange(currentImages);
        
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

    }, [images, onImagesChange]);

    const handleRemoveImage = useCallback((idToRemove: string) => {
        onImagesChange(images.filter(img => img.id !== idToRemove));
    }, [images, onImagesChange]);

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!disabled && !isLoading && (prompt.trim() || images.length > 0)) {
                onSubmit();
            }
        }
    };
    
    useEffect(() => {
        if (textareaRef.current) {
            // Reset height to calculate the new scroll height
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;

            if (scrollHeight > MAX_TEXTAREA_HEIGHT) {
                // If content is too tall, set to max height and enable scrolling
                textareaRef.current.style.height = `${MAX_TEXTAREA_HEIGHT}px`;
                textareaRef.current.style.overflowY = 'auto';
            } else {
                // Otherwise, fit height to content and hide scrollbar
                textareaRef.current.style.height = `${scrollHeight}px`;
                textareaRef.current.style.overflowY = 'hidden';
            }
        }
    }, [prompt]);

    const canSubmit = !disabled && (!!prompt.trim() || images.length > 0);

    return (
        <div className="bg-gray-800/50 p-2 rounded-2xl shadow-2xl border border-gray-700 flex flex-col gap-2">
            {images.length > 0 && (
                <div className="flex flex-wrap gap-2 px-2 pt-1">
                    {images.map(img => (
                        <div key={img.id} className="relative group flex-shrink-0">
                            <img
                                src={URL.createObjectURL(img.file)}
                                alt="Image preview"
                                className="w-20 h-20 rounded-lg object-cover border border-gray-600"
                            />
                            <button
                                onClick={() => handleRemoveImage(img.id)}
                                disabled={disabled || isLoading}
                                className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-full hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50"
                                aria-label="Remove image"
                            >
                                <XCircleIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-end gap-2">
                 <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={triggerFileInput}
                        disabled={disabled || isLoading || images.length >= MAX_IMAGES}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={images.length >= MAX_IMAGES ? `Maximum ${MAX_IMAGES} images reached` : `Add image (${images.length}/${MAX_IMAGES})`}
                    >
                         <PlusIcon className="w-5 h-5" />
                         <span className="sr-only">Add Image</span>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                        aria-hidden="true"
                    />
                     <button
                        type="button"
                        disabled
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors disabled:opacity-50"
                        title="Use microphone (coming soon)"
                    >
                         <MicrophoneIcon className="w-5 h-5" />
                         <span className="sr-only">Use microphone</span>
                    </button>
                </div>

                <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything, or add up to 5 images..."
                    className="w-full flex-grow bg-transparent text-gray-200 placeholder-gray-500 text-base resize-none focus:outline-none p-2 min-h-[44px]"
                    rows={1}
                    disabled={disabled || isLoading}
                />
                
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={!canSubmit || isLoading}
                    className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg shadow-md transition-all duration-300 bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    title="Run Orchestration"
                >
                    {isLoading ? (
                        <>
                            <LoadingSpinner className="w-5 h-5 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                           <SparklesIcon className="w-5 h-5" />
                           Run 
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default PromptInput;