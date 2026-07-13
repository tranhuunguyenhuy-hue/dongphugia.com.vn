# Quality gates

`lint-with-baseline.mjs` chạy ESLint trên toàn repository nhưng chỉ làm CI fail
khi xuất hiện lỗi mới ngoài `.eslint-baseline.json`. Cách này giữ cho cleanup
không phải sửa lẫn hàng trăm lỗi legacy.

- `npm run lint`: kiểm tra không phát sinh lỗi mới.
- `npm run lint:all`: xem toàn bộ lỗi và warning hiện tại.
- `npm run lint:baseline:update`: cập nhật baseline có chủ đích sau khi review.

Không cập nhật baseline chỉ để làm CI xanh. Khi sửa được lỗi cũ, baseline có thể
giữ fingerprint thừa; gate sẽ báo số lỗi đã được giải quyết.
