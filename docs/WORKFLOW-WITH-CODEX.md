# Quy trình làm việc giữa PM và Codex

## Mục tiêu

Mọi phiên Codex dùng cùng một repository, cùng một working copy và cùng quy
trình Git. Production AWS không thay đổi chỉ vì source được merge.

## Một nguồn duy nhất

- Working copy: `/Users/m-ac/Projects/dongphugia`
- GitHub: `tranhuunguyenhuy-hue/dongphugia.com.vn`
- Branch chuẩn: protected `main`
- Production: `https://www.dongphugia.vn`

Không giao việc trong các folder quarantine, checkout cũ hoặc repository đã
archive. Nếu `pwd` khác folder chuẩn, Codex phải dừng trước mutation.

## Vai trò

| Vai trò | Trách nhiệm |
|---|---|
| PM | Đưa mục tiêu, phạm vi, ưu tiên, acceptance criteria và quyền production |
| Codex | Kiểm tra context, lập kế hoạch, implement, test, PR, báo cáo và cleanup branch |
| GitHub | Lưu source chuẩn, chạy CI và bảo vệ `main` |
| AWS/Coolify | Runtime production; chỉ thay đổi trong PM window đã duyệt |

## Mẫu giao việc thông thường

PM có thể gửi ngắn gọn:

```text
TASK: <mục tiêu>
SCOPE: <phần được phép thay đổi>
OUT OF SCOPE: <phần không được đụng tới>
ACCEPTANCE: <điều kiện hoàn thành>
PRODUCTION MUTATION: Not approved
```

Nếu thiếu chi tiết nhưng không làm thay đổi đáng kể phạm vi, Codex tự đưa ra
giả định an toàn và tiếp tục. Chỉ hỏi PM khi lựa chọn có thể làm thay đổi sản
phẩm, dữ liệu, chi phí hoặc production.

## Vòng đời một nhiệm vụ

### 1. Preflight

Codex phải:

1. Xác nhận đúng folder chuẩn.
2. Đọc `AGENTS.md` và tài liệu liên quan.
3. Kiểm tra `git status`, `main`, open PR và CI gần nhất.
4. Bảo toàn mọi thay đổi không thuộc nhiệm vụ.
5. Xác nhận không có mutation owner cạnh tranh.

### 2. Branch

```bash
git switch main
git pull --ff-only origin main
git switch -c codex/<task-name>
```

Chỉ một branch active cho một nhiệm vụ. Không dùng branch lịch sử làm nền.

### 3. Implement

- Thay đổi nhỏ nhất đáp ứng acceptance criteria.
- Không tự mở rộng sang production, DNS, database hay hạ tầng.
- Cập nhật tests và tài liệu khi behavior hoặc quy trình thay đổi.
- Gửi commentary ngắn sau mỗi phase có ý nghĩa.

### 4. Validate

Baseline:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tùy phạm vi, bổ sung browser smoke, monitoring verifier, ARM64 image,
PostgreSQL verify-full, security scan hoặc performance gate.

### 5. Pull request

- Commit chỉ các file thuộc nhiệm vụ.
- Push branch `codex/*`.
- Mở PR với scope, risk, tests, rollout và rollback.
- Chờ required CI PASS.
- Không bypass protected `main` và không force-push.

### 6. Closeout

Sau merge:

1. Xóa remote task branch.
2. Chuyển local checkout về `main` và fast-forward.
3. Xác nhận `git status` sạch.
4. Báo commit/PR, checks, ảnh hưởng production và việc còn lại.

## Nhiệm vụ production

Production mutation cần thêm block phê duyệt:

```text
PM WINDOW: YYYY-MM-DD HH:MM - YYYY-MM-DD HH:MM Asia/Ho_Chi_Minh
AWS AUTH/QUOTA: READY
APPLICATION ROLLOUT: Approved / Not approved
DATABASE MUTATION: Approved / Not approved
DNS MUTATION: Approved / Not approved
READ-ONLY LOAD/SOAK: Approved / Not approved
ROLLBACK: Required
```

Codex phải thực hiện backup/checksum/private copy, preflight, dark acceptance,
rollback proof và post-switch acceptance tương ứng với phạm vi đã duyệt. Khi
window hết hoặc mandatory gate fail, dừng mutation và đưa hệ thống về trạng
thái an toàn.

## Quy tắc nhiều phiên Codex

- Chỉ một phiên được giữ mutation ownership.
- Phiên khác chỉ được read-only hoặc chờ.
- Không có hai phiên cùng sửa một branch hoặc một working copy.
- Không tạo thêm folder `dongphugia-*` cho công việc thông thường.
- Công việc song song thật sự cần PM duyệt worktree tạm, owner và cleanup time.

## Definition of done

Một nhiệm vụ chỉ hoàn thành khi:

- Acceptance criteria PASS.
- Tests phù hợp PASS.
- PR merge vào protected `main`.
- Remote task branch đã xóa.
- Local working copy trở về clean `main`.
- Production được ghi rõ là unchanged hoặc acceptance PASS.
- Blocker/deferred work được ghi rõ, không bị trình bày như đã hoàn thành.

## Trạng thái hiện hành

- `.vn` là production AWS duy nhất.
- AWS PostgreSQL là production database duy nhất.
- Vercel Git Integration đã ngắt; `.com.vn` không phục vụ website.
- LCP `<=2500 ms` là backlog tối ưu, không chặn phát triển tính năng.
- Material cũ đang ở hidden quarantine đến 2026-08-18.
