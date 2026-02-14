"use client"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import { Upload, X, Loader2, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ImageUploaderProps {
    value: string | string[]
    onChange: (value: string | string[]) => void
    multiple?: boolean
    maxFiles?: number
    label?: string
    className?: string
}

export function ImageUploader({
    value,
    onChange,
    multiple = false,
    maxFiles = 10,
    label = "Upload ảnh",
    className,
}: ImageUploaderProps) {
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Normalize value to array for internal handling
    const images: string[] = Array.isArray(value)
        ? value
        : value
            ? [value]
            : []

    const uploadFile = useCallback(async (file: File): Promise<string | null> => {
        const formData = new FormData()
        formData.append("file", file)

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Upload failed")
            }

            const data = await res.json()
            return data.url
        } catch (err: any) {
            toast.error(err.message || "Upload failed")
            return null
        }
    }, [])

    const handleFiles = useCallback(
        async (files: FileList | File[]) => {
            const fileArray = Array.from(files)

            // Check max files limit
            if (multiple && images.length + fileArray.length > maxFiles) {
                toast.error(`Tối đa ${maxFiles} ảnh`)
                return
            }

            setUploading(true)

            const uploadPromises = fileArray.map((file) => uploadFile(file))
            const urls = await Promise.all(uploadPromises)
            const successUrls = urls.filter((url): url is string => url !== null)

            if (successUrls.length > 0) {
                if (multiple) {
                    onChange([...images, ...successUrls])
                } else {
                    onChange(successUrls[0])
                }
                toast.success(
                    `Đã upload ${successUrls.length} ảnh`
                )
            }

            setUploading(false)
        },
        [images, maxFiles, multiple, onChange, uploadFile]
    )

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files)
            }
        },
        [handleFiles]
    )

    const removeImage = useCallback(
        (index: number) => {
            if (multiple) {
                const newImages = images.filter((_, i) => i !== index)
                onChange(newImages)
            } else {
                onChange("")
            }
        },
        [images, multiple, onChange]
    )

    return (
        <div className={cn("space-y-3", className)}>
            {label && (
                <p className="text-sm font-medium leading-none">{label}</p>
            )}

            {/* Preview existing images */}
            {images.length > 0 && (
                <div className="flex flex-wrap gap-3">
                    {images.map((url, index) => (
                        <div
                            key={`${url}-${index}`}
                            className="relative group rounded-lg overflow-hidden border bg-muted"
                            style={{ width: 120, height: 120 }}
                        >
                            <Image
                                src={url}
                                alt={`Uploaded ${index + 1}`}
                                fill
                                className="object-cover"
                                sizes="120px"
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload dropzone */}
            {(multiple || images.length === 0) && (
                <div
                    onDragOver={(e) => {
                        e.preventDefault()
                        setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={cn(
                        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                        dragOver
                            ? "border-primary bg-primary/5"
                            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                        uploading && "pointer-events-none opacity-60"
                    )}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple={multiple}
                        onChange={(e) => {
                            if (e.target.files) handleFiles(e.target.files)
                            e.target.value = "" // reset for re-upload same file
                        }}
                        className="hidden"
                    />

                    {uploading ? (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="text-sm">Đang upload...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <div className="rounded-full bg-muted p-3">
                                <ImageIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">
                                    Kéo thả hoặc nhấn để chọn ảnh
                                </p>
                                <p className="text-xs mt-1">
                                    JPG, PNG, WebP, GIF — Tối đa 5MB
                                    {multiple && ` · ${maxFiles} ảnh`}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
