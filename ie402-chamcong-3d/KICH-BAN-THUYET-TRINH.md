# Kịch bản thuyết trình — Đồ án IE402

> Sinh tự động từ `tools/thuyet-trinh/noi-dung.json` — sửa nội dung ở tệp đó rồi chạy `npm run build` trong `tools/thuyet-trinh/` để cập nhật cả slide (ghi chú), bản PDF và tệp này.

**Hệ thống chấm công định vị 3D theo mô hình khối không gian phân tầng** · IE402 — Hệ thống thông tin địa lý 3 chiều · GVHD ThS. Phan Thanh Vũ

## Lời nói theo từng slide

### Slide 1 · Trang bìa — Khôi (~0:45)

Em chào thầy và các bạn. Nhóm 1 xin trình bày đồ án “Hệ thống chấm công định vị 3D theo mô hình khối không gian phân tầng”. Nhóm gồm bốn thành viên: Tín là nhóm trưởng phụ trách mô hình dữ liệu, Nhân phụ trách máy chủ, em là Khôi phụ trách bản đồ 3D, và Vy phụ trách giao diện và kiểm thử. Phần trình bày khoảng mười tám phút, kèm năm phút demo trực tiếp.

### Slide 2 · Vấn đề: hàng rào 2D không biết bạn ở tầng nào — Khôi (~1:15)

Các ứng dụng chấm công bằng GPS hiện nay dùng hàng rào địa lý hai chiều: chỉ kiểm tra điểm có nằm trong đa giác văn phòng hay không. Trong một cao ốc như IFC One Saigon — 42 tầng, nhiều công ty thuê cùng lúc — nhân viên ở tầng 5 và tầng 22 có cùng kinh độ, cùng vĩ độ. Hàng rào 2D sẽ chấp nhận cả hai. Nói cách khác, nhân viên Alpha Tech ngồi ở văn phòng công ty khác vài chục tầng phía trên vẫn được ghi công hợp lệ. Vấn đề nằm ở chính mô hình dữ liệu: thiếu chiều cao.

### Slide 3 · Mục tiêu đề tài — Khôi (~0:50)

Từ đó nhóm đặt ba mục tiêu. Một, chuyển phép kiểm tra từ “điểm thuộc đa giác” sang “điểm thuộc khối” để xác thực được tầng. Hai, phát hiện bất thường bằng bốn quy tắc R1 đến R4 thay vì chỉ trả lời đúng hoặc sai. Ba, đáp ứng yêu cầu của môn: quản lý thêm, sửa, xoá, thống kê dữ liệu và hiển thị trên bản đồ 3D mức chi tiết 3. Em xin mời Tín trình bày phần mô hình.

### Slide 4 · Phần 01 — Phân tích và mô hình hoá — Tín (~0:10)

Phần một: phân tích và mô hình hoá.

### Slide 5 · So sánh các mô hình dữ liệu 3D — Tín (~1:20)

Theo bài giảng, có bốn hướng biểu diễn đối tượng 3D: B-REP, voxel, CSG và tổ hợp. Bài toán của nhóm chỉ cần biểu diễn khối văn phòng — một lăng trụ đứng có đáy là mặt sàn được thuê. Nhóm so sánh các mô hình đã học. 3D-FDS phải lưu cả ARC và EDGE, thừa so với nhu cầu. UDM phải tam giác hoá mặt đáy, mà footprint thật thường lõm. Voxel tốn bộ nhớ và biên bị răng cưa. CSG không biểu diễn được footprint bất quy tắc. SSM của Zlatanova chỉ cần hai nguyên tố NODE và FACE, và được thiết kế cho GIS 3D trên nền web — đúng môi trường của đề tài.

### Slide 6 · Lựa chọn: SSM làm mô hình logic — Tín (~1:15)

Hình bên trái là lược đồ SSM áp vào khối MAP: một BODY là một văn phòng, các FACE thuộc BODY, các NODE có thứ tự trên FACE. Hình bên phải là cách đánh số: n NODE ở đáy, n NODE ở nắp, một FACE đáy, một FACE nắp và n mặt bên. Nhóm có một điều chỉnh: SSM gốc yêu cầu FACE lồi, nhưng footprint của IFC One Saigon có 18 đỉnh và mặt cong, nên nhóm nới lỏng ràng buộc lồi cho mặt đáy và mặt nắp. Các mặt bên luôn là tứ giác lồi.

### Slide 7 · Dung lượng dữ liệu — Tín (~1:00)

Tính dung lượng theo cách của tài liệu ví dụ môn học — mã định danh bốn byte, toạ độ tám byte. Một hình hộp chữ nhật lưu theo SSM tốn 564 byte. Khối của Alpha Tech, đáy 18 đỉnh, tốn 2.468 byte — số này lấy trực tiếp từ hàm ssm_cua_khoi trong CSDL. Nhưng vì khối là lăng trụ đứng, mọi NODE và FACE đều suy ra được từ bộ đa giác đáy, z min, z max. Nên ở mức vật lý nhóm chỉ lưu bộ đó, khoảng 340 byte — nhỏ hơn khoảng bảy lần — và trải ra SSM khi cần.

### Slide 8 · Mô hình MAP — khối chấm công phân tầng — Tín (~1:30)

Từ SSM, nhóm chuyên biệt hoá thành mô hình MAP gồm năm thành phần: đa giác nền P, cao độ z min và z max, dung sai ngang delta xy và dung sai đứng delta z. Cao độ không nhập tay mà suy ra từ dải tầng bằng trigger: z min bằng cao độ nền cộng số tầng phía dưới nhân chiều cao tầng. Phép kiểm tra có hai bước rẻ: điểm có nằm trong đa giác đã nới biên không, rồi cao độ có nằm trong dải đã nới biên không. Kết quả là ba trạng thái. Trạng thái giữa — NGHI NGỜ, đúng toà nhà nhưng sai tầng — chính là trạng thái mà mô hình hai chiều không thể sinh ra. Em xin mời Nhân.

### Slide 9 · Bốn quy tắc phát hiện bất thường — Nhân (~1:00)

Ngoài trạng thái, mỗi lần chấm công được áp bốn quy tắc. R1 sai tầng: báo độ lệch cao độ và quy ra số tầng. R2 dịch chuyển bất khả thi: vận tốc suy ra giữa hai lần chấm công liên tiếp vượt 150 km/h, viết bằng hàm trong PostGIS. R3 độ chính xác bất thường: dưới một mét thì nghi giả lập GPS, trên một trăm mét thì không đủ tin cậy. R4 trùng thiết bị: cùng một thiết bị mà nhiều nhân viên chấm công trong mười phút.

### Slide 10 · Sơ đồ quan hệ thực thể — Tín (~0:50)

Sơ đồ ERD gồm bốn nhóm: tổ chức, không gian gồm toà nhà, văn phòng và khối chấm công, nhân sự, và nghiệp vụ chấm công. Lược đồ PostGIS có 14 bảng, 8 hàm và 4 trigger. Các ràng buộc nghiệp vụ như văn phòng không được vượt số tầng toà nhà, hay tự tính lại cao độ khối khi sửa tầng, đều đặt trong CSDL — nên dù sửa bằng giao diện hay bằng SQL cũng không lọt. Em xin mời Nhân tiếp tục.

### Slide 11 · Use case và luồng chấm công — Nhân (~1:00)

Hệ thống có ba tác nhân: nhân viên chấm công và gửi giải trình, quản lý xử lý cảnh báo và duyệt đơn, quản trị viên quản lý dữ liệu nền. Sơ đồ trình tự bên phải là luồng chấm công: trình duyệt gửi toạ độ và tầng, máy chủ gọi hàm kiểm tra bao hàm trong CSDL, áp R1 đến R4 rồi ghi bản ghi và cảnh báo trong cùng một giao dịch — lỗi ở bước nào thì huỷ toàn bộ.

### Slide 12 · Phần 02 — Thiết kế ứng dụng — Nhân (~0:10)

Phần hai: thiết kế ứng dụng.

### Slide 13 · Kiến trúc và công nghệ — Nhân (~1:00)

Kiến trúc ba lớp. Trình duyệt dùng ArcGIS Maps SDK 4.29 — đúng công nghệ hai bài lab — và JavaScript thuần, không cần bước build. Máy chủ Node.js với Express 5 lo xác thực JWT, phân quyền ba vai trò và toàn bộ API. Logic không gian nằm trong PostgreSQL và PostGIS. Cả hệ thống chạy trên một cổng duy nhất, vì Geolocation API chỉ cấp quyền định vị trên HTTPS hoặc localhost. Em xin mời Khôi trình bày phần bản đồ.

### Slide 14 · LOD1 để tính toán, LOD3 để hiển thị — Khôi (~1:10)

Yêu cầu của môn là bản đồ 3D mức chi tiết 3. Nhóm dùng hai mức cho hai mục đích. Bên phải là LOD1 — khối đùn trơn — đúng với mô hình tính toán, vì chi tiết mặt dựng không làm thay đổi kết quả kiểm tra. Bên trái là LOD3: khối đế, vách kính, dầm từng tầng, khung nhôm đứng, lối vào và mái. Lồng bên trong là ba khối MAP: cam là Alpha Tech, xanh là Beta Finance, tím là Gamma Media. Trên bản đồ có nút chuyển qua lại giữa hai mức.

### Slide 15 · Thành phần LOD3 theo CityGML — Khôi (~0:55)

Mô hình LOD3 không dựng tay mà sinh tự động từ dữ liệu trong CSDL: footprint, cao độ nền, số tầng, chiều cao tầng và số tầng khối đế. Mỗi thành phần gắn một lớp ngữ nghĩa CityGML: tường là WallSurface, kính là Window, cửa là Door, mái là RoofSurface, còn khung nhôm, mái sảnh, thiết bị kỹ thuật là BuildingInstallation. Bấm vào thành phần nào trên bản đồ cũng hiện đúng lớp của nó. Thêm một toà nhà mới là tự có mô hình LOD3. Em xin mời Vy.

### Slide 16 · Quản trị: thêm, sửa, xoá dữ liệu nền — Vy (~1:00)

Đây là tab Quản trị, đáp ứng yêu cầu thêm, sửa, xoá và thống kê của môn. Quản trị viên quản lý sáu loại dữ liệu: toà nhà, văn phòng và khối MAP, nhân viên kèm tài khoản, ca làm việc, công ty, phòng ban. Mặt bằng toà nhà và khối MAP được vẽ trực tiếp trên bản đồ 3D, và khối được xem trước ngay khi nhập dải tầng. Nhập vượt số tầng thì khối báo đỏ và CSDL từ chối khi lưu.

### Slide 17 · Phần 03 — Kết quả — Vy (~0:10)

Phần ba: kết quả.

### Slide 18 · Ba tình huống kiểm thử — Vy (~1:10)

Ba tình huống trên toà nhà thật. Một, nhân viên Alpha Tech chấm công ở tầng 6: cả 3D và 2D đều hợp lệ. Hai, cùng toạ độ đó nhưng ở tầng 22: hàng rào 2D vẫn kết luận hợp lệ — bỏ sót — trong khi hệ thống của nhóm trả về NGHI NGỜ, lệch 62,78 mét, tương đương 13,5 tầng. Ba, đứng cách toà nhà vài trăm mét: cả hai đều ngoài vùng. Tình huống thứ hai là kết quả quan trọng nhất của đồ án.

### Slide 19 · Màn hình tình huống sai tầng — Vy (~0:45)

Đây là màn hình thật của tình huống hai. Thầy để ý tấm sàn tầng đang chọn đã nằm hẳn trong dải xanh của Beta Finance, xa dải cam của Alpha Tech. Kết quả không chỉ nói là sai, mà nói sai bao nhiêu tầng, kèm cảnh báo R1 mức cao để quản lý xử lý.

### Slide 20 · Kiểm thử tự động và đáp ứng yêu cầu môn học — Vy (~1:00)

Nhóm viết kịch bản kiểm thử đầu cuối gồm 34 ca, gọi API thật trên CSDL thật, hiện đạt 34 trên 34. Các ca gồm ba tình huống MAP, phân quyền, thêm sửa xoá từng loại dữ liệu, các ràng buộc CSDL, tự tính lại khối khi sửa tầng, và trải khối theo SSM. Bảng bên phải đối chiếu với yêu cầu trong danh sách đồ án: thêm sửa xoá, thống kê, hiển thị thực thể không gian, và bản đồ 3D mức chi tiết 3 — đều đã đáp ứng. Sau đây em xin demo trực tiếp.

### Slide 21 · Demo trực tiếp — Vy (~5:00)

(Chuyển sang trình duyệt và làm theo sáu bước demo ở phần “Kịch bản demo”. Xong quay lại slide tiếp theo.)

### Slide 22 · Hạn chế và hướng phát triển — Tín (~1:00)

Nhóm xin nêu thẳng các hạn chế. Độ cao GPS trong nhà rất kém, nên hệ thống dùng tầng khai báo và chỉ đối chiếu chứ không tự quyết định. Chưa dùng cảm biến bổ trợ như BLE beacon hay khí áp kế. Dữ liệu chiều cao từ OpenStreetMap rất thiếu — chỉ khoảng 3,7 phần trăm công trình ở TP.HCM có thuộc tính chiều cao. Và không thể chặn hoàn toàn giả lập GPS từ phía web. Hướng phát triển: hợp nhất BLE và khí áp kế, nâng lên LOD4 để chấm công theo phòng, khối MAP có chiều thời gian cho công trường, và tích hợp tính lương. Em xin mời Vy kết thúc phần trình bày.

### Slide 23 · Cảm ơn — Vy (~0:30)

Xin tóm lại trong một câu: khi chuyển phép kiểm tra từ “điểm thuộc đa giác” sang “điểm thuộc khối”, hệ thống sinh ra được một trạng thái mới — “đúng toà nhà, sai tầng” — mà mô hình hai chiều không có dữ liệu để phát hiện. Nhóm cảm ơn thầy và các bạn đã lắng nghe, và xin nhận câu hỏi ạ.

## Demo trực tiếp

**Chuẩn bị**

- Chạy ./chay-demo.sh --lam-moi (Linux) hoặc CAI-DAT.bat rồi BAT-DEMO.bat (Windows) để có dữ liệu sạch; kiểm tra http://127.0.0.1:3000/healthz trả về trang_thai: ok.
- Mở ba cửa sổ trình duyệt, mỗi cửa sổ một tài khoản; dùng cửa sổ ẩn danh cho cửa sổ 2 và 3 để tránh cảnh báo R4 do dùng chung trình duyệt.
- Cửa sổ 1: khoi.nm / 123456, tab Chấm công, chờ bản đồ tải xong (thấy toà nhà và ba dải cam, xanh, tím).
- Cửa sổ 2: nhan.vt / 123456, tab Quản lý.
- Cửa sổ 3: tin.nh / 123456, tab Quản trị.
- Bản đồ 3D cần Internet (ArcGIS và nền bản đồ tải từ CDN). Thử mạng phòng bảo vệ trước; mất mạng thì panel bên trái vẫn đúng số liệu.
- Zoom trình duyệt 125 %, tắt thông báo, cắm sạc.

**1 · TH1 → HỢP LỆ** (~0:45)

- Làm: Cửa sổ 1: bấm Mô phỏng → bấm giữa toà nhà → kéo tầng về 6 → Chấm công VÀO.
- Nói: Tấm sàn tầng 6 sáng xanh lá, nằm gọn trong dải cam của Alpha Tech. Kết quả HỢP LỆ, khoảng cách ngang gần 0 m, cao độ 30,58 m trong dải 23,60–42,20 m.

**2 · TH2 → NGHI NGỜ (điểm nhấn)** (~1:15)

- Làm: Không bấm lại bản đồ → kéo tầng lên 22 → Chấm công RA.
- Nói: Toạ độ giữ nguyên, chỉ đổi tầng. Tấm sàn nhảy lên dải xanh của Beta Finance. Kết quả NGHI NGỜ, lệch +62,78 m ≈ 13,5 tầng, cảnh báo R1 mức CAO. Hàng rào 2D sẽ kết luận hợp lệ.

**3 · TH3 → NGOÀI VÙNG** (~0:30)

- Làm: Bấm Mô phỏng → bấm cách toà nhà vài trăm mét → Chấm công VÀO.
- Nói: NGOÀI VÙNG, khoảng cách ngang vượt xa dung sai 25 m. Nếu di chuyển quá nhanh so với lần trước sẽ có thêm R2.

**4 · Giải trình và duyệt** (~1:00)

- Làm: Tab Lịch sử → bản ghi NGHI NGỜ → Gửi giải trình “Họp với khách hàng ở tầng 22” → cửa sổ 2 (nhan.vt) tab Quản lý → Duyệt → quay lại cửa sổ 1, F5.
- Nói: Bản ghi tự chuyển NGHI NGỜ → HỢP LỆ và cảnh báo R1 được đóng, cả hai trong một giao dịch.

**5 · Quản trị: thêm toà nhà và khối** (~1:00)

- Làm: Cửa sổ 3 (tin.nh) → Toà nhà → + Thêm mới → tên, 18 tầng, 3,8 m, 3 tầng đế → Vẽ đa giác trên bản đồ (bấm 4 điểm, bấm đúp) → Lưu → Văn phòng & khối MAP → + Thêm mới → Alpha Tech, toà vừa tạo, tầng 9–12 → thử nhập 20 ở “Đến tầng” → Lưu (bị từ chối) → sửa lại 12 → Lưu.
- Nói: Vẽ xong là mô hình LOD3 hiện ngay, sinh tự động từ dữ liệu. Khối xem trước 35,40 → 50,60 m. Nhập tầng 20 trong toà 18 tầng thì khối báo đỏ và CSDL từ chối bằng trigger.

**6 · LOD1 ⇄ LOD3 và xuất CSV** (~0:30)

- Làm: Bấm LOD1 rồi LOD3 ở góc bản đồ → cửa sổ 2 bấm Xuất CSV ở Báo cáo công, mở bằng Excel.
- Nói: LOD1 để tính toán, LOD3 để hiển thị. Tệp CSV mở bằng Excel đúng dấu tiếng Việt và đúng cột nhờ BOM UTF-8 và khai báo sep=;.

**Khi có sự cố**

| Tình huống | Xử lý |
|---|---|
| Bản đồ không tải | Nói tiếp bằng số liệu panel trái (vẫn đủ), mở ảnh docs/02-ket-qua-nghi-ngo.png. Không F5 quá một lần. |
| Máy chủ không phản hồi | Xin phép dùng ảnh chụp kết quả đã kiểm chứng và trình bày bằng lời; không sửa lỗi trước hội đồng. |
| Bấm bản đồ không ăn | Nút Mô phỏng phải đang hiện “Đang chờ… bấm lên bản đồ”. |
| Hiện cảnh báo R4 ngoài dự kiến | Do nhiều tài khoản dùng chung một trình duyệt trong 10 phút — đúng thiết kế, giải thích ngắn rồi đi tiếp. |
| Lỗi khi bật ứng dụng | Cổng 3000 bận → ./tat-demo.sh (hoặc TAT-DEMO.bat) rồi bật lại; không kết nối được CSDL → PostgreSQL chưa chạy. |

## Câu hỏi dễ gặp

| Câu hỏi | Người | Ý chính |
|---|---|---|
| Sao không dùng geofence 2D cho đơn giản? | Vy | Tình huống 2 trong demo: cùng toạ độ, khác 17 tầng — chuyện thường ngày trong cao ốc, không phải trường hợp biên. |
| Sao chọn SSM mà không UDM hay 3D-FDS? | Tín | SSM chỉ cần NODE và FACE, làm cho web 3D; UDM phải tam giác hoá đáy lõm; 3D-FDS thừa ARC/EDGE. Nhóm nới ràng buộc FACE lồi cho đáy và nắp. |
| Dung lượng một khối theo SSM là bao nhiêu? | Tín | Hình hộp 564 byte; khối Alpha (18 đỉnh) 2.468 byte; lưu gọn (P, z_min, z_max) khoảng 340 byte, trải ra bằng hàm ssm_cua_khoi(). |
| LOD3 là gì, có theo chuẩn không? | Khôi | Kiến trúc mặt ngoài theo CityGML; mỗi thành phần gắn WallSurface, Window, Door, RoofSurface, BuildingInstallation. Kiểm tra bao hàm vẫn dùng LOD1 vì mặt dựng không đổi kết quả. |
| GPS trong nhà không đo được độ cao thì sao? | Tín | Chuyển từ xác minh độc lập sang đối chiếu khai báo: vẫn phát hiện được không nhất quán, vẫn lưu bằng chứng 3D, sẵn sàng nhận độ cao từ beacon hay khí áp kế. |
| Sao PostGIS mà không MongoDB? | Nhân | Chỉ mục 2dsphere của MongoDB chỉ làm việc trên mặt cầu hai chiều, không truy vấn được thành phần độ cao — không cài được mô hình của đồ án. |
| δxy 25 m và δz 5 m lấy từ đâu? | Tín | δxy theo sai số GNSS ở khu nhà cao tầng; δz xấp xỉ chiều cao một tầng (4,65 m). |
| Có chống được fake GPS không? | Nhân | Không hoàn toàn. R2–R4 chỉ tăng chi phí gian lận; muốn chặn hẳn cần chứng thực phía thiết bị. |
| Quản trị khác quản lý chỗ nào? | Nhân | Quản lý xử lý nghiệp vụ (cảnh báo, duyệt đơn, báo cáo); quản trị quản lý dữ liệu nền — API /api/quan-tri/* trả 403 với quản lý. |
| Sửa chiều cao tầng thì khối có cập nhật không? | Nhân | Có. Trigger trên toa_nha và van_phong đặt lại z rồi trigger suy cao độ tính lại; npm test có kiểm thử đúng trường hợp này. |
| Nhiều toà nhà thì hiệu năng thế nào? | Nhân | Khối được tra theo quan hệ nhân viên – công ty – văn phòng rồi sắp theo khoảng cách; có chỉ mục GiST trên đa giác nền. |
