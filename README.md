# IE402 — Hệ thống thông tin địa lý 3 chiều

Bài tập và đồ án môn **Hệ thống thông tin địa lý 3 chiều**, Trường Đại học Công nghệ
Thông tin — ĐHQG TP.HCM. GVHD: ThS. Phan Thanh Vũ.

Toàn bộ dựng bằng **ArcGIS Maps SDK for JavaScript 4.29**, dữ liệu nền lấy từ
**OpenStreetMap** qua Overpass API (giấy phép ODbL).

---

## 1. `hcmc-3d-map` — Bản đồ địa giới hành chính mới TP.HCM

Vẽ lại địa giới TP.HCM sau sáp nhập (hiệu lực 01/07/2025: TP.HCM cũ + Bình Dương +
Bà Rịa – Vũng Tàu) trên `SceneView` 3D.

- **168 đơn vị hành chính cấp xã** = 113 phường + 54 xã + 1 đặc khu (Côn Đảo)
- Tổng diện tích tính được ≈ 6.745 km² (công bố: 6.772,6 km²)
- 4 chế độ hiển thị: loại đơn vị / diện tích / dân số / mật độ dân số, dựng thành
  bản đồ khối 3D (prism map)
- Chuyển qua lại 3D ⇄ 2D, tìm kiếm theo tên, popup thuộc tính

```bash
cd hcmc-3d-map
npx http-server -p 8099 -c-1      # rồi mở http://127.0.0.1:8099/index.html
```

Chi tiết và quy trình tái tạo dữ liệu: [`hcmc-3d-map/README.md`](hcmc-3d-map/README.md)

## 2. `ie402-chamcong-3d` — Đồ án: Hệ thống chấm công định vị 3D

Đề tài **“Xây dựng hệ thống chấm công định vị 3D theo mô hình khối không gian phân
tầng”**. Vấn đề: hàng rào địa lý 2D không phân biệt được người lao động đang ở tầng
nào trong một cao ốc — nhân viên tầng 5 và tầng 22 có cùng toạ độ kinh/vĩ độ.

Giải pháp: mô hình **MAP (Multi-floor Attendance Prism)** — mỗi văn phòng là một khối
lăng trụ `(P, z_min, z_max, δxy, δz)`; phép xác thực chuyển từ “điểm thuộc đa giác”
sang “điểm thuộc khối”, sinh ra trạng thái mà hệ 2D không tạo được: **đúng toà nhà,
sai tầng**.

| Tệp / thư mục | Nội dung |
|---|---|
| `DO-AN.md` | Hồ sơ thiết kế đầy đủ (ERD, Use Case, DFD, Sequence dạng Mermaid) |
| `CHECKPOINT1-*.docx` | Báo cáo Checkpoint 1 theo mẫu của lớp |
| `DO-AN-IE402-*.docx` | Báo cáo theo mẫu đồ án môn học |
| `server/` | Máy chủ Node.js + Express: đăng nhập JWT, API chấm công, duyệt đơn, báo cáo, API quản trị |
| `web/` | Giao diện web nối API, bản đồ 3D LOD1/LOD3 dựng bằng ArcGIS SDK, tab Quản trị |
| `prototype/` | Bản dựng đầu tiên: chỉ thuật toán, chạy hoàn toàn ở trình duyệt |
| `db/` | Lược đồ PostGIS + dữ liệu mẫu + hàm `kiem_tra_bao_ham()` |
| `tools/` | Script sinh tài liệu, chuyển đổi, và tự động hoá thao tác trình duyệt |
| `docs/` | Sơ đồ đã kết xuất và ảnh chụp kết quả |

Ứng dụng có đủ chức năng **thêm / sửa / xoá** (tab Quản trị: toà nhà, văn phòng & khối
MAP, nhân viên, ca làm việc, công ty, phòng ban), **thống kê**, và bản đồ 3D dựng toà
nhà ở **LOD3** (chuyển được sang LOD1). Mô hình logic là **SSM** (Zlatanova, 2000) —
xem `DO-AN.md` mục 2.1.

```bash
cd ie402-chamcong-3d
./chay-demo.sh                    # Linux/macOS: Docker dựng PostGIS, bật máy chủ, mở http://127.0.0.1:3000
./chay-demo.sh --kiem-thu         # + chạy 34 ca kiểm thử tự động
./tat-demo.sh                     # tắt
```

Windows: nhấp đúp `CAI-DAT.bat` (một lần) rồi `BAT-DEMO.bat`. Cần dựng PostgreSQL +
PostGIS trước — xem
[`ie402-chamcong-3d/db/README.md`](ie402-chamcong-3d/db/README.md) (hướng dẫn bản
portable, không cần Docker). Chi tiết vận hành và kịch bản trình diễn:
[`ie402-chamcong-3d/README.md`](ie402-chamcong-3d/README.md).

Kết quả kiểm thử trên toà nhà thật (IFC One Saigon, 42 tầng / 195,3 m):

| Tình huống | Cao độ | Hệ 3D | Hàng rào 2D |
|---|---|---|---|
| Chấm công đúng tầng 6 | 30,58 m | `HOP_LE` | hợp lệ |
| Chấm công ở tầng 22 | 104,98 m | `NGHI_NGO` (lệch 13,5 tầng) | **hợp lệ — bỏ sót** |
| Cách toà nhà 270 m | 30,58 m | `NGOAI_VUNG` | ngoài vùng |

---

## Nguồn dữ liệu

- Ranh giới hành chính và mặt bằng công trình: OpenStreetMap contributors (ODbL),
  trích xuất qua [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- Nền bản đồ và địa hình: Esri ArcGIS (`topo-vector`, `hybrid`, `world-elevation`)

## Lưu ý khi chạy

`GeoJSONLayer` nạp tệp qua HTTP nên **không mở trực tiếp bằng `file://`** — phải chạy
qua một máy chủ HTTP cục bộ như hướng dẫn ở trên.
