const fs = require('fs');
const file = 'src/app/admin/(dashboard)/products/product-gallery.tsx';
let content = fs.readFileSync(file, 'utf8');

const newRender = `    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-[#3C4E56]">Gallery ảnh ({images.length})</p>
                    <p className="text-xs text-muted-foreground">Kéo thả hoặc nhấn để upload ảnh. Đặt một ảnh làm thumbnail (hiển thị 120x120px).</p>
                </div>
            </div>

            {/* Image Grid using Flex layout for variable sizes */}
            {images.length > 0 && (
                <div className="flex flex-wrap items-end gap-4">
                    {images.map(img => {
                        const isThumbnail = img.image_url === currentThumbnail
                        let sizeClass = "w-[100px] h-[100px]"
                        if (images.length >= 2) {
                            if (currentThumbnail) {
                                sizeClass = isThumbnail ? "w-[120px] h-[120px]" : "w-[80px] h-[80px]"
                            } else {
                                sizeClass = "w-[100px] h-[100px]"
                            }
                        } else if (images.length === 1) {
                            sizeClass = "w-[120px] h-[120px]"
                        }

                        return (
                            <div
                                key={img.id}
                                className={cn(
                                    "relative group rounded-lg overflow-hidden border bg-neutral-100 transition-all duration-300 ease-in-out shrink-0",
                                    isThumbnail ? "border-amber-400 shadow-sm" : "border-[#E4EEF2] hover:border-[#2E7A96]",
                                    sizeClass
                                )}
                            >
                                <Image
                                    src={img.image_url}
                                    alt={img.alt_text || 'Product image'}
                                    fill
                                    className="object-cover"
                                    sizes="120px"
                                    unoptimized
                                />
                                {/* Thumbnail badge */}
                                {isThumbnail && (
                                    <div className="absolute top-1 left-1 bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                        THUMBNAIL
                                    </div>
                                )}
                                {/* Action overlay */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                    {/* Set as thumbnail */}
                                    {!isThumbnail && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 px-2 text-[10px] bg-white/90 hover:bg-amber-50 text-amber-600"
                                            disabled={settingThumbnail === img.id}
                                            onClick={() => handleSetThumbnail(img.id, img.image_url)}
                                        >
                                            {settingThumbnail === img.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                            ) : (
                                                <Star className="h-3 w-3 mr-1" />
                                            )}
                                            Thumbnail
                                        </Button>
                                    )}
                                    {/* Delete */}
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="destructive"
                                        className="h-6 w-6 rounded-full"
                                        title="Xóa ảnh"
                                        disabled={deletingId === img.id}
                                        onClick={() => handleDelete(img.id)}
                                    >
                                        {deletingId === img.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3 w-3" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Upload dropzone */}
            <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files) }}
                onClick={() => inputRef.current?.click()}
                className={cn(
                    "border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors mt-4",
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
                    multiple
                    onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
                    className="hidden"
                />
                {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-7 w-7 animate-spin" />
                        <p className="text-sm">Đang upload...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="rounded-full bg-muted p-2.5">
                            <Upload className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-medium">Kéo thả hoặc nhấn để thêm ảnh gallery</p>
                        <p className="text-xs">JPG, PNG, WebP, GIF — Tối đa 5MB/ảnh · 20 ảnh/lần</p>
                    </div>
                )}
            </div>
        </div>
    )`;

content = content.replace(/return \([\s\S]*?\)\n}/, newRender + '\n}');
fs.writeFileSync(file, content, 'utf8');
console.log('ProductGallery updated.');
