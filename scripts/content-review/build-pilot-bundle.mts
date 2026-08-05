import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { cleanupProductHtml, extractEmbeddedImageUrls } = require('../../src/lib/content-review/cleanup.ts') as typeof import('../../src/lib/content-review/cleanup')
const { createReviewImage, dedupeReviewImages } = require('../../src/lib/content-review/images.ts') as typeof import('../../src/lib/content-review/images')
const { hashObject, sha256 } = require('../../src/lib/content-review/hash.ts') as typeof import('../../src/lib/content-review/hash')
const {
    LEO_489_PILOT_MANIFEST,
    LEO_489_PILOT_MANIFEST_CHECKSUM,
    pilotManifestEntryHash,
} = require('../../src/lib/content-review/pilot-manifest.ts') as typeof import('../../src/lib/content-review/pilot-manifest')
const {
    PRECOMPUTED_PACKAGE_SCHEMA_VERSION,
    PRECOMPUTED_PACKAGE_SOURCE,
    calculatePrecomputedPackageHash,
    validateAndGeneratePrecomputedProposals,
} = require('../../src/lib/content-review/precomputed.ts') as typeof import('../../src/lib/content-review/precomputed')
const { getEditorialQualityMetrics } = require('../../src/lib/content-review/content-quality.ts') as typeof import('../../src/lib/content-review/content-quality')
import type { ProductContentInput } from '../../src/lib/content-review/types'
import type { PrecomputedProposalPackage, PrecomputedProposalRecord, PrecomputedMediaInput } from '../../src/lib/content-review/precomputed'
const { createDashboardModel, renderDashboardHtml } = require('../../src/lib/content-review/dashboard.ts') as typeof import('../../src/lib/content-review/dashboard')
const { classifyMediaReferences, countMediaClassifications } = require('../../src/lib/content-review/media-classification.ts') as typeof import('../../src/lib/content-review/media-classification')

type ActualProductRow = ProductContentInput & {
    cleanDescriptionHtml?: string | null
    descriptionIssues?: string[]
    descriptionSource?: string | null
}

const MANUAL_FACTS_BY_SKU: Record<string, Array<[string, string]>> = {
    'AT-30H': [
        ['Dòng sản phẩm', 'Máy nước nóng gián tiếp ATMOR AT-30H / AT-50H / AT-80H'],
        ['Chất liệu', 'Nhựa ABS cách điện'],
        ['Áp lực nước vào', '0.05MPa-0.8MPa'],
        ['Công suất', '1.5 – 3kW'],
        ['Dây cấp nước', 'Inox 40cm'],
        ['Dung tích các phiên bản', '30L / 50L / 80L'],
        ['Bảo hành', 'Linh kiện điện tử 1 năm; bình chứa 5 năm'],
    ],
}

type EditorialNarrative = { intro: string; paragraphs: string[]; guidance: string }

const EDITORIAL_NARRATIVES: Record<string, EditorialNarrative> = {
    M16004: {
        intro: 'Bộ xả bồn tắm American Standard M16004 chính hãng giúp hoàn thiện đường thoát nước.',
        paragraphs: [
            'Thiết kế nhựa nhỏ gọn giúp khu vực dưới bồn dễ vệ sinh.',
            'Ống thoát hỗ trợ căn chỉnh vị trí; đối chiếu mã M16004 trước khi mua.',
        ],
        guidance: 'Kiểm tra điểm nối, độ kín và thử thoát trước khi hoàn thiện yếm bồn.',
    },
    'AC-7110501': {
        intro: 'Bộ xả bồn tắm American Standard AC-7110501 chính hãng giúp thoát nước và điều khiển nắp xả gọn, dễ thao tác.',
        paragraphs: [
            'Nút xả tràn kiêm tay vặn kết hợp dây cáp để đóng mở nắp xả bên dưới, giúp thao tác ngay tại cụm điều khiển.',
            'Ống thoát kéo dài 29–78 cm hỗ trợ nhiều vị trí. Hợp kim đồng và lớp mạ crom giúp bề mặt dễ lau chùi, đồng bộ với phòng tắm.',
        ],
        guidance: 'Đo khoảng cách đến điểm thoát, đối chiếu mã AC-7110501/M10681 và thử tay vặn sau khi lắp.',
    },
    'AC-7110400': {
        intro: 'Bộ xả bồn tắm American Standard AC-7110400 chính hãng là lựa chọn cho hệ thống thoát nước cần thao tác đóng mở rõ ràng và linh hoạt theo vị trí bồn.',
        paragraphs: [
            'Cụm nút xả tràn, tay vặn và dây cáp phối hợp để người dùng điều chỉnh nắp xả bên dưới bồn. Nhờ vậy, việc giữ nước trong bồn hoặc xả sau khi tắm có thể thực hiện ngay tại cụm điều khiển phía trên.',
            'Thiết kế nhỏ gọn giúp tận dụng khoảng trống quanh bồn và giữ tổng thể phòng tắm nhẹ mắt. Ống thoát điều chỉnh trong khoảng 29–78 cm hỗ trợ nhiều bố trí, nhưng vẫn cần đối chiếu thực tế trước khi lắp.',
            'Hợp kim đồng và lớp mạ crom sáng ở nút xả tràn, nắp xả hướng đến việc vừa đáp ứng công năng vừa thuận tiện lau chùi. Đây là nhóm phụ kiện nên được chọn cùng kích thước và kiểu kết nối của bồn tắm, không chỉ theo hình thức bên ngoài.',
        ],
        guidance: 'Khi thi công, nên kiểm tra mã AC-7110400/M10675, độ kín các mối nối và khả năng đóng mở nắp xả trước khi che khuất đường ống.',
    },
    'WF-9089-CHROME': {
        intro: 'Sen cây nóng lạnh American Standard WF-9089 chính hãng thuộc bộ sưu tập Simplica, kết hợp bát sen phun mưa và tay sen nhiều chế độ cho phòng tắm gia đình.',
        paragraphs: [
            'Thân sen bằng đồng và lớp mạ Crom/Nikel giúp sản phẩm có cấu hình phù hợp với nhu cầu sử dụng lâu dài và vệ sinh thường xuyên. Bề mặt được mô tả có khả năng hạn chế bám bẩn, vì vậy người dùng có thể lau rửa định kỳ để giữ vẻ sáng sạch.',
            'Bát sen đường kính 230 mm tạo vùng nước phun mưa rộng, trong khi tay sen 5 chế độ cho phép đổi cách dùng theo nhu cầu tắm hằng ngày. Công nghệ Airnergize được hồ sơ mô tả là đưa bọt khí vào dòng nước, hướng đến cảm giác tắm nhẹ và thư giãn hơn.',
            'Tay điều khiển hỗ trợ điều chỉnh nhiệt độ và lượng nước qua các nút bấm. Phiên bản WF-9089 là màu Chrome; hồ sơ cũng ghi nhận lựa chọn WF-9089MB màu Matte Black, nên cần đối chiếu đúng mã và màu trước khi đặt hàng.',
        ],
        guidance: 'Trước khi lắp, hãy kiểm tra áp lực nước 0.1–0.5 MPa, chiều cao thân sen 1128 mm và khoảng trống phía trên bát sen để chọn vị trí phù hợp.',
    },
    AT1157: {
        intro: 'Bồn cầu 1 khối ATMOR AT1157 chính hãng hướng đến phòng tắm cần thiết kế thân kín, nắp đóng êm và thao tác xả nhấn hai mức.',
        paragraphs: [
            'Thân cầu liền giúp giảm các khe nối bên ngoài, thuận tiện hơn khi lau chùi. Bề mặt men nhẵn trong mô tả được định hướng để hạn chế chất bẩn, vì vậy việc vệ sinh đều đặn vẫn là phần quan trọng để giữ bồn cầu sạch và bền.',
            'Hệ thống xả Siphon Jet cùng mức xả 3/6L cho phép người dùng cân nhắc giữa nhu cầu làm sạch và lượng nước mỗi lần sử dụng. Nắp đóng êm giúp giảm tiếng động trong phòng tắm gia đình.',
            'Kích thước 720 x 375 x 710 mm, tâm xả 300 mm và kiểu thoát sàn là các thông tin cần kiểm tra với vị trí cấp thoát nước hiện có. Sản phẩm phù hợp hơn khi công trình đã sẵn sàng cho bồn cầu thân dài và thoát sàn.',
        ],
        guidance: 'Nên đo tâm xả và khoảng trống trước khi đặt mua; sau lắp đặt cần kiểm tra độ kín, cấp nước và cả hai mức xả.',
    },
    MT5140: {
        intro: 'Bồn tắm góc massage Caesar MT5140 chính hãng dành cho phòng tắm muốn tận dụng góc tường và bổ sung trải nghiệm ngâm tắm có massage.',
        paragraphs: [
            'Dáng bồn góc và vị trí yếm trái giúp người thiết kế định hướng sản phẩm vào một góc cụ thể, từ đó giữ lối đi và phần diện tích trung tâm thoáng hơn. Vật liệu Acrylic màu trắng tạo bề mặt đồng nhất với nhiều phong cách phòng tắm; nên dùng chất tẩy rửa phù hợp để bảo quản bề mặt.',
            'Hồ sơ sản phẩm ghi nhận bộ tuần hoàn nước, họng massage, bộ điều chỉnh tốc độ, bơm tăng áp và van vòi nước thải đi kèm. Các chi tiết này giúp người mua hình dung được phần thiết bị cần bố trí và cách sử dụng chức năng massage, thay vì chỉ nhìn vào kích thước bồn.',
            'Kích thước 1410 x 1410 x 600 mm phù hợp để đối chiếu với hai cạnh tường. Gối đầu cao su mềm là tiện ích được ghi nhận trong hồ sơ, hỗ trợ tư thế khi sử dụng; nguồn điện và hệ thống cấp thoát nước cần được chuẩn bị theo hướng dẫn lắp đặt thực tế.',
        ],
        guidance: 'Trước khi chốt, hãy kiểm tra hướng yếm trái, mặt bằng góc, đường điện 220V và không gian bảo trì quanh bơm; hồ sơ hiện có chênh lệch dung tích 220 L/272 L nên cần xác nhận lại với tài liệu kỹ thuật.',
    },
    'BFV-3003-1C': {
        intro: 'Bộ vòi sen tắm nóng lạnh INAX BFV-3003-1C chính hãng phù hợp cho phòng tắm cần van nóng lạnh và tay sen phun tia massage.',
        paragraphs: [
            'Van ceramic hỗ trợ điều chỉnh nhiệt độ và lưu lượng; tay sen phun rửa mạnh, có thêm lựa chọn phun tia massage.',
            'Lớp mạ Cr-Ni dễ phối với thiết bị khác. Lau khô và vệ sinh cặn định kỳ giúp bề mặt, đầu phun sạch hơn.',
            'Áp lực 0.05–0.75 MPa, mã BFV-3003-1C và chế độ nóng lạnh là các điểm cần đối chiếu trước khi lắp.',
        ],
        guidance: 'Kiểm tra đường cấp, áp lực và khoảng cách lắp; sau đó thử van và các chế độ phun.',
    },
    SW6181HSG: {
        intro: 'Bồn tiểu nam đặt sàn cảm ứng Cynthia MOEN SW6181HSG chính hãng giúp giảm thao tác chạm tay.',
        paragraphs: [
            'Van xả tự động theo cảm biến và có chế độ xả 24 giờ, phù hợp nơi dùng không liên tục.',
            'Thân sứ đặt sàn, mức xả 3L; cảm biến 30–80 cm và phản hồi khoảng 3 giây cần đối chiếu.',
            'Kích thước 330 x 340 x 1065 mm và xả sàn 180 mm cần vừa mặt bằng.',
            'Cấu hình này phù hợp cho nhà vệ sinh cần thao tác vệ sinh ít chạm, nhưng người mua vẫn nên cân nhắc vị trí cảm biến, nguồn cấp và khoảng trống bảo trì để việc sử dụng hằng ngày ổn định.',
        ],
        guidance: 'Chốt nguồn AC 220V/DC 6V hoặc pin, kiểm tra xả sàn và khoảng bảo trì.',
    },
    'CS326DT10#XW': {
        intro: 'Bồn cầu 2 khối TOTO CS326DT10#XW chính hãng đi kèm nắp đóng êm TC395VS, phù hợp cho gia đình cần bồn cầu thân dài, dễ vệ sinh và có hai mức xả.',
        paragraphs: [
            'Vành kín và lớp men CEFIONTECT trong hồ sơ được mô tả là giúp hạn chế chất bẩn bám trên bề mặt, còn thiết kế thân bán kín giúp việc lau chùi khu vực quanh chân cầu thuận tiện hơn. Nắp TC395VS đóng mở êm, phù hợp với phòng tắm gia đình cần giảm tiếng động.',
            'Hệ thống xả Tornado tạo dòng xoáy liên tục bên trong lòng cầu để làm sạch các vùng dễ đọng bẩn; hai mức 4.5/3L cho phép chọn lượng nước theo nhu cầu sử dụng. Đây là lợi ích thực tế cần cân nhắc cùng áp lực nước tại công trình.',
            'Bộ sản phẩm gồm van dừng và dây cấp. Kích thước thân 710 x 380 x 718 mm, tâm xả 305 mm, nắp TC395VS#W và thiết kế cho bàn cầu thân dài giúp người mua đối chiếu chính xác trước khi thay mới.',
            'Với phòng tắm gia đình, sự kết hợp giữa bề mặt dễ lau, nắp đóng êm và lựa chọn hai mức xả giúp cân bằng việc chăm sóc hằng ngày với nhu cầu tiết kiệm nước. Hãy xem cả hướng mở cửa, khoảng đứng và vị trí cấp nước trước khi chốt.',
            'Khi so sánh với mẫu cũ, nên đối chiếu đồng thời thân cầu, nắp đi kèm và tâm xả thay vì chỉ dựa vào ảnh. Cách kiểm tra này giúp hạn chế phải đổi phụ kiện sau khi thi công, đồng thời giữ được khoảng trống cần thiết để vệ sinh quanh chân cầu.',
        ],
        guidance: 'Nên đo tâm xả, khoảng trống trước/sau và áp lực nước 0.05–0.70 MPa; sau lắp đặt hãy thử cả hai mức xả và độ êm của nắp.',
    },
    V93: {
        intro: 'Bồn cầu thông minh 1 khối Viglacera V93 chính hãng kết hợp thân kín, nắp điện tử và xả tự động cho phòng tắm muốn tích hợp thêm tiện ích chăm sóc cá nhân.',
        paragraphs: [
            'Hồ sơ mô tả bề mặt men Nano Nung hạn chế bám bẩn, cùng chức năng sấy và xả tráng tự động trước khi sử dụng. Các tiện ích rửa trước, rửa sau, rửa massage, sưởi nắp và làm ấm nước giúp người dùng lựa chọn trải nghiệm phù hợp thay vì chỉ sử dụng chức năng xả cơ bản.',
            'Đầu vòi có khử trùng bằng tia UV theo nội dung nguồn, còn hệ thống xả xoáy kết hợp Siphon Jet tự động xả sau khi dùng. Đây là những tính năng cần được gia đình cân nhắc cùng thói quen sử dụng, nguồn điện và yêu cầu vệ sinh định kỳ.',
            'Thân cầu kín màu trắng có kích thước 690 x 400 x 520 mm; mức xả 6/3L và tâm xả 300 mm (+-5) là các thông tin quan trọng để bố trí cấp thoát nước. Nguồn điện 220V và áp lực nước 0.12–0.8 MPa cũng cần được chuẩn bị trước khi lắp.',
        ],
        guidance: 'Nên đo tâm xả, kiểm tra ổ điện an toàn và áp lực nước, đồng thời chừa khoảng trống để vệ sinh nắp điện tử và bảo trì các bộ phận điều khiển.',
    },
    'INAX-20B/CRB-1': {
        intro: 'Gạch ốp tường I-Concept CERABORDER INAX-20B/CRB chính hãng tạo điểm nhấn mộc từ bề mặt đá sỏi.',
        paragraphs: [
            'Viên 145 x 20 mm trên vỉ 276 x 296 mm tạo nhịp nhỏ, phù hợp cho mảng tường muốn có chiều sâu thay vì phẳng đơn sắc.',
            'Hồ sơ ghi nhận khả năng chống tia tử ngoại, chống thấm, chống xước, chống hóa chất và chống cháy; keo EGR được dùng khi thi công.',
            'Quy cách 24 viên/vỉ, 20 vỉ/thùng và 12.2 vỉ/m² giúp dự tính vật tư, nhưng vẫn cần cộng hao hụt theo cách chia mảng.',
        ],
        guidance: 'Hãy duyệt mẫu, đo diện tích, đối chiếu vỉ 276 x 296 mm và thống nhất keo EGR với thợ trước khi đặt hàng.',
    },
    'INAX-255/VIZ-1': {
        intro: 'Gạch ốp tường 255-VIZ INAX-255VIZ chính hãng tạo texture bằng họa tiết lượn sóng và bề mặt gồ ghề.',
        paragraphs: [
            'Viên mosaic 95 x 45 mm trên vỉ 300 x 300 mm giúp chia mảng và phối đường ron có chủ đích.',
            'Hồ sơ ghi nhận khả năng chống tia tử ngoại, chống thấm, chống xước, chống hóa chất và chống cháy; sản phẩm dùng vữa INAX theo nguồn hiện tại.',
            'Quy cách 18 viên/vỉ, 22 vỉ/thùng và 11.2 vỉ/m² hỗ trợ dự toán, còn bề mặt gồ ghề cần được vệ sinh đúng cách sau thi công.',
        ],
        guidance: 'Nên duyệt mẫu, đo diện tích và hao hụt, rồi xác nhận vữa INAX, độ dày 7.0 mm và cách xử lý góc.',
    },
    'SFV-802S': {
        intro: 'Vòi bếp INAX SFV-802S chính hãng là vòi nóng lạnh cổ cao cho chậu hoặc mặt bàn bếp.',
        paragraphs: [
            'Cổ cao tạo khoảng trống khi rửa, còn nóng lạnh giúp điều chỉnh nước theo công việc. Thân đồng mạ Crom/Ni cần được lau đúng cách.',
            'Một chế độ xả phù hợp người mua ưu tiên thao tác đơn giản. Kích thước 370 x 192 mm và chiều cao 254 mm cần vừa mặt bàn, lỗ chờ.',
            'Áp lực 0.05–0.75 MPa là thông tin nên kiểm tra trước khi chọn và lắp.',
            'Vòi phù hợp khi cần rửa nồi, rau hoặc dụng cụ ở nhiều độ cao khác nhau mà vẫn muốn bố cục bếp gọn. Nên kiểm tra bán kính xoay, khoảng hở phía trên chậu và khả năng tiếp cận các mối nối trước khi hoàn thiện mặt bàn.',
        ],
        guidance: 'Sau lắp đặt, kiểm tra nóng/lạnh và mối nối; vệ sinh cặn nước định kỳ để giữ lớp mạ.',
    },
    'SFV-900SX': {
        intro: 'Vòi bếp dây rút nóng lạnh INAX SFV-900SX chính hãng dành cho chậu rửa cần phạm vi thao tác rộng, đầu vòi kéo ra được và hai chế độ phun.',
        paragraphs: [
            'Cổ vòi cao xoay 360 độ giúp đưa dòng nước tới nhiều vị trí trong chậu, còn đầu dây rút kéo tối đa 400 mm hỗ trợ rửa các góc xa mà vòi cố định khó với tới. Hai chế độ phun cho phép đổi cách dùng giữa rửa thông thường và công việc cần tia nước tập trung.',
            'Tay gạt nóng lạnh và chức năng Cold Start được mô tả để hạn chế việc dùng nước nóng ngoài nhu cầu; lõi van sứ hỗ trợ thao tác trơn tru. Lớp mạ Ni/Cr giúp vòi dễ phối trong bếp và cần được lau đúng cách để giữ bề mặt.',
            'Thân vòi bằng kẽm, đầu vòi cao 238 mm, kích thước đầu vòi 230 mm và áp lực 0.1–0.5 MPa là các điểm cần đối chiếu. Bộ Quick fix hỗ trợ lắp đặt nhanh với chậu theo hồ sơ, nhưng vẫn nên kiểm tra lỗ chờ và không gian dưới mặt bàn.',
        ],
        guidance: 'Trước khi mua, hãy đo chậu và bán kính xoay, xác nhận đường nóng/lạnh; sau lắp đặt thử cả hai chế độ phun, dây rút và các mối nối.',
    },
    TX707AC: {
        intro: 'Lô bàn chải TOTO TX707AC chính hãng là phụ kiện gọn cho lavabo.',
        paragraphs: [
            'Thủy tinh và đồng mạ Niken-Crom dễ phối với phụ kiện phòng tắm.',
            'Kích thước Ø67 x 95 mm giúp kiểm tra khoảng đặt; lau khô để hạn chế cặn.',
        ],
        guidance: 'Đo vị trí đặt và đối chiếu mã TX707AC trước khi mua.',
    },
    'EGR-V2SP/G3': {
        intro: 'Keo INAX EGR-V2SP/G3 chính hãng dùng cho ngoại thất.',
        paragraphs: [
            'Định mức 1.5–2 kg/m² giúp tính vật tư.',
            'Độ bền cắt trên 0.3 N/mm² giúp đối chiếu.',
        ],
        guidance: 'Kiểm tra nền; thi công theo NSX.',
    },
    '61-1361-VN': {
        intro: 'Tay cầm INAX 61-1361-VN chính hãng là phụ kiện thay thế.',
        paragraphs: [
            'Giúp thay tay cầm đúng model.',
            'Đối chiếu vị trí trước khi tháo.',
        ],
        guidance: 'Xác nhận SFV-29 hoặc SFV-30; kiểm tra độ kín sau khi lắp.',
    },
    'A-SFV1013SX-1-1': {
        intro: 'Đầu vòi phun INAX A-SFV1013SX-1-1 chính hãng là phụ kiện thay thế.',
        paragraphs: [
            'Giúp khôi phục đầu phun đúng model.',
            'Kiểm tra ren, gioăng và đầu nối trước khi thay.',
        ],
        guidance: 'Xác nhận SFV-1013SX; lắp đúng hướng dẫn và thử kín.',
    },
    'TBW07001A/TBV01407B/TBN01001B': {
        intro: 'Set sen tắm âm tường TOTO TBW07001A/TBV01407B/TBN01001B chính hãng là bộ đồng bộ.',
        paragraphs: [
            'Bộ gồm bát sen 200 mm, van nhiệt và phụ kiện âm tường.',
            'Âm tường giữ bề mặt gọn; van nhiệt hỗ trợ điều chỉnh.',
        ],
        guidance: 'Chốt vị trí, cấp nước trước khi ốp lát; kiểm tra đủ ba mã.',
    },
    'AT-30H': {
        intro: 'Máy nước nóng gián tiếp ATMOR AT-30H chính hãng có các phiên bản 30L, 50L và 80L để chọn theo nhu cầu.',
        paragraphs: [
            'Điều khiển tự động, lớp giữ nhiệt polyurethane 20 mm, ELCB và thanh magie là các điểm nên đối chiếu khi mua và bảo trì.',
            'AT-30H 30L có kích thước Ø340 x 650 mm, 15 kg; AT-50H 50L là Ø340 x 910 mm, 17.4 kg; AT-80H 80L là Ø410 x 918 mm, 20.6 kg.',
            'Áp lực 0.05–0.8 MPa, công suất 1.5–3kW và dây inox 40 cm cần được đưa cho thợ điện nước; hồ sơ cũng nêu các bảo vệ quá áp, quá nhiệt và tiếp đất.',
            'Các phiên bản dung tích khác nhau giúp gia đình cân nhắc theo số người và không gian treo, còn lớp giữ nhiệt hỗ trợ giảm thất thoát nhiệt trong thời gian chờ. Việc chọn đúng tường chịu lực, đường điện và hệ thống tiếp đất quan trọng hơn việc chỉ nhìn vào dung tích.',
        ],
        guidance: 'Chọn đúng phiên bản, kiểm tra tường, điện, áp lực nước và tiếp đất; bảo trì theo hướng dẫn.',
    },
}

function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function scalarText(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
    return JSON.stringify(value)
}

function factItems(row: ActualProductRow): Array<[string, string]> {
    const items: Array<[string, string]> = []
    for (const fact of row.structuredFacts || []) {
        const label = scalarText(fact.definitionLabel || fact.definitionKey || fact.rawKey)
        const value = scalarText(fact.optionValue || fact.valueText || fact.valueNumber || fact.rawValue || fact.valueJson)
        if (!label || !value || /hita|https?:\/\//i.test(`${label} ${value}`)) continue
        items.push([label, value])
    }
    for (const item of MANUAL_FACTS_BY_SKU[row.sku] || []) items.push(item)
    const seen = new Set<string>()
    return items.filter(([label, value]) => {
        const key = `${label}:${value}`.toLocaleLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function buildAfterHtml(row: ActualProductRow): { html: string; requiredFacts: string[] } {
    const facts = [['SKU', row.sku] as [string, string], ...factItems(row)]
    const brand = row.brand?.name || ''
    const narrative = EDITORIAL_NARRATIVES[row.sku] || {
        intro: `${row.name} chính hãng là lựa chọn cần được đối chiếu theo hồ sơ sản phẩm hiện có.`,
        paragraphs: ['Thông tin được sắp xếp lại từ nội dung Before và dữ liệu kỹ thuật đã kiểm tra, không bổ sung công dụng ngoài hồ sơ.'],
        guidance: 'Nên đối chiếu mã sản phẩm, kích thước và điều kiện lắp đặt thực tế trước khi mua.',
    }
    const narrativeText = [narrative.intro, ...narrative.paragraphs, narrative.guidance].join(' ')
    const requiredFacts = [brand, row.sku, ...facts.map(([, value]) => value).filter(value => narrativeText.includes(value))]
        .filter(value => value && !/hita|https?:\/\//i.test(value))
        .filter((value, index, values) => values.indexOf(value) === index)
    const heading = row.name.toLocaleLowerCase().includes(row.sku.toLocaleLowerCase())
        ? row.name
        : `${row.name} — mã ${row.sku}`
    const embeddedUrls = extractEmbeddedImageUrls(row.descriptionHtml)
    const figure = (url: string, sourceId: string, alt: string) =>
        `<figure data-media-source-id="${sourceId}"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"></figure>`
    const replacement = (sourceId: string, label: string) =>
        `<figure><span>[[MEDIA:${sourceId}]] ${escapeHtml(label)} — cần nguồn hình ảnh chính thức</span></figure>`
    const checkpointHtml: Record<string, string> = {
        'SFV-900SX': [
            `<h2>${escapeHtml(heading)}</h2>`,
            `<p>${escapeHtml(narrative.intro)}</p>`,
            figure(row.imageMainUrl || '', 'main', `${row.name} — tổng quan sản phẩm`),
            '<h3>Khi chậu rửa cần linh hoạt hơn</h3>',
            `<p>${escapeHtml(narrative.paragraphs[0] || '')}</p>`,
            figure(embeddedUrls[0] || '', 'embedded:0', `${row.name} — tính năng dây rút`),
            '<h3>Thao tác hằng ngày và bề mặt</h3>',
            `<p>${escapeHtml(narrative.paragraphs[1] || '')}</p>`,
            figure(embeddedUrls[1] || '', 'embedded:1', `${row.name} — chi tiết vận hành`),
            '<h3>Kiểm tra trước khi chốt</h3>',
            `<p>${escapeHtml(narrative.paragraphs[2] || '')}</p>`,
            figure(embeddedUrls[2] || '', 'embedded:2', `${row.name} — kích thước hoặc lắp đặt`),
            `<p>${escapeHtml(narrative.guidance)}</p>`,
        ].filter(Boolean).join(''),
        MT5140: [
            `<h2>${escapeHtml(heading)}</h2>`,
            '<h3>Một lựa chọn cho góc thư giãn</h3>',
            `<p>${escapeHtml(narrative.intro)}</p>`,
            replacement('main', 'Ảnh tổng quan Caesar MT5140'),
            '<h3>Trải nghiệm sử dụng cần hình dung trước</h3>',
            `<p>${escapeHtml(narrative.paragraphs[1] || '')}</p>`,
            '<h3>Đặt vừa không gian rồi mới chọn tính năng</h3>',
            `<p>${escapeHtml(narrative.paragraphs[0] || '')}</p>`,
            `<p>${escapeHtml(narrative.paragraphs[2] || '')}</p>`,
            replacement('gallery:156235', 'Ảnh hoặc bản vẽ lắp đặt Caesar MT5140'),
            `<p><strong>Điểm cần xác nhận với tư vấn viên:</strong> ${escapeHtml(narrative.guidance)}</p>`,
        ].join(''),
        V93: [
            `<h2>${escapeHtml(heading)}</h2>`,
            `<p>${escapeHtml(narrative.intro)}</p>`,
            replacement('main', 'Ảnh sản phẩm Viglacera V93'),
            '<h3>Tiện ích điện tử phục vụ thói quen hằng ngày</h3>',
            `<p>${escapeHtml(narrative.paragraphs[0] || '')}</p>`,
            '<h3>Ưu tiên an toàn khi chuẩn bị công trình</h3>',
            `<p>${escapeHtml(narrative.paragraphs[2] || '')}</p>`,
            replacement('embedded:0', 'Bản vẽ kỹ thuật Viglacera V93'),
            '<h3>Chăm sóc và vận hành</h3>',
            `<p>${escapeHtml(narrative.paragraphs[1] || '')}</p>`,
            `<p>${escapeHtml(narrative.guidance)}</p>`,
        ].join(''),
        'A-SFV1013SX-1-1': [
            `<h2>${escapeHtml(heading)}</h2>`,
            '<p><strong>Phụ kiện đúng mã trước khi thay:</strong> ' + escapeHtml(narrative.intro) + '</p>',
            '<h3>1. Đối chiếu bộ vòi đang dùng</h3>',
            `<p>${escapeHtml(narrative.paragraphs[0] || '')}</p>`,
            replacement('main', 'Ảnh đối chiếu đầu vòi INAX A-SFV1013SX-1-1'),
            '<h3>2. Kiểm tra trước khi tháo lắp</h3>',
            `<p>${escapeHtml(narrative.paragraphs[1] || '')}</p>`,
            `<p>${escapeHtml(narrative.guidance)}</p>`,
        ].join(''),
    }
    const embeddedHtml = embeddedUrls.map((url, index) => figure(url, `embedded:${index}`, `${row.name} - hình ${index + 1}`)).join('')
    const raw = checkpointHtml[row.sku] || [
        `<h2>${escapeHtml(heading)}</h2>`,
        `<p>${escapeHtml(narrative.intro)}</p>`,
        ...narrative.paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`),
        `<p><strong>Gợi ý chọn, lắp đặt và sử dụng:</strong> ${escapeHtml(narrative.guidance)}</p>`,
        embeddedHtml,
    ].join('')
    return { html: cleanupProductHtml(raw), requiredFacts }
}

function buildMedia(row: ActualProductRow): PrecomputedMediaInput[] {
    return [
        ...(row.imageMainUrl ? [{ kind: 'main' as const, url: row.imageMainUrl, sourceId: 'main' }] : []),
        ...(row.galleryImages || []).map(image => ({
            kind: 'gallery' as const,
            url: image.url,
            sourceId: `gallery:${image.id ?? image.sortOrder ?? image.url}`,
        })),
        ...extractEmbeddedImageUrls(row.descriptionHtml).map((url, index) => ({
            kind: 'embedded' as const,
            url,
            sourceId: `embedded:${index}`,
        })),
    ]
}

function createRecord(entry: (typeof LEO_489_PILOT_MANIFEST)[number], row: ActualProductRow): PrecomputedProposalRecord {
    if (row.id !== entry.id || row.sku !== entry.sku || row.brand?.slug !== entry.brandSlug) {
        throw new Error(`Actual product identity does not match manifest for ${entry.id}`)
    }
    const media = buildMedia(row)
    const after = buildAfterHtml(row)
    const mediaInventory = media.map(item => ({ kind: item.kind, sourceId: item.sourceId, url: item.url }))
    const input: ProductContentInput = {
        ...row,
        sourceUrl: row.sourceUrl || `aws-postgresql://products/${row.id}`,
        descriptionHtml: row.descriptionHtml || '',
        galleryImages: row.galleryImages || [],
    }
    return {
        manifest: { ...entry },
        input,
        requiredFacts: after.requiredFacts,
        generatedHtml: after.html,
        media,
        actualInventory: {
            mainCount: media.filter(item => item.kind === 'main').length,
            galleryCount: media.filter(item => item.kind === 'gallery').length,
            embeddedCount: media.filter(item => item.kind === 'embedded').length,
            totalCount: media.length,
        },
        provenance: {
            source: 'aws_postgresql_read_only',
            inputHash: hashObject(input),
            beforeDescriptionHash: hashObject(input.descriptionHtml),
            afterDescriptionHash: hashObject(after.html),
            factsHash: hashObject(after.requiredFacts),
            sourceRecordHash: hashObject(row),
            mediaInventoryHash: hashObject(mediaInventory),
        },
    }
}

function redactMediaUrls(html: string): string {
    return html.replace(/\s+(src|href)="([^"]*)"/gi, (_match, attribute: string, url: string) =>
        ` ${attribute}="[redacted URL sha256=${sha256(url)}]"`,
    )
}

function sanitizeStaticPreview(html: string): string {
    return cleanupProductHtml(html)
        .replace(/https?:\/\/[^\s"'<>]*hita\.com\.vn[^\s"'<>]*/gi, '[Hita URL removed]')
        .replace(/\bhita\b/gi, '[brand reference removed]')
        .replace(/(?<!\d)(?:\+?84|0)\d{8,10}(?!\d)/g, '[contact removed]')
        .replace(/[ \t]+$/gm, '')
}

function mediaLabel(record: PrecomputedProposalRecord): string {
    const inputs = record.media.map(item => {
        const image = createReviewImage(item.kind, item.url)
        const host = image.policy === 'HITA_HOSTED_REVIEW' ? 'Hita' : image.policy === 'KEEP_EXISTING_BUNNY' ? 'Bunny CDN' : 'External'
        return { item, image, host, input: { sku: record.manifest.sku, kind: item.kind, sourceId: item.sourceId, fingerprint: image.fingerprint, host } }
    })
    const classifications = classifyMediaReferences(inputs.map(input => input.input))
    return inputs.map(({ item, image }, index) => {
        const classification = classifications[index]
        return `${item.sourceId}: ${item.kind} — ${image.policy} → ${image.decision} — proposed ${classification.action} — origin ${classification.origin} — confidence ${classification.confidence} — cluster ${classification.visualCluster} — official ${classification.officialSourceVerification} — duplicate ${classification.duplicateFingerprint} — sourceRef ${classification.officialSourceRef} — ${classification.evidence} — classification ${JSON.stringify(classification)}`
    }).join('\n')
}

function buildReviewBundle(
    packageValue: PrecomputedProposalPackage,
    proposals: Awaited<ReturnType<typeof validateAndGeneratePrecomputedProposals>>['proposals'],
): string {
    const recordsById = new Map(packageValue.records.map(record => [record.manifest.id, record]))
    const mediaClassifications = packageValue.records.flatMap(record => {
        const inputs = record.media.map(item => {
            const image = createReviewImage(item.kind, item.url)
            const host = image.policy === 'HITA_HOSTED_REVIEW' ? 'Hita' : image.policy === 'KEEP_EXISTING_BUNNY' ? 'Bunny CDN' : 'External'
            return { sku: record.manifest.sku, kind: item.kind, sourceId: item.sourceId, fingerprint: image.fingerprint, host }
        })
        return classifyMediaReferences(inputs)
    })
    const mediaCounts = countMediaClassifications(mediaClassifications)
    const sections = proposals.map((proposal, index) => {
        const record = recordsById.get(proposal.product.id)
        if (!record) throw new Error(`Missing bundle record for ${proposal.product.id}`)
        const telemetry = proposal.generation.telemetry
        const diff = proposal.audit?.diff
        const quality = getEditorialQualityMetrics(record.input.descriptionHtml, proposal.after.descriptionHtml)
        return [
            `## ${index + 1}. ${proposal.product.name}`,
            '',
            `- Product ID: \`${proposal.product.id}\``,
            `- SKU: \`${proposal.product.sku}\``,
            `- Brand/category: \`${record.input.brand?.slug}\` / \`${record.input.category?.slug}\``,
            `- Validation: **PASS**`,
            `- Actual media inventory: main ${record.actualInventory.mainCount}; gallery ${record.actualInventory.galleryCount}; embedded ${record.actualInventory.embeddedCount}; total ${record.actualInventory.totalCount}`,
            '- Exact image decisions:',
            '```text',
            mediaLabel(record),
            '```',
            `- Provenance hashes: source \`${record.provenance.sourceRecordHash}\`; before \`${record.provenance.beforeDescriptionHash}\`; after \`${record.provenance.afterDescriptionHash}\`; facts \`${record.provenance.factsHash}\`; media \`${record.provenance.mediaInventoryHash}\``,
            `- Telemetry: ${telemetry?.beforeCharacters || 0} → ${telemetry?.afterCharacters || 0} characters; token estimate ${telemetry?.beforeTokenEstimate || 0} → ${telemetry?.afterTokenEstimate || 0}`,
            `- Editorial quality: normalized Before ${quality.beforeCharacters} chars → After ${quality.afterCharacters} chars (${(quality.ratio * 100).toFixed(1)}%); ${quality.paragraphCount} narrative paragraphs; ${quality.buyerBenefitSignals} buyer-benefit signals; review **${quality.editorialReview}**; audit **${quality.flags.length ? quality.flags.join(', ') : 'PASS'}**${quality.editorialReviewReason ? ` — ${quality.editorialReviewReason}` : ''}`,
            '',
            '### Before (sanitized preview)',
            '',
            '```html',
            redactMediaUrls(sanitizeStaticPreview(record.input.descriptionHtml)),
            '```',
            '',
            '### After',
            '',
            '```html',
            redactMediaUrls(proposal.after.descriptionHtml),
            '```',
            '',
            '### Deterministic diff',
            '',
            `- Algorithm: \`${diff?.algorithm || 'n/a'}\``,
            `- Changed: \`${diff?.changed ? 'yes' : 'no'}\``,
            `- Description hashes: before \`${proposal.audit?.beforeDescriptionHash || 'n/a'}\`; after \`${proposal.audit?.afterDescriptionHash || 'n/a'}\``,
            `- Character window: +${diff?.addedCharacters || 0} / -${diff?.removedCharacters || 0}; common prefix ${diff?.commonPrefixCharacters || 0}; common suffix ${diff?.commonSuffixCharacters || 0}`,
            '',
            '```diff',
            `- ${redactMediaUrls(sanitizeStaticPreview(record.input.descriptionHtml))}`,
            `+ ${redactMediaUrls(proposal.after.descriptionHtml)}`,
            '```',
            '',
        ].join('\n')
    }).join('\n')
    return [
        '# LEO-489 Pilot Review Bundle',
        '',
        'Sanitized static review bundle generated from the exact read-only AWS PostgreSQL export. It includes actual product identity/category, sanitized Before, worker-authored After, deterministic diff/provenance, and exact per-image decisions identified by source ID and fingerprint. Hita-hosted media are classified without fetching or copying; URLs are redacted in this committed bundle.',
        '',
        `- Manifest checksum: \`${packageValue.manifestChecksum}\``,
        `- Read-only inventory export hash: \`${packageValue.inventoryExportHash}\``,
        `- Manifest entry hash: \`${packageValue.manifestEntryHash}\``,
        `- Package hash: \`${packageValue.packageHash}\``,
        `- Products: ${proposals.length}`,
        `- Total actual media items: ${packageValue.records.reduce((sum, record) => sum + record.actualInventory.totalCount, 0)}`,
        `- Media v2.1 proposed actions: ${Object.entries(mediaCounts).sort(([left], [right]) => left.localeCompare(right)).map(([action, count]) => `${count} ${action}`).join('; ')}`,
        `- Proposal mode: \`precomputed\``,
        '',
        sections,
    ].join('\n')
}

async function main() {
    const inputPath = process.argv.find(value => value.startsWith('--input='))?.slice('--input='.length)
        || path.join(process.cwd(), 'scripts/content-review/private/leo-489-actual-products.json')
    const packagePath = path.join(process.cwd(), 'scripts/content-review/private/leo-489-pilot-package.json')
    const bundlePath = path.join(process.cwd(), 'docs/review-bundles/leo-489-pilot-review.md')
    const privateDashboard = process.argv.includes('--private')
    const dashboardPath = privateDashboard
        ? path.join(process.cwd(), 'scripts/content-review/private/leo-489-pilot-dashboard.html')
        : path.join(process.cwd(), 'docs/review-bundles/leo-489-pilot-dashboard.html')
    const rawRows = JSON.parse(await fs.readFile(inputPath, 'utf8')) as ActualProductRow[]
    const rowsById = new Map(rawRows.map(row => [row.id, row]))
    if (rawRows.length !== LEO_489_PILOT_MANIFEST.length || rowsById.size !== LEO_489_PILOT_MANIFEST.length) {
        throw new Error('Actual read-only export must contain exactly 20 unique manifest products')
    }
    const records = LEO_489_PILOT_MANIFEST.map(entry => {
        const row = rowsById.get(entry.id)
        if (!row) throw new Error(`Actual read-only export is missing product ${entry.id}`)
        return createRecord(entry, row)
    })
    const editorialFailures = records.map(record => ({
        id: record.manifest.id,
        sku: record.manifest.sku,
        quality: getEditorialQualityMetrics(record.input.descriptionHtml, record.generatedHtml),
    })).filter(item => item.quality.flags.length > 0 && !(item.quality.shortSourceException && item.quality.flags.every(flag => flag.startsWith('length_ratio_out_of_range'))))
    if (editorialFailures.length > 0) {
        throw new Error(`Editorial quality failed: ${editorialFailures.map(item => `${item.sku}(${item.quality.flags.join('|')})`).join(', ')}`)
    }
    const withoutHash = {
        schemaVersion: PRECOMPUTED_PACKAGE_SCHEMA_VERSION,
        source: PRECOMPUTED_PACKAGE_SOURCE,
        manifestChecksum: LEO_489_PILOT_MANIFEST_CHECKSUM,
        inventoryExportHash: hashObject([...rawRows].sort((left, right) => left.id - right.id)),
        manifestEntryHash: pilotManifestEntryHash(),
        records,
    }
    const packageValue: PrecomputedProposalPackage = { ...withoutHash, packageHash: calculatePrecomputedPackageHash(withoutHash) }
    await fs.mkdir(path.dirname(packagePath), { recursive: true })
    await fs.writeFile(packagePath, `${JSON.stringify(packageValue, null, 2)}\n`, 'utf8')
    const validation = await validateAndGeneratePrecomputedProposals(packageValue)
    await fs.mkdir(path.dirname(bundlePath), { recursive: true })
    await fs.writeFile(bundlePath, buildReviewBundle(packageValue, validation.proposals), 'utf8')
    const dashboard = createDashboardModel(packageValue, validation.proposals, privateDashboard ? 'private' : 'public')
    await fs.mkdir(path.dirname(dashboardPath), { recursive: true })
    await fs.writeFile(dashboardPath, renderDashboardHtml(dashboard, privateDashboard ? 'private' : 'public'), 'utf8')
    const packageSha256 = require('node:crypto').createHash('sha256').update(JSON.stringify(packageValue, null, 2) + '\n').digest('hex') as string
    console.log(JSON.stringify({
        products: validation.proposals.length,
        manifestChecksum: packageValue.manifestChecksum,
        inventoryExportHash: packageValue.inventoryExportHash,
        packageHash: packageValue.packageHash,
        packageSha256,
        bundlePath: 'docs/review-bundles/leo-489-pilot-review.md',
        dashboardPath: privateDashboard ? 'scripts/content-review/private/leo-489-pilot-dashboard.html' : 'docs/review-bundles/leo-489-pilot-dashboard.html',
        mode: 'precomputed',
        validation: 'PASS',
        actualMediaItems: records.reduce((sum, record) => sum + record.actualInventory.totalCount, 0),
        databaseWrites: false,
        hitaAssetsFetched: false,
    }, null, 2))
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
