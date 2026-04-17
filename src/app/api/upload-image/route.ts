import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key on the server to bypass RLS policies
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const folder = (formData.get('folder') as string) || 'blog'

        if (!file) {
            return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 400 })
        }

        // Validate type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'Chỉ hỗ trợ JPG, PNG, WebP, GIF' },
                { status: 400 }
            )
        }

        // Validate size
        if (file.size > MAX_SIZE_BYTES) {
            return NextResponse.json(
                { error: 'File quá lớn (Max 5MB)' },
                { status: 400 }
            )
        }

        // Sanitize folder — only allow alphanumeric + hyphens
        const safeFolder = folder.replace(/[^a-z0-9-]/gi, '').substring(0, 50) || 'misc'

        // Generate unique file path
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${safeFolder}/${fileName}`

        // Convert File to ArrayBuffer for upload
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const { error: uploadError } = await supabaseAdmin.storage
            .from('images')
            .upload(filePath, buffer, {
                contentType: file.type,
                cacheControl: '31536000', // 1 year cache
                upsert: false,
            })

        if (uploadError) {
            console.error('[upload-image] Supabase error:', uploadError)
            return NextResponse.json(
                { error: 'Upload thất bại: ' + uploadError.message },
                { status: 500 }
            )
        }

        const { data } = supabaseAdmin.storage.from('images').getPublicUrl(filePath)

        return NextResponse.json({ url: data.publicUrl }, { status: 200 })
    } catch (err: any) {
        console.error('[upload-image] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Lỗi server: ' + err.message },
            { status: 500 }
        )
    }
}
