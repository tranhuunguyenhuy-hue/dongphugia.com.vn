#!/bin/bash

# Hiển thị màu
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Bắt đầu sửa lỗi quyền ~/.npm cache và cài đặt công cụ Testing...${NC}"

# Yêu cầu sudo thủ công để sửa lỗi root-owned files của NPM
echo "⚠️ Lệnh chown yêu cầu quyền quản trị (Sudo). Nhập mật khẩu Macbook của bạn nếu được hỏi:"
sudo chown -R 501:20 "/Users/m-ac/.npm"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Sửa lỗi ~/.npm thành công!${NC}"
    echo "📦 Bắt đầu cài đặt Vitest và Testing Library..."
    
    # Cài đặt Testing Dependency
    npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Hoàn tất cài đặt môi trường Testing (Vitest + Testing-library)!${NC}"
        echo "💡 Bạn có thể tiếp tục bằng lệnh: npx vitest run"
    else
        echo -e "${RED}❌ Có lỗi xảy ra khi cài đặt NPM package. Vui lòng kiểm tra lại.${NC}"
    fi
else
    echo -e "${RED}❌ Không thể sửa quyền ~/.npm. Hãy chắc chắn bạn nhập đúng mật khẩu Sudo.${NC}"
fi
