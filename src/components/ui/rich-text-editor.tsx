'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
    Bold, Italic, Strikethrough, Code, Heading2, Heading3,
    List, ListOrdered, Quote, Minus, Link2, ImageIcon, Undo, Redo,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RichTextEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}

export function RichTextEditor({ value, onChange, placeholder = 'Bắt đầu viết nội dung...', className }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Image.configure({ inline: false, allowBase64: false }),
            Link.configure({ openOnClick: false, autolink: true }),
            Placeholder.configure({ placeholder }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none min-h-[300px] px-4 py-3 focus:outline-none',
            },
        },
    })

    // Sync external value changes (e.g. on edit load)
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value)
        }
    }, [editor, value])

    const addImage = useCallback(() => {
        const url = window.prompt('URL ảnh:')
        if (url && editor) {
            editor.chain().focus().setImage({ src: url }).run()
        }
    }, [editor])

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

    const ToolbarBtn = ({ onClick, active, title, children }: {
        onClick: () => void
        active?: boolean
        title: string
        children: React.ReactNode
    }) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={cn(
                'h-8 w-8 flex items-center justify-center rounded text-sm transition-colors',
                active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
        >
            {children}
        </button>
    )

    return (
        <div className={cn('border border-[#e2e8f0] rounded-xl overflow-hidden bg-white', className)}>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 border-b border-[#e2e8f0] px-2 py-1.5 bg-muted/30">
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
                <ToolbarBtn onClick={addImage} title="Chèn ảnh (URL)">
                    <ImageIcon className="h-3.5 w-3.5" />
                </ToolbarBtn>
            </div>

            {/* Editor area */}
            <EditorContent editor={editor} />
        </div>
    )
}
