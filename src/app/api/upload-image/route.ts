import { NextRequest, NextResponse } from 'next/server'

// Bunny CDN Storage configuration
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE_NAME!
const BUNNY_API_KEY = process.env.BUNNY_STORAGE_API_KEY!
const BUNNY_STORAGE_HOST = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com'
const BUNNY_CDN_HOST = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn'

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

        // Upload to Bunny CDN Storage via REST PUT
        const uploadUrl = `https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${filePath}`
        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'AccessKey': BUNNY_API_KEY,
                'Content-Type': 'application/octet-stream',
            },
            body: buffer,
        })

        if (!uploadRes.ok) {
            const errorText = await uploadRes.text()
            console.error('[upload-image] Bunny CDN error:', uploadRes.status, errorText)
            return NextResponse.json(
                { error: `Upload thất bại (${uploadRes.status}): ${errorText}` },
                { status: 500 }
            )
        }

        // Return the public CDN URL
        const publicUrl = `https://${BUNNY_CDN_HOST}/${filePath}`

        return NextResponse.json({ url: publicUrl }, { status: 200 })
    } catch (err: any) {
        console.error('[upload-image] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Lỗi server: ' + err.message },
            { status: 500 }
        )
    }
}

