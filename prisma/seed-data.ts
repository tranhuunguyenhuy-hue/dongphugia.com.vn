
export const CATEGORY_DATA = {
    // 1. Thiết bị vệ sinh
    "thiet-bi-ve-sinh": {
        name: "Thiết bị vệ sinh",
        types: [
            {
                name: "Bồn cầu",
                groups: ["Bồn cầu 1 khối", "Bồn cầu 2 khối", "Bồn cầu thông minh", "Bồn cầu treo tường", "Vòi xịt", "Phụ kiện bồn cầu"]
            },
            {
                name: "Chậu rửa mặt (Lavabo)",
                groups: ["Vòi lavabo nóng lạnh", "Vòi lavabo lạnh", "Vòi lavabo âm tường", "Vòi lavabo cảm ứng", "Bộ xả lavabo"]
            },
            {
                name: "Vòi sen tắm",
                groups: ["Vòi sen nóng lạnh", "Vòi sen nhiệt độ", "Vòi sen lạnh", "Tay sen tắm", "Thanh trượt sen", "Vòi sen cây", "Vòi sen âm tường"]
            },
            {
                name: "Bồn tắm",
                groups: ["Bồn tắm thường", "Bồn tắm massage", "Bồn tắm góc", "Bồn tắm đặt sàn", "Vòi bồn tắm", "Phòng tắm đứng"]
            },
            {
                name: "Bồn tiểu",
                groups: ["Bồn tiểu cảm ứng", "Bồn tiểu treo tường", "Bồn tiểu đặt sàn", "Van xả tiểu"]
            },
            {
                name: "Phụ kiện phòng tắm",
                groups: ["Giá treo khăn", "Giá xà phòng", "Kệ kính", "Lô giấy", "Gương phòng tắm", "Máy sấy tay", "Phễu thoát sàn", "Vòi lạnh gắn tường"]
            },
            {
                name: "Nắp bồn cầu",
                groups: ["Nắp bồn cầu điện tử", "Nắp bồn cầu rửa cơ"]
            }
        ]
    },

    // 2. Thiết bị nhà bếp
    "thiet-bi-nha-bep": {
        name: "Thiết bị nhà bếp",
        types: [
            {
                name: "Bếp điện - Bếp từ",
                groups: ["Bếp điện từ kết hợp", "Bếp điện hồng ngoại", "Bếp từ"]
            },
            {
                name: "Bếp gas",
                groups: ["Bếp gas Teska", "Bếp gas Malloca"]
            },
            {
                name: "Máy hút mùi",
                groups: ["Máy hút mùi ống khói", "Máy hút mùi âm tủ", "Máy hút mùi đảo", "Máy hút mùi cổ điển"]
            },
            {
                name: "Máy rửa chén",
                groups: ["Máy rửa chén âm tủ", "Mini", "Độc lập"]
            },
            {
                name: "Vòi rửa chén",
                groups: ["Vòi bếp rút dây", "Vòi bếp lạnh", "Vòi bếp đá"]
            },
            {
                name: "Chậu rửa chén",
                groups: ["Chậu rửa chén Inox", "Chậu rửa chén đá"]
            },
            { name: "Lò vi sóng", groups: [] },
            { name: "Lò nướng đa năng", groups: [] },
            { name: "Phụ kiện bếp", groups: [] },
            { name: "Tủ lạnh", groups: [] }
        ]
    },

    // 3. Thiết bị ngành nước
    "thiet-bi-nghanh-nuoc": {
        name: "Thiết bị ngành nước",
        types: [
            {
                name: "Bồn nước",
                groups: ["Bồn nước Đại Thành", "Bồn nước Sơn Hà", "Bồn nước Inox", "Bồn nước Nhựa", "Bồn nước Công nghiệp"]
            },
            {
                name: "Máy nước nóng",
                groups: ["Trực tiếp", "Gián tiếp"]
            },
            {
                name: "Năng lượng mặt trời",
                groups: ["Máy nước nóng Đại Thành", "Thái dương năng Sơn Hà", "Ferroli", "Ariston"]
            },
            {
                name: "Bơm nhiệt",
                groups: ["Bơm nhiệt dân dụng", "Bơm nhiệt công nghiệp"]
            },
            { name: "Máy nước cây nóng lạnh", groups: [] }
        ]
    },

    // 4. Sàn gỗ / Sàn nhựa
    "san-go-san-nhua": {
        name: "Sàn gỗ - Sàn nhựa",
        types: [
            { name: "Sàn gỗ công nghiệp", groups: [] },
            { name: "Phụ kiện sàn gỗ", groups: [] }
        ]
    }
}
