-- =====================================================================
--  Hệ thống chấm công định vị 3D — lược đồ CSDL (PostgreSQL + PostGIS)
--  Đồ án IE402 — Hệ thống thông tin địa lý 3 chiều
--
--  Chạy:  psql -U postgres -d chamcong3d -f db/schema.sql
--  Yêu cầu: PostgreSQL >= 14, PostGIS >= 3.2
--  Tạo: 14 bảng, 8 hàm, 4 trigger
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- Ngày công, báo cáo tháng, lịch phân ca đều tính theo giờ Việt Nam. Nếu để
-- mặc định UTC (như PostgreSQL trong Docker) thì bản ghi từ 0h–7h sáng bị tính
-- sang ngày hôm trước. Áp dụng cho mọi phiên kết nối mới tới CSDL này.
DO $$ BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone TO %L',
                   current_database(), 'Asia/Ho_Chi_Minh');
END $$;
SET timezone TO 'Asia/Ho_Chi_Minh';

DROP TABLE IF EXISTS canh_bao_bat_thuong, don_giai_trinh, ban_ghi_cham_cong,
    phan_ca, ca_lam_viec, thiet_bi, nguoi_dung, vai_tro, nhan_vien, phong_ban,
    khu_vuc_cham_cong, van_phong, toa_nha, cong_ty CASCADE;

-- ---------------------------------------------------------------------
-- 1. Tổ chức
-- ---------------------------------------------------------------------
CREATE TABLE cong_ty (
    ma_cong_ty   SERIAL PRIMARY KEY,
    ten_cong_ty  VARCHAR(150) NOT NULL,
    ma_so_thue   VARCHAR(20)  UNIQUE
);

CREATE TABLE phong_ban (
    ma_phong_ban  SERIAL PRIMARY KEY,
    ma_cong_ty    INT NOT NULL REFERENCES cong_ty(ma_cong_ty) ON DELETE CASCADE,
    ten_phong_ban VARCHAR(100) NOT NULL
);

-- ---------------------------------------------------------------------
-- 2. Không gian: toà nhà -> văn phòng -> khối chấm công (mô hình MAP)
-- ---------------------------------------------------------------------
CREATE TABLE toa_nha (
    ma_toa_nha     SERIAL PRIMARY KEY,
    ten            VARCHAR(150) NOT NULL,
    dia_chi        VARCHAR(255),
    -- footprint 2D, hệ toạ độ WGS84 (EPSG:4326)
    footprint      GEOMETRY(Polygon, 4326) NOT NULL,
    cao_do_nen     NUMERIC(7,2) NOT NULL,          -- mét, so với mực nước biển
    so_tang        INT          NOT NULL CHECK (so_tang > 0),
    chieu_cao_tang NUMERIC(5,2) NOT NULL CHECK (chieu_cao_tang > 0),
    so_tang_de     INT          NOT NULL DEFAULT 4 -- số tầng khối đế (dùng khi dựng LOD3)
        CHECK (so_tang_de >= 0),
    nguon_du_lieu  VARCHAR(100),                   -- ví dụ: OSM way/306578560
    CONSTRAINT ck_tang_de CHECK (so_tang_de < so_tang)
);
CREATE INDEX idx_toa_nha_footprint ON toa_nha USING GIST (footprint);

CREATE TABLE van_phong (
    ma_van_phong   SERIAL PRIMARY KEY,
    ma_cong_ty     INT NOT NULL REFERENCES cong_ty(ma_cong_ty),
    ma_toa_nha     INT NOT NULL REFERENCES toa_nha(ma_toa_nha),
    ten            VARCHAR(150) NOT NULL,
    tang_bat_dau   INT NOT NULL CHECK (tang_bat_dau >= 1),
    tang_ket_thuc  INT NOT NULL,
    CONSTRAINT ck_dai_tang CHECK (tang_bat_dau <= tang_ket_thuc)
);

-- Hiện thực của khối MAP = (P, z_min, z_max, dxy, dz)
CREATE TABLE khu_vuc_cham_cong (
    ma_khu_vuc      SERIAL PRIMARY KEY,
    ma_van_phong    INT NOT NULL UNIQUE REFERENCES van_phong(ma_van_phong) ON DELETE CASCADE,
    da_giac_nen     GEOMETRY(Polygon, 4326) NOT NULL,   -- P
    z_min           NUMERIC(7,2) NOT NULL,              -- cao độ sàn thấp nhất
    z_max           NUMERIC(7,2) NOT NULL,              -- cao độ trần cao nhất
    dung_sai_ngang  NUMERIC(6,2) NOT NULL DEFAULT 25,   -- dxy, mét
    dung_sai_dung   NUMERIC(6,2) NOT NULL DEFAULT 5,    -- dz, mét
    dang_hieu_luc   BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_z CHECK (z_min < z_max)
);
CREATE INDEX idx_khu_vuc_nen ON khu_vuc_cham_cong USING GIST (da_giac_nen);

-- ---------------------------------------------------------------------
-- 3. Nhân sự, tài khoản, thiết bị
-- ---------------------------------------------------------------------
CREATE TABLE nhan_vien (
    ma_nhan_vien  SERIAL PRIMARY KEY,
    ma_cong_ty    INT NOT NULL REFERENCES cong_ty(ma_cong_ty),
    ma_phong_ban  INT          REFERENCES phong_ban(ma_phong_ban),
    ho_ten        VARCHAR(120) NOT NULL,
    email         VARCHAR(150) UNIQUE,
    ngay_vao_lam  DATE         NOT NULL DEFAULT CURRENT_DATE,
    dang_lam_viec BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE vai_tro (
    ma_vai_tro   SERIAL PRIMARY KEY,
    ten_vai_tro  VARCHAR(30) NOT NULL UNIQUE
        CHECK (ten_vai_tro IN ('NHAN_VIEN','QUAN_LY','QUAN_TRI'))
);

CREATE TABLE nguoi_dung (
    ma_nguoi_dung SERIAL PRIMARY KEY,
    ma_nhan_vien  INT NOT NULL UNIQUE REFERENCES nhan_vien(ma_nhan_vien) ON DELETE CASCADE,
    ma_vai_tro    INT NOT NULL REFERENCES vai_tro(ma_vai_tro),
    ten_dang_nhap VARCHAR(60)  NOT NULL UNIQUE,
    mat_khau_bam  VARCHAR(255) NOT NULL
);

CREATE TABLE thiet_bi (
    ma_thiet_bi        SERIAL PRIMARY KEY,
    ma_nhan_vien       INT NOT NULL REFERENCES nhan_vien(ma_nhan_vien) ON DELETE CASCADE,
    dinh_danh_thiet_bi VARCHAR(120) NOT NULL,
    he_dieu_hanh       VARCHAR(50),
    duoc_tin_cay       BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (ma_nhan_vien, dinh_danh_thiet_bi)
);

-- ---------------------------------------------------------------------
-- 4. Ca làm việc
-- ---------------------------------------------------------------------
CREATE TABLE ca_lam_viec (
    ma_ca            SERIAL PRIMARY KEY,
    ten_ca           VARCHAR(50) NOT NULL,
    gio_vao          TIME NOT NULL,
    gio_ra           TIME NOT NULL,
    tre_toi_da_phut  INT  NOT NULL DEFAULT 15
);

CREATE TABLE phan_ca (
    ma_phan_ca    SERIAL PRIMARY KEY,
    ma_nhan_vien  INT  NOT NULL REFERENCES nhan_vien(ma_nhan_vien) ON DELETE CASCADE,
    ma_ca         INT  NOT NULL REFERENCES ca_lam_viec(ma_ca),
    ngay_lam_viec DATE NOT NULL,
    UNIQUE (ma_nhan_vien, ngay_lam_viec)   -- một người một ca mỗi ngày
);

-- ---------------------------------------------------------------------
-- 5. Chấm công
-- ---------------------------------------------------------------------
CREATE TABLE ban_ghi_cham_cong (
    ma_ban_ghi          BIGSERIAL PRIMARY KEY,
    ma_nhan_vien        INT NOT NULL REFERENCES nhan_vien(ma_nhan_vien),
    ma_khu_vuc          INT          REFERENCES khu_vuc_cham_cong(ma_khu_vuc),
    ma_thiet_bi         INT          REFERENCES thiet_bi(ma_thiet_bi),
    thoi_diem           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    loai                VARCHAR(4)   NOT NULL CHECK (loai IN ('VAO','RA')),
    -- vị trí 3D do thiết bị báo về
    vi_tri              GEOMETRY(PointZ, 4326) NOT NULL,
    do_chinh_xac_ngang  NUMERIC(7,2),
    do_chinh_xac_dung   NUMERIC(7,2),
    nguon_cao_do        VARCHAR(12) NOT NULL DEFAULT 'THIET_BI'
        CHECK (nguon_cao_do IN ('THIET_BI','KHAI_BAO')),
    tang_khai_bao       INT,
    trang_thai          VARCHAR(12) NOT NULL
        CHECK (trang_thai IN ('HOP_LE','NGHI_NGO','NGOAI_VUNG'))
);
CREATE INDEX idx_bgcc_vi_tri ON ban_ghi_cham_cong USING GIST (vi_tri);
CREATE INDEX idx_bgcc_nv_thoi_diem ON ban_ghi_cham_cong (ma_nhan_vien, thoi_diem DESC);

CREATE TABLE canh_bao_bat_thuong (
    ma_canh_bao SERIAL PRIMARY KEY,
    ma_ban_ghi  BIGINT NOT NULL REFERENCES ban_ghi_cham_cong(ma_ban_ghi) ON DELETE CASCADE,
    ma_quy_tac  VARCHAR(2) NOT NULL CHECK (ma_quy_tac IN ('R1','R2','R3','R4')),
    muc_do      VARCHAR(12) NOT NULL CHECK (muc_do IN ('THAP','TRUNG_BINH','CAO')),
    mo_ta       TEXT,
    da_xu_ly    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE don_giai_trinh (
    ma_don       SERIAL PRIMARY KEY,
    ma_nhan_vien INT    NOT NULL REFERENCES nhan_vien(ma_nhan_vien),
    ma_ban_ghi   BIGINT NOT NULL UNIQUE REFERENCES ban_ghi_cham_cong(ma_ban_ghi),
    ly_do        TEXT   NOT NULL,
    trang_thai   VARCHAR(12) NOT NULL DEFAULT 'CHO_DUYET'
        CHECK (trang_thai IN ('CHO_DUYET','DA_DUYET','TU_CHOI')),
    nguoi_duyet  INT REFERENCES nhan_vien(ma_nhan_vien),
    thoi_diem_gui TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
--  HÀM NGHIỆP VỤ
-- =====================================================================

-- Tính z_min / z_max của một văn phòng từ cao độ nền và chiều cao tầng.
CREATE OR REPLACE FUNCTION tinh_dai_cao_do(p_ma_van_phong INT)
RETURNS TABLE (z_min NUMERIC, z_max NUMERIC) AS $$
    SELECT
        t.cao_do_nen + (v.tang_bat_dau - 1) * t.chieu_cao_tang,
        t.cao_do_nen +  v.tang_ket_thuc      * t.chieu_cao_tang
    FROM van_phong v
    JOIN toa_nha  t ON t.ma_toa_nha = v.ma_toa_nha
    WHERE v.ma_van_phong = p_ma_van_phong;
$$ LANGUAGE sql STABLE;

-- Kiểm tra bao hàm khối MAP (mục 2.2.2 của báo cáo).
-- Trả về: HOP_LE | NGHI_NGO | NGOAI_VUNG
CREATE OR REPLACE FUNCTION kiem_tra_bao_ham(
    p_ma_khu_vuc INT,
    p_diem       GEOMETRY,       -- PointZ, 4326
    p_do_chinh_xac_ngang NUMERIC DEFAULT NULL
) RETURNS VARCHAR AS $$
DECLARE
    kv           khu_vuc_cham_cong%ROWTYPE;
    trong_ngang  BOOLEAN;
    trong_dung   BOOLEAN;
    z            NUMERIC;
BEGIN
    SELECT * INTO kv FROM khu_vuc_cham_cong
     WHERE ma_khu_vuc = p_ma_khu_vuc AND dang_hieu_luc;
    IF NOT FOUND THEN
        RETURN 'NGOAI_VUNG';
    END IF;

    -- Bước 1: point-in-polygon có nới biên dxy.
    -- ST_DWithin trên geography cho khoảng cách tính bằng mét.
    trong_ngang := ST_DWithin(
        kv.da_giac_nen::geography,
        ST_Force2D(p_diem)::geography,
        kv.dung_sai_ngang
    );

    IF NOT trong_ngang THEN
        RETURN 'NGOAI_VUNG';
    END IF;

    -- Bước 2: kiểm tra dải cao độ có nới biên dz.
    z := ST_Z(p_diem);
    trong_dung := z BETWEEN (kv.z_min - kv.dung_sai_dung)
                        AND (kv.z_max + kv.dung_sai_dung);

    IF NOT trong_dung THEN
        RETURN 'NGHI_NGO';            -- đúng toà nhà, sai tầng
    END IF;

    -- Độ chính xác thiết bị quá kém thì không kết luận hợp lệ.
    IF p_do_chinh_xac_ngang IS NOT NULL
       AND p_do_chinh_xac_ngang > kv.dung_sai_ngang * 2 THEN
        RETURN 'NGHI_NGO';
    END IF;

    RETURN 'HOP_LE';
END;
$$ LANGUAGE plpgsql STABLE;

-- Quy tắc R2: dịch chuyển bất khả thi giữa hai lần chấm công liên tiếp.
CREATE OR REPLACE FUNCTION kiem_tra_r2(
    p_ma_nhan_vien INT,
    p_diem         GEOMETRY,
    p_thoi_diem    TIMESTAMPTZ,
    p_van_toc_toi_da NUMERIC DEFAULT 150   -- km/h
) RETURNS BOOLEAN AS $$
DECLARE
    truoc   RECORD;
    d_met   NUMERIC;
    d_giay  NUMERIC;
BEGIN
    SELECT vi_tri, thoi_diem INTO truoc
      FROM ban_ghi_cham_cong
     WHERE ma_nhan_vien = p_ma_nhan_vien AND thoi_diem < p_thoi_diem
     ORDER BY thoi_diem DESC LIMIT 1;

    IF NOT FOUND THEN RETURN FALSE; END IF;

    d_met  := ST_Distance(ST_Force2D(truoc.vi_tri)::geography,
                          ST_Force2D(p_diem)::geography);
    d_giay := EXTRACT(EPOCH FROM (p_thoi_diem - truoc.thoi_diem));

    IF d_giay <= 0 THEN RETURN TRUE; END IF;
    RETURN (d_met / d_giay) * 3.6 > p_van_toc_toi_da;   -- TRUE = bất thường
END;
$$ LANGUAGE plpgsql STABLE;

-- Khi z_min/z_max chưa nhập thì tự suy từ dải tầng.
CREATE OR REPLACE FUNCTION trg_dong_bo_cao_do() RETURNS TRIGGER AS $$
DECLARE r RECORD;
BEGIN
    IF NEW.z_min IS NULL OR NEW.z_max IS NULL THEN
        SELECT * INTO r FROM tinh_dai_cao_do(NEW.ma_van_phong);
        NEW.z_min := r.z_min;
        NEW.z_max := r.z_max;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_khu_vuc_cao_do
    BEFORE INSERT OR UPDATE ON khu_vuc_cham_cong
    FOR EACH ROW EXECUTE FUNCTION trg_dong_bo_cao_do();

-- ---------------------------------------------------------------------
-- Toàn vẹn khi sửa dữ liệu (chức năng thêm / sửa của quản trị viên)
-- ---------------------------------------------------------------------

-- Dải tầng của văn phòng phải nằm trong số tầng của toà nhà.
CREATE OR REPLACE FUNCTION trg_kiem_tra_dai_tang() RETURNS TRIGGER AS $$
DECLARE n INT;
BEGIN
    SELECT so_tang INTO n FROM toa_nha WHERE ma_toa_nha = NEW.ma_toa_nha;
    IF NEW.tang_ket_thuc > n THEN
        RAISE EXCEPTION 'Toà nhà chỉ có % tầng, không thể gán văn phòng tới tầng %',
            n, NEW.tang_ket_thuc;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_van_phong_dai_tang
    BEFORE INSERT OR UPDATE ON van_phong
    FOR EACH ROW EXECUTE FUNCTION trg_kiem_tra_dai_tang();

-- Đổi dải tầng của văn phòng thì khối MAP phải tính lại z_min / z_max.
-- Đặt về NULL để trigger tg_khu_vuc_cao_do suy lại theo công thức.
CREATE OR REPLACE FUNCTION trg_van_phong_tinh_lai_khoi() RETURNS TRIGGER AS $$
BEGIN
    UPDATE khu_vuc_cham_cong SET z_min = NULL, z_max = NULL
     WHERE ma_van_phong = NEW.ma_van_phong;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_van_phong_tinh_lai_khoi
    AFTER UPDATE OF tang_bat_dau, tang_ket_thuc, ma_toa_nha ON van_phong
    FOR EACH ROW EXECUTE FUNCTION trg_van_phong_tinh_lai_khoi();

-- Đổi cao độ nền / chiều cao tầng / số tầng của toà nhà: kiểm tra các văn
-- phòng còn nằm trong toà nhà, rồi tính lại mọi khối MAP bên trong.
CREATE OR REPLACE FUNCTION trg_toa_nha_tinh_lai_khoi() RETURNS TRIGGER AS $$
DECLARE vp RECORD;
BEGIN
    SELECT ten, tang_ket_thuc INTO vp FROM van_phong
     WHERE ma_toa_nha = NEW.ma_toa_nha AND tang_ket_thuc > NEW.so_tang
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Văn phòng "%" đang dùng tới tầng %, không thể giảm số tầng xuống %',
            vp.ten, vp.tang_ket_thuc, NEW.so_tang;
    END IF;
    UPDATE khu_vuc_cham_cong SET z_min = NULL, z_max = NULL
     WHERE ma_van_phong IN (SELECT ma_van_phong FROM van_phong
                             WHERE ma_toa_nha = NEW.ma_toa_nha);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_toa_nha_tinh_lai_khoi
    AFTER UPDATE OF cao_do_nen, chieu_cao_tang, so_tang ON toa_nha
    FOR EACH ROW EXECUTE FUNCTION trg_toa_nha_tinh_lai_khoi();

-- =====================================================================
--  BIỂU DIỄN KHỐI MAP THEO MÔ HÌNH SSM (Zlatanova, 2000)
-- ---------------------------------------------------------------------
--  Khối MAP lưu gọn dạng (P, z_min, z_max). Hàm này "trải" khối ra đúng
--  cấu trúc logic của SSM: một BODY gồm các FACE phẳng có hướng, mỗi FACE
--  là dãy NODE có thứ tự (NODE ON FACE, FACE IN BODY).
--    - FACE 0       : mặt đáy (sàn tầng thấp nhất), z = z_min
--    - FACE 1       : mặt nắp (trần tầng cao nhất),  z = z_max
--    - FACE 2..n+1  : n mặt bên, mỗi mặt là tứ giác đứng
--  Mỗi dòng trả về là một quan hệ NODE ON FACE kèm toạ độ NODE.
-- =====================================================================
CREATE OR REPLACE FUNCTION ssm_cua_khoi(p_ma_khu_vuc INT)
RETURNS TABLE (ma_body INT, ma_face INT, loai_face TEXT,
               thu_tu INT, ma_node INT, x DOUBLE PRECISION,
               y DOUBLE PRECISION, z DOUBLE PRECISION) AS $$
DECLARE
    kv   khu_vuc_cham_cong%ROWTYPE;
    vong GEOMETRY;
    n    INT;
    i    INT;
BEGIN
    SELECT * INTO kv FROM khu_vuc_cham_cong WHERE ma_khu_vuc = p_ma_khu_vuc;
    IF NOT FOUND THEN RETURN; END IF;

    -- vòng ngoài, bỏ điểm lặp cuối; định hướng ngược chiều kim đồng hồ
    vong := ST_ExteriorRing(ST_ForcePolygonCCW(kv.da_giac_nen));
    n := ST_NPoints(vong) - 1;
    ma_body := kv.ma_khu_vuc;

    -- NODE đánh số: 1..n ở đáy, n+1..2n ở nắp
    -- Mặt đáy nhìn từ dưới lên nên đi theo chiều kim đồng hồ (pháp tuyến hướng xuống)
    FOR i IN 1..n LOOP
        ma_face := 0; loai_face := 'DAY'; thu_tu := i;
        ma_node := n - i + 1;
        x := ST_X(ST_PointN(vong, ma_node)); y := ST_Y(ST_PointN(vong, ma_node));
        z := kv.z_min;
        RETURN NEXT;
    END LOOP;
    FOR i IN 1..n LOOP
        ma_face := 1; loai_face := 'NAP'; thu_tu := i;
        ma_node := n + i;
        x := ST_X(ST_PointN(vong, i)); y := ST_Y(ST_PointN(vong, i));
        z := kv.z_max;
        RETURN NEXT;
    END LOOP;
    -- Mặt bên thứ i nối cạnh (i, i+1) của đáy với cạnh tương ứng của nắp
    FOR i IN 1..n LOOP
        ma_face := i + 1; loai_face := 'BEN';
        thu_tu := 1; ma_node := i;
        x := ST_X(ST_PointN(vong, i)); y := ST_Y(ST_PointN(vong, i)); z := kv.z_min;
        RETURN NEXT;
        thu_tu := 2; ma_node := (i % n) + 1;
        x := ST_X(ST_PointN(vong, ma_node)); y := ST_Y(ST_PointN(vong, ma_node)); z := kv.z_min;
        RETURN NEXT;
        thu_tu := 3; ma_node := n + (i % n) + 1;
        x := ST_X(ST_PointN(vong, (i % n) + 1)); y := ST_Y(ST_PointN(vong, (i % n) + 1)); z := kv.z_max;
        RETURN NEXT;
        thu_tu := 4; ma_node := n + i;
        x := ST_X(ST_PointN(vong, i)); y := ST_Y(ST_PointN(vong, i)); z := kv.z_max;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;
