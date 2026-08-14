# Authentication Guide

**Audience:** AI Agent developers, automation builders và Technical Owner.

Publishing API dùng Machine Identity và credential theo từng integration. Agent
không tự cấp quyền hoặc tự nâng capability. Technical Owner cấp, thu hồi và
rotation credential qua control plane đã được phê duyệt.

Chi tiết về Bearer credential, thời hạn, môi trường, capability và xử lý IP
policy nằm trong [Publishing API v1 Integration Guide](publishing-api-v1-integration-guide.vi.md),
mục “Thông tin kết nối”, “Capability theo operation” và “Control và bàn giao”.

Không ghi credential vào GitHub, log, email, chat hoặc tài liệu. Credential chỉ
được lưu trong password manager/secret manager được phê duyệt và không đưa vào
prompt của AI Agent.
