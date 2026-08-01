# Codex hand-off standard

## Mục tiêu

Mỗi hand-off phải đủ để Codex session/thread tiếp theo tiếp tục đúng checkpoint mà không phải đoán,
không lặp mutation và không vô tình có hai writer trên cùng resource.

## Quy tắc bắt buộc

1. Mỗi resource chỉ có một mutation owner tại một thời điểm.
2. Hand-off phải phân biệt rõ `FACT`, `PM DECISION`, `ASSUMPTION` và `UNKNOWN`.
3. Mọi source hoặc deployment identity phải ghi exact commit và digest đầy đủ.
4. Không ghi secret, credential, token, DSN có password hoặc dữ liệu cá nhân.
5. Không coi branch name, tag mutable hoặc tên deployment là bằng chứng đủ.
6. Không lặp probe hoặc workflow nếu input/evidence chưa thay đổi.
7. Thread cũ phải đóng hoặc bàn giao rõ mọi tunnel, terminal session và process.
8. Thread mới phải xác minh worktree, owner và exact head trước mutation đầu tiên.
9. Mỗi thread phải dùng mẫu `CODEX-SESSION-CLOSEOUT.md` trước khi nhường owner.

## Nội dung tối thiểu

### 1. Scope và authority

- Mục tiêu đang thực hiện.
- Việc được phép và việc bị cấm.
- Stop gate tiếp theo.
- Mutation owner hiện tại và thời điểm owner được chuyển giao.

### 2. Local Git identity

- Absolute `pwd` và worktree.
- Branch, HEAD commit và tree hash.
- Upstream và ahead/behind.
- Toàn bộ modified, staged và untracked files.
- Worktree khác có liên quan và owner của chúng.

### 3. GitHub source of truth

- Repository và PR.
- Exact PR head, base và trạng thái checks.
- Workflow đang pending/running/failed và run ID.
- Commit/tree nào được chấp nhận làm release baseline.

### 4. Artifact identity

- Source revision.
- Immutable image digest và platform.
- SBOM, provenance và security scan evidence.
- Registry/repository metadata không chứa credential.

### 5. Runtime state

- Staging, dark production và current production identities.
- URL hoặc internal validation path.
- Runtime digest, health, restart count và acceptance result.
- Rollback target và bằng chứng target vẫn dùng được.

### 6. Data safety

- Source/target database identity ở mức không nhạy cảm.
- Backup, checksum, off-host copy và restore evidence.
- Reconciliation, sequence, write-freeze và split-brain status.
- Mọi production write phải có approval và owner riêng.

### 7. DNS, TLS và traffic

- Current authoritative zone evidence.
- Proposed records, TTL và TLS status.
- DNS operator, rollback records và observation window.
- Ghi rõ traffic/DNS đã thay đổi hay vẫn ở hard stop.

### 8. Mutation ledger

Mỗi mutation ghi: thời gian, resource, action, owner, input identity, result,
reversibility và rollback action. Không ghi giá trị secret.

### 9. Blockers và next action

- Technical blockers.
- Human-only blockers và người cần xử lý.
- Workstream độc lập còn chạy được.
- Một next action duy nhất, kèm điều kiện bắt đầu và điều kiện hoàn tất.

## Takeover protocol

Codex thread nhận bàn giao phải thực hiện theo thứ tự:

1. Đọc hand-off và stop gate.
2. Chạy audit read-only bằng `scripts/repository/audit-git-state.sh`.
3. Xác minh owner cũ đã dừng hoặc đã nhường resource.
4. Xác minh exact PR head/artifact/runtime nếu chúng có thể đã thay đổi.
5. Công bố mutation owner mới trước mutation đầu tiên.
6. Đọc và cập nhật `CODEX-CONTEXT.md` khi scope cho phép.

Nếu một trong sáu bước không xác minh được, Codex chỉ được làm read-only và
phải báo `UNKNOWN` thay vì suy đoán.
