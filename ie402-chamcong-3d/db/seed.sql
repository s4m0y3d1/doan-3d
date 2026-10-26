-- =====================================================================
--  Dữ liệu mẫu — toà nhà thử nghiệm: IFC One Saigon (Saigon One Tower)
--  Footprint lấy thật từ OpenStreetMap way/306578560 (ODbL)
--  42 tầng, cao 195,3 m  ->  chiều cao tầng trung bình 195,3 / 42 = 4,65 m
--
--  Chạy sau schema.sql:
--      psql -U postgres -d chamcong3d -f db/seed.sql
-- =====================================================================

INSERT INTO vai_tro (ten_vai_tro) VALUES ('NHAN_VIEN'), ('QUAN_LY'), ('QUAN_TRI');

INSERT INTO cong_ty (ma_cong_ty, ten_cong_ty, ma_so_thue) VALUES
    (1, 'Công ty TNHH Alpha Tech',        '0301234567'),
    (2, 'Công ty CP Beta Finance',        '0302345678'),
    (3, 'Công ty TNHH Gamma Media',       '0303456789');
SELECT setval('cong_ty_ma_cong_ty_seq', 3);

-- ---------------------------------------------------------------------
-- Toà nhà
-- ---------------------------------------------------------------------
INSERT INTO toa_nha (ma_toa_nha, ten, dia_chi, footprint, cao_do_nen,
                     so_tang, chieu_cao_tang, nguon_du_lieu)
VALUES (
    1,
    'IFC One Saigon',
    '34 Tôn Đức Thắng, Phường Sài Gòn, TP. Hồ Chí Minh',
    ST_GeomFromText('POLYGON((
        106.705185 10.770142, 106.705194 10.770332, 106.705801 10.770305,
        106.705794 10.770111, 106.705830 10.770065, 106.705790 10.770017,
        106.705743 10.769976, 106.705690 10.769947, 106.705633 10.769925,
        106.705574 10.769908, 106.705512 10.769902, 106.705453 10.769906,
        106.705399 10.769917, 106.705350 10.769932, 106.705297 10.769957,
        106.705259 10.769982, 106.705285 10.770017, 106.705300 10.770138,
        106.705185 10.770142
    ))', 4326),
    5.00,      -- cao độ nền (m) — Quận 1 khoảng 4-6 m
    42,
    4.65,
    'OSM way/306578560'
);
SELECT setval('toa_nha_ma_toa_nha_seq', 1);

-- ---------------------------------------------------------------------
-- Ba văn phòng ở ba dải tầng khác nhau — bằng chứng trực tiếp cho việc
-- hàng rào 2D không phân biệt được (cả ba có cùng footprint / lat-lon).
-- ---------------------------------------------------------------------
INSERT INTO van_phong (ma_van_phong, ma_cong_ty, ma_toa_nha, ten,
                       tang_bat_dau, tang_ket_thuc)
VALUES
    (1, 1, 1, 'Alpha Tech — Trụ sở',     5,  8),
    (2, 2, 1, 'Beta Finance — Chi nhánh', 20, 24),
    (3, 3, 1, 'Gamma Media — Studio',     35, 40);
SELECT setval('van_phong_ma_van_phong_seq', 3);

-- Khối MAP: z_min / z_max để NULL, trigger tg_khu_vuc_cao_do tự suy ra.
-- Kết quả mong đợi:
--   Alpha  : 23,60 -> 42,20 m
--   Beta   : 93,35 -> 116,60 m
--   Gamma  : 163,10 -> 191,00 m
INSERT INTO khu_vuc_cham_cong (ma_van_phong, da_giac_nen, z_min, z_max,
                               dung_sai_ngang, dung_sai_dung)
SELECT v.ma_van_phong, t.footprint, NULL, NULL, 25, 5
FROM van_phong v JOIN toa_nha t ON t.ma_toa_nha = v.ma_toa_nha;

-- ---------------------------------------------------------------------
-- Nhân sự
-- ---------------------------------------------------------------------
INSERT INTO phong_ban (ma_cong_ty, ten_phong_ban) VALUES
    (1, 'Phòng Kỹ thuật'), (1, 'Phòng Nhân sự'),
    (2, 'Phòng Đầu tư'),   (3, 'Phòng Sản xuất');

INSERT INTO nhan_vien (ma_nhan_vien, ma_cong_ty, ma_phong_ban, ho_ten, email)
VALUES
    (1, 1, 1, 'Nguyễn Minh Khôi',   'khoi.nm@alphatech.vn'),
    (2, 1, 2, 'Võ Thành Nhân',   'nhan.vt@alphatech.vn'),
    (3, 2, 3, 'Nguyễn Tường Vy',   'vy.nt@betafinance.vn'),
    (4, 3, 4, 'Nguyễn Hữu Tín',   'tin.nh@gammamedia.vn');
SELECT setval('nhan_vien_ma_nhan_vien_seq', 4);

-- mật khẩu mẫu "123456", băm bằng bcrypt (cost 10) — sinh bằng:
--   cd server && npm run hash
INSERT INTO nguoi_dung (ma_nhan_vien, ma_vai_tro, ten_dang_nhap, mat_khau_bam) VALUES
    (1, 1, 'khoi.nm',   '$2a$10$Bq..k6/C0RGCKCBql.SDR.MqfRwEOIJlT23pB7Zdo3d3U2cMNUhHm'),
    (2, 2, 'nhan.vt', '$2a$10$Bq..k6/C0RGCKCBql.SDR.MqfRwEOIJlT23pB7Zdo3d3U2cMNUhHm'),
    (3, 1, 'vy.nt','$2a$10$Bq..k6/C0RGCKCBql.SDR.MqfRwEOIJlT23pB7Zdo3d3U2cMNUhHm'),
    (4, 3, 'tin.nh', '$2a$10$Bq..k6/C0RGCKCBql.SDR.MqfRwEOIJlT23pB7Zdo3d3U2cMNUhHm');

INSERT INTO thiet_bi (ma_nhan_vien, dinh_danh_thiet_bi, he_dieu_hanh, duoc_tin_cay) VALUES
    (1, 'dev-khoi-001',   'Android 14', TRUE),
    (2, 'dev-nhan-001', 'iOS 17',     TRUE),
    (3, 'dev-vy-001','Android 13', TRUE),
    (4, 'dev-tin-001', 'iOS 18',     TRUE);

INSERT INTO ca_lam_viec (ma_ca, ten_ca, gio_vao, gio_ra, tre_toi_da_phut)
VALUES
    (1, 'Hành chính', '08:00', '17:30', 15),
    (2, 'Ca chiều',   '13:00', '22:00', 10);
SELECT setval('ca_lam_viec_ma_ca_seq', 2);

INSERT INTO phan_ca (ma_nhan_vien, ma_ca, ngay_lam_viec)
SELECT nv.ma_nhan_vien, 1, CURRENT_DATE FROM nhan_vien nv;

-- =====================================================================
--  BA TÌNH HUỐNG KIỂM THỬ — chạy để thấy mô hình 3D khác 2D chỗ nào
-- =====================================================================

-- Toạ độ tâm toà nhà (dùng chung cho cả ba tình huống)
--   lon = 106.70553 , lat = 10.77012

-- (1) HOP_LE  — nhân viên Alpha Tech đứng ở tầng 6  (z ≈ 5 + 5*4.65 = 28,25)
SELECT 'TH1 đúng tầng' AS tinh_huong,
       kiem_tra_bao_ham(1, ST_SetSRID(ST_MakePoint(106.70553, 10.77012, 28.25), 4326), 8.0)
       AS ket_qua;

-- (2) NGHI_NGO — vẫn nhân viên Alpha Tech nhưng đang ở tầng 22 (z ≈ 102,65)
--     -> hàng rào 2D sẽ báo HỢP LỆ, mô hình MAP bắt được sai tầng.
SELECT 'TH2 sai tầng' AS tinh_huong,
       kiem_tra_bao_ham(1, ST_SetSRID(ST_MakePoint(106.70553, 10.77012, 102.65), 4326), 8.0)
       AS ket_qua;

-- (3) NGOAI_VUNG — đứng cách toà nhà khoảng 300 m
SELECT 'TH3 ngoài toà nhà' AS tinh_huong,
       kiem_tra_bao_ham(1, ST_SetSRID(ST_MakePoint(106.70830, 10.77012, 28.25), 4326), 8.0)
       AS ket_qua;

-- (4) Kiểm tra dải cao độ đã được trigger suy ra đúng chưa
SELECT v.ten, k.z_min, k.z_max
FROM khu_vuc_cham_cong k JOIN van_phong v USING (ma_van_phong)
ORDER BY k.z_min;

-- (5) Khối MAP của Alpha Tech trải ra theo mô hình SSM: số FACE và số quan hệ
--     NODE ON FACE theo từng loại mặt (dùng cho phần tính dung lượng ở báo cáo).
SELECT loai_face,
       count(DISTINCT ma_face) AS so_face,
       count(*)                AS so_node_on_face
FROM ssm_cua_khoi(1)
GROUP BY loai_face
ORDER BY min(ma_face);
