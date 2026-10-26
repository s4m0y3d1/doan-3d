# Cơ sở dữ liệu — cách chạy và kết quả kiểm chứng

## 1. Kết quả đã kiểm chứng

Toàn bộ script đã được chạy thật trên **PostgreSQL 17.6 + PostGIS 3.6.2** (Windows x64),
không còn là mã "trên giấy".

| Hạng mục | Kết quả |
|---|---|
| `schema.sql` | Chạy hết, thoát mã 0 — tạo **14 bảng**, 8 hàm, 4 trigger |
| `seed.sql` | Chạy hết, thoát mã 0 |
| Trigger suy cao độ | Alpha 23,60→42,20 · Beta 93,35→116,60 · Gamma 163,10→191,00 m — khớp đúng công thức trong báo cáo |
| `kiem_tra_bao_ham()` | TH1 đúng tầng → `HOP_LE` · TH2 sai tầng → `NGHI_NGO` · TH3 ngoài toà nhà → `NGOAI_VUNG` |
| `kiem_tra_r2()` | Chấm công lại sau 3 phút cách 200 km → `true` (bất thường) · cùng toạ độ → `false` |
| Trigger dải tầng | Văn phòng tới tầng 50 trong toà 42 tầng → lỗi *"Toà nhà chỉ có 42 tầng…"*; giảm số tầng toà nhà dưới tầng văn phòng đang dùng → lỗi |
| Trigger tính lại khối | Sửa tầng kết thúc Alpha 8 → 10: khối 23,60–42,20 → 23,60–51,50 m; sửa chiều cao tầng 4,65 → 5 m: cả ba khối tự tính lại |
| `ssm_cua_khoi()` | Khối Alpha (đáy 18 đỉnh) → 1 FACE đáy + 1 FACE nắp + 18 FACE bên, 108 quan hệ NODE ON FACE |

Đã chạy lại trên **PostgreSQL 17.5 + PostGIS 3.5** (Docker `postgis/postgis:17-3.5`,
Linux) qua `./chay-demo.sh` — kết quả giống hệt.

Kết quả của ba tình huống trùng khớp với bản cài đặt bằng JavaScript trong
`prototype/index.html`, xác nhận hai bên cùng một thuật toán.

## 2. Chạy lại trên máy không có quyền admin (không cần Docker)

Cách này dùng bản PostgreSQL đóng gói sẵn dạng zip, giải nén là chạy, không đụng
vào registry và không cần cài đặt.

### 2.1 Tải và giải nén

```powershell
# PostgreSQL binaries (~315 MB)
curl -L -o pg.zip https://get.enterprisedb.com/postgresql/postgresql-17.6-1-windows-x64-binaries.zip
# PostGIS bundle (~119 MB)
curl -L -o postgis.zip https://download.osgeo.org/postgis/windows/pg17/postgis-bundle-pg17-3.6.2x64.zip

Expand-Archive pg.zip      -DestinationPath D:\pgportable\tmp-pg
Expand-Archive postgis.zip -DestinationPath D:\pgportable\tmp-gis
Move-Item D:\pgportable\tmp-pg\pgsql D:\pgportable\pgsql

# Trộn PostGIS vào thư mục PostgreSQL
$src = "D:\pgportable\tmp-gis\postgis-bundle-pg17-3.6.2x64"
foreach ($d in @("bin","lib","share","gdal-data","utils")) {
  Copy-Item (Join-Path $src $d) D:\pgportable\pgsql\ -Recurse -Force
}
```

### 2.2 Khởi tạo và chạy server

```powershell
$bin = "D:\pgportable\pgsql\bin"

# Tạo thư mục dữ liệu (chỉ làm một lần)
& "$bin\initdb.exe" -D D:\pgportable\data -U postgres -A trust --encoding=UTF8 --locale=C

# Chạy server ở cổng riêng, chỉ nghe localhost
& "$bin\pg_ctl.exe" -D D:\pgportable\data `
    -o "-p 55432 -c listen_addresses=127.0.0.1" `
    -l D:\pgportable\server.log start
```

### 2.3 Tạo CSDL và chạy script

```powershell
$bin = "D:\pgportable\pgsql\bin"
$env:PGCLIENTENCODING = "UTF8"

& "$bin\createdb.exe" -h 127.0.0.1 -p 55432 -U postgres chamcong3d
& "$bin\psql.exe" -h 127.0.0.1 -p 55432 -U postgres -d chamcong3d -c "CREATE EXTENSION postgis;"
& "$bin\psql.exe" -h 127.0.0.1 -p 55432 -U postgres -d chamcong3d -v ON_ERROR_STOP=1 -f db\schema.sql
& "$bin\psql.exe" -h 127.0.0.1 -p 55432 -U postgres -d chamcong3d -v ON_ERROR_STOP=1 -f db\seed.sql
```

Bốn câu `SELECT` cuối `seed.sql` sẽ tự in ra kết quả ba tình huống kiểm thử và dải
cao độ mà trigger suy ra.

### 2.4 Dừng server

```powershell
& "D:\pgportable\pgsql\bin\pg_ctl.exe" -D D:\pgportable\data stop
```

Muốn xoá sạch: dừng server rồi xoá thư mục `D:\pgportable`. Không để lại gì trên máy.

## 3. Lưu ý

- `-A trust` chỉ dùng cho môi trường học tập trên máy cá nhân; server chỉ nghe
  `127.0.0.1` nên không truy cập được từ ngoài. Môi trường thật phải dùng `scram-sha-256`.
- Cổng 55432 chọn khác cổng mặc định 5432 để không đụng bản PostgreSQL khác nếu có.
