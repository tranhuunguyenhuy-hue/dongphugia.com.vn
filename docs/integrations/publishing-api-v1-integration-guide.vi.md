# Publishing API v1 — Integration Guide

**Audience:** AI Agent developers, automation builders và Technical Owner.

Tài liệu này giải thích cách kết nối một **Publishing Agent** (ví dụ AI Agent)
với Publishing API v1 để chuẩn bị, lưu, lên lịch và xuất bản **Blog Post**. Người
dùng tự tạo và quản lý Agent; API không nghiên cứu hoặc sinh nội dung. Đông Phú
Gia cung cấp xác thực, kiểm tra, lưu trữ, lập lịch và khả năng xuất bản.

Hướng dẫn này là tài liệu Platform/Technical. Chiến lược nội dung, SEO, prompt,
nghiên cứu từ khóa và kế hoạch marketing thuộc đội Marketing/Content, không
thuộc phạm vi API.

> Phạm vi hiện tại là restricted pilot nội bộ. Đông Phú Gia cấp và thu hồi từng
> **Machine Identity**; chưa có self-service onboarding, multi-tenancy hoặc
> quyền truy cập trực tiếp cho khách hàng bên ngoài.

## 1. Thông tin kết nối

- OpenAPI: `https://www.dongphugia.vn/api/publishing/v1/openapi.json`
- Base URL production: `https://www.dongphugia.vn/api/publishing/v1`
- Xác thực: `Authorization: Bearer <publishing-credential>`.
- Mọi request phải dùng HTTPS.
- Agent pilot phải chạy từ fixed egress IP đã được allowlist cho Machine
  Identity. Không gửi token qua URL, log, GitHub, email hoặc chat.

Credential production được hiển thị đúng một lần khi cấp, hết hạn mặc định sau
90 ngày và phải được rotation. Secret mới được chuyển qua secret-sharing UI
được phê duyệt; không ghi secret vào tài liệu này. Sponsor của pilot là Nguyen
Huy. Khi cần dừng ngay, Integration Sponsor có thể disable Machine Identity,
revoke credential hoặc revoke capability.

Mọi ví dụ mutation trong hướng dẫn này chỉ dùng Production API/credential của
integration đã được phê duyệt và trong phạm vi nội dung được giao. Dedicated
isolated Staging là candidate write-frozen: không cấp Publishing credential,
không upload Managed Media, không tạo/publish/schedule nội dung và không chạy
synthetic Publishing acceptance trước gate riêng. Shared-data Staging là
topology lịch sử đã superseded và vẫn giữ các hạn chế này.

Trong một Production window đã được PM phê duyệt, operator thêm fixed egress IP
vào allowlist của Machine Identity qua control plane admin-only. Đây không phải
lệnh cho Agent hoặc khách hàng tự chạy:

```bash
npm run publishing:control -- ip-add \
  --actor-admin-id <active-admin-id> --confirm yes \
  --identity-id <machine-identity-uuid> --ip-address <fixed-egress-ip>
```

Proxy phải truyền IP qua header trusted đã cấu hình; Agent không được tự đặt
header này để vượt qua policy.

## 2. Capability theo operation

| Operation | Capability |
| --- | --- |
| `GET /taxonomy` | Không yêu cầu capability ngoài credential hợp lệ |
| `GET /posts` và `GET /posts/{external_id}` | `posts:write` |
| `POST /media` | `media:write` |
| Tạo/cập nhật Draft | `posts:write` |
| `publish_now` hoặc tạo/thay đổi Scheduled Publication | `posts:write` + `posts:publish` |

`posts:write` không tự cho phép xuất bản. Global Publishing Gate, write freeze,
Publication Readiness Gate, capability và Post Version vẫn được kiểm tra ở
ranh giới mutation và scheduler.

## 3. Quy trình nhanh

### 3.1. Đọc taxonomy đang hoạt động

```bash
BASE_URL="https://www.dongphugia.vn/api/publishing/v1"
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $PUBLISHING_TOKEN" \
  "$BASE_URL/taxonomy"
```

Chỉ dùng `slug` được trả về cho `category_slug` và `tag_slugs`. Không tự tạo
taxonomy; taxonomy mutation không thuộc v1.

### 3.2. Upload Managed Media

Mỗi file nguồn phải là JPEG, PNG hoặc WebP, tối đa 5 MiB và 40 megapixels.
`purpose` là `thumbnail`, `cover` hoặc `inline`. Dùng cùng một
`Idempotency-Key` khi retry đúng request.

```bash
curl --fail-with-body --silent --show-error \
  -X POST "$BASE_URL/media" \
  -H "Authorization: Bearer $PUBLISHING_TOKEN" \
  -H "Idempotency-Key: media-cover-2026-08-13-001" \
  -F "purpose=cover" \
  -F "file=@cover.png;type=image/png"
```

Lưu `id` của Managed Media và dùng id đó trong Blog Post. Không hotlink ảnh từ
URL bên ngoài. Một Blog Post được tham chiếu tối đa 20 Managed Media duy nhất;
lặp lại một asset không làm tăng số lượng.

### 3.3. Tạo Draft

`External Post ID` do Agent tạo trong namespace của Machine Identity và phải
khớp `[A-Za-z0-9][A-Za-z0-9._~-]{0,199}`. Tạo mới bắt buộc có
`If-None-Match: *` và `Idempotency-Key`.

```bash
curl --fail-with-body --silent --show-error \
  -X PUT "$BASE_URL/posts/agent-post-001" \
  -H "Authorization: Bearer $PUBLISHING_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: post-agent-post-001-draft-v1" \
  -H 'If-None-Match: *' \
  --data '{
    "title": "Hướng dẫn chọn thiết bị vệ sinh cho phòng tắm",
    "excerpt": "Các tiêu chí thực tế để chọn thiết bị bền, phù hợp và dễ bảo trì.",
    "content_html": "<p>Nội dung đã được Agent chuẩn bị và kiểm tra...</p>",
    "category_slug": "kien-thuc",
    "tag_slugs": ["phong-tam"],
    "thumbnail_media_id": "00000000-0000-0000-0000-000000000001",
    "cover_media_id": "00000000-0000-0000-0000-000000000002",
    "publication": { "mode": "draft" }
  }'
```

Response mutation có `ETag: "v<N>"`. Giữ ETag mới nhất; không tự tăng
`version`.

### 3.4. Cập nhật và xuất bản ngay

Đọc Blog Post trước để lấy ETag hiện tại. Update bắt buộc dùng `If-Match` và
không được gửi đồng thời `If-None-Match`.

```bash
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $PUBLISHING_TOKEN" \
  "$BASE_URL/posts/agent-post-001" \
  -D post-headers.txt

curl --fail-with-body --silent --show-error \
  -X PUT "$BASE_URL/posts/agent-post-001" \
  -H "Authorization: Bearer $PUBLISHING_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: post-agent-post-001-publish-v1" \
  -H 'If-Match: "v1"' \
  --data '{
    "title": "Hướng dẫn chọn thiết bị vệ sinh cho phòng tắm",
    "excerpt": "Các tiêu chí thực tế để chọn thiết bị bền, phù hợp và dễ bảo trì.",
    "content_html": "<p>Nội dung hiển thị có ít nhất 300 ký tự sau khi bỏ HTML...</p>",
    "category_slug": "kien-thuc",
    "tag_slugs": ["phong-tam"],
    "thumbnail_media_id": "00000000-0000-0000-0000-000000000001",
    "cover_media_id": "00000000-0000-0000-0000-000000000002",
    "publication": { "mode": "publish_now" }
  }'
```

Ví dụ `"v1"` chỉ minh họa. Luôn dùng ETag thực tế từ response trước đó.

### 3.5. Lên lịch xuất bản

`publish_at` phải là RFC 3339 có offset rõ ràng; offset phải khớp
`publication_timezone`. Thời điểm phải cách hiện tại ít nhất 5 phút và không
quá 365 ngày.

```json
{
  "title": "Hướng dẫn chọn thiết bị vệ sinh cho phòng tắm",
  "excerpt": "Các tiêu chí thực tế để chọn thiết bị bền, phù hợp và dễ bảo trì.",
  "content_html": "<p>Nội dung đủ điều kiện Publication Readiness...</p>",
  "category_slug": "kien-thuc",
  "tag_slugs": ["phong-tam"],
  "thumbnail_media_id": "00000000-0000-0000-0000-000000000001",
  "cover_media_id": "00000000-0000-0000-0000-000000000002",
  "publication": {
    "mode": "scheduled",
    "publish_at": "2026-08-20T09:00:00+07:00",
    "publication_timezone": "Asia/Ho_Chi_Minh"
  }
}
```

Scheduler chạy theo one-shot task mỗi phút. Nếu authority, Gate, Post Version,
taxonomy, media hoặc readiness không còn hợp lệ, lịch chuyển thành
`schedule_blocked`; không tự động public khi điều kiện quay lại. Muốn khôi phục,
Agent phải gửi mutation mới với ETag hiện tại.

### 3.6. Liệt kê và phân trang

```bash
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $PUBLISHING_TOKEN" \
  "$BASE_URL/posts?limit=20&status=published"
```

Response có `items` và `next_cursor`. Gửi nguyên cursor ở request kế tiếp; không
giải mã hoặc tự tạo cursor. Kết quả chỉ gồm Blog Post thuộc Machine Identity
đang gọi. `limit` từ 1 đến 100, mặc định 20.

## 4. Node.js tối thiểu

Đoạn code dưới đây dùng `fetch` có sẵn trong Node.js 18+. Token chỉ đọc từ
environment; không in token hoặc raw response chứa dữ liệu nhạy cảm vào log.

```js
const baseUrl = process.env.PUBLISHING_API_BASE_URL
  ?? 'https://www.dongphugia.vn/api/publishing/v1'
const token = process.env.PUBLISHING_TOKEN

if (!token) throw new Error('PUBLISHING_TOKEN is required')

async function publishingFetch(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(body?.message ?? `Publishing API ${response.status}`)
    error.code = body?.code
    error.requestId = response.headers.get('x-request-id')
    error.retryAfter = response.headers.get('retry-after')
    throw error
  }
  return { body, etag: response.headers.get('etag') }
}

const taxonomy = await publishingFetch('/taxonomy')
const category = taxonomy.body.categories.find(({ slug }) => slug === 'kien-thuc')
if (!category) throw new Error('Approved category was not found')

const externalId = 'agent-post-001'
const created = await publishingFetch(`/posts/${externalId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': `${externalId}-draft-v1`,
    'If-None-Match': '*',
  },
  body: JSON.stringify({
    title: 'Hướng dẫn chọn thiết bị vệ sinh cho phòng tắm',
    excerpt: 'Các tiêu chí thực tế để chọn thiết bị bền, phù hợp và dễ bảo trì.',
    content_html: '<p>Nội dung đã được Agent chuẩn bị...</p>',
    category_slug: category.slug,
    tag_slugs: [],
    publication: { mode: 'draft' },
  }),
})

// For a later update, use the ETag from GET or the mutation response.
console.log({ status: created.body.status, version: created.body.version })
```

## 5. Publication Readiness

Draft có thể chưa đủ điều kiện public. `publish_now` và `scheduled` phải đạt
đồng thời:

- `title`: 10–120 ký tự;
- `excerpt`: 50–300 ký tự;
- visible text của `content_html`: ít nhất 300 ký tự;
- Blog Category đang active;
- Blog Tags được chọn đang active;
- có thumbnail và cover là Managed Media hợp lệ;
- mọi Managed Media reference thuộc Machine Identity và hợp lệ;
- restricted HTML và HTTPS citation host vượt qua allowlist chính xác.

Không có AI quality score hoặc human approval cho từng bài trong zero-touch
pilot. Các điều kiện trên là Publication Readiness Gate bắt buộc.

## 6. Retry, concurrency và lỗi

- Retry cùng `Idempotency-Key` và cùng payload trong 30 ngày: nhận safe response
  đã lưu.
- Cùng key nhưng payload khác hoặc operation còn chạy: `409`.
- Tạo mới không có `If-None-Match: *`: `428`.
- Update thiếu/sai ETag: `428` hoặc `422`.
- ETag cũ hoặc External Post ID đã tồn tại: `412`.
- Validation, readiness, taxonomy hoặc media không hợp lệ: `422`.
- Credential hết hạn/revoke: `401`; capability, IP hoặc HTTPS bị từ chối: `403`.
- Rate limit: `429`; đọc `Retry-After` trước khi retry.
- Gate, write freeze, configuration hoặc storage tạm thời unavailable: `503`
  (media storage có thể trả `502`); chỉ retry theo `Retry-After`.

Mọi response có `x-request-id`. Khi cần hỗ trợ, gửi request ID, method, route,
status và thời điểm; không gửi Bearer token, request body chứa secret hoặc raw
credential.

## 7. Control và bàn giao

Machine Identity, Integration Sponsor, capabilities, fixed-IP allowlist,
credential issue/rotation/revoke và Global Publishing Gate đều do control plane
admin-only của Đông Phú Gia quản lý. Agent không được tự cấp quyền, thay đổi
taxonomy, tắt Gate hoặc gọi scheduler nội bộ.

Runbook vận hành: [`publishing-api-v1-runbook.md`](../deploy/publishing-api-v1-runbook.md).
OpenAPI runtime: `/api/publishing/v1/openapi.json`.

Handoff hiện tại dùng Production API/credential theo contract đã được PM phê
duyệt. Dedicated isolated Staging chỉ cung cấp candidate evidence theo
[`isolated-staging-foundation.md`](../deploy/isolated-staging-foundation.md) và
phải giữ write-freeze; shared-data Staging là topology lịch sử đã superseded.
Các Publishing mutation không được chuyển sang Staging để acceptance. Mỗi
integration, capability và Production operation vẫn phải nằm trong approval
hiện hành. Tài liệu này không cấp quyền Production và không chứa Production
credential.
