'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
    Bold, Italic, Strikethrough, Code, Heading2, Heading3,
    List, ListOrdered, Quote, Minus, Link2, ImageIcon, Undo, Redo, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface RichTextEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    folder?: string // Supabase storage folder for inline images
}

export function RichTextEditor({
    value,
    onChange,
    placeholder = 'Bắt đầu viết nội dung...',
    className,
    folder = 'blog',
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Image.configure({ inline: false, allowBase64: false }),
            Link.configure({ openOnClick: false, autolink: true }),
            Placeholder.configure({ placeholder }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            // Only mark as internal if user is typing/uploading, not if useEffect is resetting
            if (!isSettingContent.current) {
                isInternalUpdate.current = true
            }
            onChange(editor.getHTML())
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none min-h-[300px] px-4 py-3 focus:outline-none',
            },
        },
        immediatelyRender: false,
    })

    const imageInputRef = useRef<HTMLInputElement>(null)
    const [imageUploading, setImageUploading] = useState(false)
    // Track whether the last HTML change originated from the editor itself (user typing/uploading)
    // vs. from an external prop change (e.g. initial load on edit page).
    // This prevents the useEffect below from overwriting the editor content
    // immediately after the user inserts an image — which would wipe the image.
    const isInternalUpdate = useRef(false)
    // Prevents the onUpdate handler from marking a setContent() call from useEffect as internal
    const isSettingContent = useRef(false)

    // Sync external value changes ONLY (e.g. on edit page initial load)
    useEffect(() => {
        if (!editor) return
        if (isInternalUpdate.current) {
            // Change came from the editor itself — don't reset
            isInternalUpdate.current = false
            return
        }
        // Only overwrite if content is meaningfully different
        // (avoids reset loop when value === editor.getHTML())
        const editorHtml = editor.getHTML()
        if (value !== editorHtml) {
            isSettingContent.current = true
            editor.commands.setContent(value)
            isSettingContent.current = false
        }
    }, [editor, value])

    // Upload image file via server API route, then insert public URL into editor
    const handleImageUpload = useCallback(async (file: File) => {
        if (!editor) return

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Ảnh quá lớn (Max 5MB)')
            return
        }

        setImageUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('folder', folder)

            const res = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData,
            })

            const json = await res.json()
            if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)

            editor.chain().focus().setImage({ src: json.url }).run()
            toast.success('Đã chèn ảnh vào nội dung')
        } catch (err: any) {
            console.error('Image upload error:', err)
            toast.error('Lỗi upload ảnh: ' + err.message)
        } finally {
            setImageUploading(false)
        }
    }, [editor, folder])

    const openImagePicker = useCallback(() => {
        imageInputRef.current?.click()
    }, [])

    const setLink = useCallback(() => {
        const prev = editor?.getAttributes('link').href || ''
        const url = window.prompt('URL liên kết:', prev)
        if (url === null) return
        if (url === '') {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }
        editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }, [editor])

    if (!editor) return null

    const ToolbarBtn = ({ onClick, active, title, disabled, children }: {
        onClick: () => void
        active?: boolean
        title: string
        disabled?: boolean
        children: React.ReactNode
    }) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            disabled={disabled}
            className={cn(
                'h-8 w-8 flex items-center justify-center rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
        >
            {children}
        </button>
    )

    return (
        <div className={cn('border border-[#E4EEF2] rounded-xl overflow-hidden bg-white', className)}>
            {/* Hidden file input for image upload */}
            <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImageUpload(file)
                    e.target.value = '' // reset for re-upload same file
                }}
            />

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 border-b border-[#E4EEF2] px-2 py-1.5 bg-muted/30">
                <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Hoàn tác">
                    <Undo className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Làm lại">
                    <Redo className="h-3.5 w-3.5" />
                </ToolbarBtn>

                <div className="w-px h-5 bg-border mx-1" />

                <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="In đậm">
                    <Bold className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="In nghiêng">
                    <Italic className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Gạch ngang">
                    <Strikethrough className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Code inline">
                    <Code className="h-3.5 w-3.5" />
                </ToolbarBtn>

                <div className="w-px h-5 bg-border mx-1" />

                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Tiêu đề H2">
                    <Heading2 className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Tiêu đề H3">
                    <Heading3 className="h-3.5 w-3.5" />
                </ToolbarBtn>

                <div className="w-px h-5 bg-border mx-1" />

                <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Danh sách">
                    <List className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Danh sách có số">
                    <ListOrdered className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Trích dẫn">
                    <Quote className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Đường kẻ ngang">
                    <Minus className="h-3.5 w-3.5" />
                </ToolbarBtn>

                <div className="w-px h-5 bg-border mx-1" />

                <ToolbarBtn onClick={setLink} active={editor.isActive('link')} title="Chèn liên kết">
                    <Link2 className="h-3.5 w-3.5" />
                </ToolbarBtn>

                {/* Image upload button — uploads to Supabase then inserts URL */}
                <ToolbarBtn
                    onClick={openImagePicker}
                    title="Chèn ảnh (upload lên Supabase)"
                    disabled={imageUploading}
                >
                    {imageUploading
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <ImageIcon className="h-3.5 w-3.5" />
                    }
                </ToolbarBtn>
            </div>

            {/* Editor area */}
            <EditorContent editor={editor} />
        </div>
    )
}
