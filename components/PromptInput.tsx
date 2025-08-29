import React, { useCallback, useRef, useEffect, useMemo } from 'react';
import {
    XCircleIcon,
    PlusIcon,
    MicrophoneIcon,
    SparklesIcon,
    LoadingSpinner,
} from '@/components/icons';
import { ImageState } from '@/types';

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
    inputRef?: React.RefObject<HTMLTextAreaElement>;
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
    disabled = false,
    inputRef
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = inputRef || useRef<HTMLTextAreaElement>(null);

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

    const urlMapRef = useRef<Record<string, string>>({});
    const imagePreviews = useMemo(() => {
        const map = urlMapRef.current;
        const previews = images.map(img => {
            let url = map[img.id];
            if (!url) {
                url = URL.createObjectURL(img.file);
                map[img.id] = url;
            }
            return { ...img, url };
        });
        const ids = new Set(images.map(i => i.id));
        Object.keys(map).forEach(id => {
            if (!ids.has(id)) {
                URL.revokeObjectURL(map[id]);
                delete map[id];
            }
        });
        return previews;
    }, [images]);

    useEffect(() => {
        return () => {
            Object.values(urlMapRef.current).forEach(url => URL.revokeObjectURL(url));
            urlMapRef.current = {};
        };
    }, []);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
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
        <div className="w-full bg-[var(--surface-2)] p-2 rounded-2xl shadow-2xl border border-[var(--line)] flex flex-col gap-2">
            {imagePreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 px-2 pt-1">
                    {imagePreviews.map(img => (
                        <div key={img.id} className="relative group flex-shrink-0">
                            <img
                                src={img.url}
                                alt="Image preview"
                                className="w-20 h-20 rounded-lg object-cover border border-[var(--line)]"
                            />
                            <button
                                onClick={() => handleRemoveImage(img.id)}
                                disabled={disabled || isLoading}
                                className="absolute top-1 right-1 p-0.5 bg-black/60 text-[var(--text)] rounded-full hover:bg-[var(--danger)] focus:outline-none focus:ring-2 focus:ring-[var(--danger)] disabled:opacity-50"
                                aria-label="Remove image"
                            >
                                <XCircleIcon className="w-5 h-5" aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-end gap-2 w-full">
                 <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={triggerFileInput}
                        disabled={disabled || isLoading || images.length >= MAX_IMAGES}
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-active)] rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={images.length >= MAX_IMAGES ? `Maximum ${MAX_IMAGES} images reached` : `Add image (${images.length}/${MAX_IMAGES})`}
                    >
                         <PlusIcon className="w-5 h-5" aria-hidden="true" />
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
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-active)] rounded-full transition-colors disabled:opacity-50"
                        title="Use microphone (coming soon)"
                    >
                         <MicrophoneIcon className="w-5 h-5" aria-hidden="true" />
                         <span className="sr-only">Use microphone</span>
                    </button>
                </div>

                <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything, or add up to 5 images..."
                    className="flex-1 min-w-0 bg-transparent text-[var(--text)] placeholder-[var(--text-muted)] text-base resize-none focus:outline-none p-2 min-h-[44px]"
                    rows={1}
                    disabled={disabled || isLoading}
                />
                
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={!canSubmit || isLoading}
                    className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg shadow-md transition-all duration-300 bg-[var(--accent)] text-[#0D1411] hover:brightness-110 disabled:bg-[var(--surface-1)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed"
                    title="Run Orchestration"
                >
                    {isLoading ? (
                        <>
                            <LoadingSpinner className="w-5 h-5 animate-spin" aria-hidden="true" />
                            Processing...
                        </>
                    ) : (
                        <>
                           <SparklesIcon className="w-5 h-5" aria-hidden="true" />
                           Run 
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default PromptInput;