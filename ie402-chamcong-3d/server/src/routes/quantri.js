// Chức năng của quản trị viên: thêm / sửa / xoá dữ liệu nền của hệ thống
//   - công ty, phòng ban
//   - toà nhà (footprint 2D + cao độ nền, số tầng, chiều cao tầng)
//   - văn phòng kèm khối MAP (đa giác nền, dải tầng, dung sai)
//   - nhân viên kèm tài khoản đăng nhập
//   - ca làm việc và phân ca
// Ràng buộc nghiệp vụ (dải tầng hợp lệ, tự tính lại z_min / z_max) nằm ở
// trigger trong CSDL, nên dù sửa bằng API hay bằng SQL đều được kiểm tra.
const express = require("express");
const bcrypt = require("bcryptjs");
const { q, pool } = require("../db");
const { canDangNhap, canCoVaiTro } = require("../auth");

const router = express.Router();
const laQuanTri = [canDangNhap, canCoVaiTro("QUAN_TRI")];

/* ---------------- tiện ích ---------------- */

// Lỗi nghiệp vụ trả về 400 kèm thông báo, không phải lỗi máy chủ.
function loi(status, thongBao) {
  const e = new Error(thongBao);
  e.status = status;
  return e;
}

function soNguyenDuong(v, ten) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw loi(400, ten + " phải là số nguyên dương");
  return n;
}

function chuoiBatBuoc(v, ten) {
  const s = (v === undefined || v === null) ? "" : String(v).trim();
  if (!s) throw loi(400, "Thiếu " + ten);
  return s;
}

// Nhận đa giác GeoJSON (Polygon) từ giao diện, kiểm tra tối thiểu rồi trả chuỗi JSON.
function daGiac(v, ten) {
  let g = v;
  if (typeof g === "string") {
    try { g = JSON.parse(g); } catch (_e) { throw loi(400, ten + " không phải GeoJSON hợp lệ"); }
  }
  if (!g || g.type !== "Polygon" || !Array.isArray(g.coordinates) ||
      !Array.isArray(g.coordinates[0]) || g.coordinates[0].length < 4) {
    throw loi(400, ten + " phải là đa giác GeoJSON có ít nhất 3 đỉnh");
  }
  // Chỉ giữ lon/lat, bỏ z nếu công cụ vẽ trả về.
  const sach = {
    type: "Polygon",
    coordinates: g.coordinates.map((r) => r.map((p) => [Number(p[0]), Number(p[1])])),
  };
  return JSON.stringify(sach);
}

// Đa giác do người dùng vẽ: ép về hệ 4326, sửa tự cắt nếu có, buộc là Polygon.
const SQL_DA_GIAC = (thamSo) =>
  `ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${thamSo}::text), 4326)))`;
const SQL_POLYGON = (thamSo) =>
  `(SELECT (ST_Dump(${SQL_DA_GIAC(thamSo)})).geom ORDER BY ST_Area((ST_Dump(${SQL_DA_GIAC(thamSo)})).geom) DESC LIMIT 1)`;

/* ================================================================== *
 * 1. CÔNG TY
 * ================================================================== */
router.get("/quan-tri/cong-ty", laQuanTri, async (_req, res) => {
  const { rows } = await q(
    `SELECT ct.ma_cong_ty, ct.ten_cong_ty, ct.ma_so_thue,
            (SELECT count(*)::int FROM nhan_vien nv WHERE nv.ma_cong_ty = ct.ma_cong_ty) AS so_nhan_vien,
            (SELECT count(*)::int FROM van_phong vp WHERE vp.ma_cong_ty = ct.ma_cong_ty) AS so_van_phong
       FROM cong_ty ct ORDER BY ct.ma_cong_ty`
  );
  res.json(rows);
});

router.post("/quan-tri/cong-ty", laQuanTri, async (req, res) => {
  const b = req.body || {};
  const { rows } = await q(
    `INSERT INTO cong_ty (ten_cong_ty, ma_so_thue) VALUES ($1, $2) RETURNING *`,
    [chuoiBatBuoc(b.ten_cong_ty, "tên công ty"), b.ma_so_thue || null]
  );
  res.status(201).json(rows[0]);
});

router.put("/quan-tri/cong-ty/:id", laQuanTri, async (req, res) => {
  const b = req.body || {};
  const { rows } = await q(
    `UPDATE cong_ty SET ten_cong_ty = $1, ma_so_thue = $2 WHERE ma_cong_ty = $3 RETURNING *`,
    [chuoiBatBuoc(b.ten_cong_ty, "tên công ty"), b.ma_so_thue || null,
     soNguyenDuong(req.params.id, "Mã công ty")]
  );
  if (!rows.length) throw loi(404, "Không tìm thấy công ty");
  res.json(rows[0]);
});

router.delete("/quan-tri/cong-ty/:id", laQuanTri, async (req, res) => {
  const { rowCount } = await q(`DELETE FROM cong_ty WHERE ma_cong_ty = $1`,
    [soNguyenDuong(req.params.id, "Mã công ty")]);
  if (!rowCount) throw loi(404, "Không tìm thấy công ty");
  res.json({ da_xoa: true });
});

/* ================================================================== *
 * 2. PHÒNG BAN
 * ================================================================== */
router.get("/quan-tri/phong-ban", laQuanTri, async (_req, res) => {
  const { rows } = await q(
    `SELECT pb.ma_phong_ban, pb.ten_phong_ban, pb.ma_cong_ty, ct.ten_cong_ty
       FROM phong_ban pb JOIN cong_ty ct ON ct.ma_cong_ty = pb.ma_cong_ty
      ORDER BY pb.ma_cong_ty, pb.ma_phong_ban`
  );
  res.json(rows);
});

router.post("/quan-tri/phong-ban", laQuanTri, async (req, res) => {
  const b = req.body || {};
  const { rows } = await q(
    `INSERT INTO phong_ban (ma_cong_ty, ten_phong_ban) VALUES ($1, $2) RETURNING *`,
    [soNguyenDuong(b.ma_cong_ty, "Công ty"), chuoiBatBuoc(b.ten_phong_ban, "tên phòng ban")]
  );
  res.status(201).json(rows[0]);
});

router.put("/quan-tri/phong-ban/:id", laQuanTri, async (req, res) => {
  const b = req.body || {};
  const { rows } = await q(
    `UPDATE phong_ban SET ma_cong_ty = $1, ten_phong_ban = $2 WHERE ma_phong_ban = $3 RETURNING *`,
    [soNguyenDuong(b.ma_cong_ty, "Công ty"), chuoiBatBuoc(b.ten_phong_ban, "tên phòng ban"),
     soNguyenDuong(req.params.id, "Mã phòng ban")]
  );
  if (!rows.length) throw loi(404, "Không tìm thấy phòng ban");
  res.json(rows[0]);
});

router.delete("/quan-tri/phong-ban/:id", laQuanTri, async (req, res) => {
  const { rowCount } = await q(`DELETE FROM phong_ban WHERE ma_phong_ban = $1`,
    [soNguyenDuong(req.params.id, "Mã phòng ban")]);
  if (!rowCount) throw loi(404, "Không tìm thấy phòng ban");
  res.json({ da_xoa: true });
});

/* ================================================================== *
 * 3. TOÀ NHÀ
 * ================================================================== */
const COT_TOA_NHA = `
  tn.ma_toa_nha, tn.ten, tn.dia_chi, tn.cao_do_nen, tn.so_tang, tn.chieu_cao_tang,
  tn.so_tang_de, tn.nguon_du_lieu,
  ST_AsGeoJSON(tn.footprint) AS footprint,
  round(ST_Area(tn.footprint::geography)::numeric, 1) AS dien_tich_nen,
  (tn.cao_do_nen + tn.so_tang * tn.chieu_cao_tang) AS cao_do_mai,
  (SELECT count(*)::int FROM van_phong vp WHERE vp.ma_toa_nha = tn.ma_toa_nha) AS so_van_phong`;

router.get("/quan-tri/toa-nha", laQuanTri, async (_req, res) => {
  const { rows } = await q(`SELECT ${COT_TOA_NHA} FROM toa_nha tn ORDER BY tn.ma_toa_nha`);
  res.json(rows);
});

function thamSoToaNha(b) {
  const soTang = soNguyenDuong(b.so_tang, "Số tầng");
  const hTang = Number(b.chieu_cao_tang);
  if (!(hTang > 0 && hTang < 20)) throw loi(400, "Chiều cao tầng phải trong khoảng 0–20 m");
  const zNen = Number(b.cao_do_nen);
  if (!Number.isFinite(zNen)) throw loi(400, "Cao độ nền không hợp lệ");
  const tangDe = b.so_tang_de === undefined || b.so_tang_de === "" ? 0 : Number(b.so_tang_de);
  if (!Number.isInteger(tangDe) || tangDe < 0 || tangDe >= soTang) {
    throw loi(400, "Số tầng đế phải từ 0 đến " + (soTang - 1));
  }
  return [
    chuoiBatBuoc(b.ten, "tên toà nhà"), b.dia_chi || null,
    daGiac(b.footprint, "Footprint toà nhà"),
    zNen, soTang, hTang, tangDe, b.nguon_du_lieu || null,
  ];
}

router.post("/quan-tri/toa-nha", laQuanTri, async (req, res) => {
  const { rows } = await q(
    `INSERT INTO toa_nha (ten, dia_chi, footprint, cao_do_nen, so_tang, chieu_cao_tang,
                          so_tang_de, nguon_du_lieu)
     VALUES ($1, $2, ${SQL_POLYGON("$3")}, $4, $5, $6, $7, $8)
     RETURNING ma_toa_nha`,
    thamSoToaNha(req.body || {})
  );
  res.status(201).json(rows[0]);
});

// Sửa toà nhà. Nếu có đổi footprint thì các khối MAP đang dùng nguyên footprint
// cũ cũng được cập nhật theo (khối vẽ riêng thì giữ nguyên).
router.put("/quan-tri/toa-nha/:id", laQuanTri, async (req, res) => {
  const id = soNguyenDuong(req.params.id, "Mã toà nhà");
  const ts = thamSoToaNha(req.body || {});
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cu = await client.query(`SELECT footprint FROM toa_nha WHERE ma_toa_nha = $1`, [id]);
    if (!cu.rows.length) throw loi(404, "Không tìm thấy toà nhà");
    await client.query(
      `UPDATE toa_nha SET ten = $1, dia_chi = $2, footprint = ${SQL_POLYGON("$3")},
              cao_do_nen = $4, so_tang = $5, chieu_cao_tang = $6, so_tang_de = $7,
              nguon_du_lieu = $8
        WHERE ma_toa_nha = $9`,
      ts.concat([id])
    );
    await client.query(
      `UPDATE khu_vuc_cham_cong kv
          SET da_giac_nen = tn.footprint
         FROM van_phong vp, toa_nha tn
        WHERE kv.ma_van_phong = vp.ma_van_phong
          AND vp.ma_toa_nha = tn.ma_toa_nha
          AND tn.ma_toa_nha = $1
          AND ST_Equals(kv.da_giac_nen, $2::geometry)`,
      [id, cu.rows[0].footprint]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  res.json({ ma_toa_nha: id });
});

router.delete("/quan-tri/toa-nha/:id", laQuanTri, async (req, res) => {
  const { rowCount } = await q(`DELETE FROM toa_nha WHERE ma_toa_nha = $1`,
    [soNguyenDuong(req.params.id, "Mã toà nhà")]);
  if (!rowCount) throw loi(404, "Không tìm thấy toà nhà");
  res.json({ da_xoa: true });
});

/* ================================================================== *
 * 4. VĂN PHÒNG + KHỐI MAP
 *    Một văn phòng có đúng một khối MAP; thêm / sửa cùng lúc cả hai.
 *    z_min / z_max không nhận từ giao diện — trigger suy ra từ dải tầng.
 * ================================================================== */
router.get("/quan-tri/van-phong", laQuanTri, async (_req, res) => {
  const { rows } = await q(
    `SELECT vp.ma_van_phong, vp.ten, vp.tang_bat_dau, vp.tang_ket_thuc,
            vp.ma_cong_ty, ct.ten_cong_ty, vp.ma_toa_nha, tn.ten AS ten_toa_nha,
            kv.ma_khu_vuc, kv.z_min, kv.z_max, kv.dung_sai_ngang, kv.dung_sai_dung,
            kv.dang_hieu_luc,
            ST_AsGeoJSON(kv.da_giac_nen) AS da_giac_nen,
            ST_Equals(kv.da_giac_nen, tn.footprint) AS dung_footprint,
            round(ST_Area(kv.da_giac_nen::geography)::numeric, 1) AS dien_tich_nen,
            round((ST_Area(kv.da_giac_nen::geography) * (kv.z_max - kv.z_min))::numeric, 0)
              AS the_tich,
            (SELECT count(*)::int FROM ban_ghi_cham_cong b WHERE b.ma_khu_vuc = kv.ma_khu_vuc)
              AS so_ban_ghi
       FROM van_phong vp
       JOIN cong_ty ct ON ct.ma_cong_ty = vp.ma_cong_ty
       JOIN toa_nha tn ON tn.ma_toa_nha = vp.ma_toa_nha
       LEFT JOIN khu_vuc_cham_cong kv ON kv.ma_van_phong = vp.ma_van_phong
      ORDER BY vp.ma_toa_nha, vp.tang_bat_dau`
  );
  res.json(rows);
});

function thamSoVanPhong(b) {
  const tangDau = soNguyenDuong(b.tang_bat_dau, "Tầng bắt đầu");
  const tangCuoi = soNguyenDuong(b.tang_ket_thuc, "Tầng kết thúc");
  if (tangDau > tangCuoi) throw loi(400, "Tầng bắt đầu phải nhỏ hơn hoặc bằng tầng kết thúc");
  const dxy = b.dung_sai_ngang === undefined || b.dung_sai_ngang === "" ? 25 : Number(b.dung_sai_ngang);
  const dz = b.dung_sai_dung === undefined || b.dung_sai_dung === "" ? 5 : Number(b.dung_sai_dung);
  if (!(dxy >= 0 && dxy <= 500)) throw loi(400, "Dung sai ngang δxy phải trong khoảng 0–500 m");
  if (!(dz >= 0 && dz <= 50)) throw loi(400, "Dung sai đứng δz phải trong khoảng 0–50 m");
  return {
    ma_cong_ty: soNguyenDuong(b.ma_cong_ty, "Công ty"),
    ma_toa_nha: soNguyenDuong(b.ma_toa_nha, "Toà nhà"),
    ten: chuoiBatBuoc(b.ten, "tên văn phòng"),
    tangDau, tangCuoi, dxy, dz,
    // không gửi đa giác = dùng nguyên footprint toà nhà
    daGiac: b.da_giac_nen ? daGiac(b.da_giac_nen, "Đa giác nền khối MAP") : null,
    hieuLuc: b.dang_hieu_luc === undefined ? true : Boolean(b.dang_hieu_luc),
  };
}

// Đa giác khối phải chạm vào toà nhà — chặn trường hợp vẽ nhầm sang phố bên cạnh.
async function kiemTraDaGiacTrongToaNha(client, maToaNha, daGiacJson) {
  if (!daGiacJson) return;
  const r = await client.query(
    `SELECT ST_Intersects(tn.footprint, ${SQL_POLYGON("$2")}) AS cham
       FROM toa_nha tn WHERE tn.ma_toa_nha = $1`,
    [maToaNha, daGiacJson]
  );
  if (!r.rows.length) throw loi(400, "Toà nhà không tồn tại");
  if (!r.rows[0].cham) throw loi(400, "Đa giác khối MAP nằm ngoài toà nhà đã chọn");
}

router.post("/quan-tri/van-phong", laQuanTri, async (req, res) => {
  const v = thamSoVanPhong(req.body || {});
  const client = await pool.connect();
  let ketQua;
  try {
    await client.query("BEGIN");
    await kiemTraDaGiacTrongToaNha(client, v.ma_toa_nha, v.daGiac);
    const vp = await client.query(
      `INSERT INTO van_phong (ma_cong_ty, ma_toa_nha, ten, tang_bat_dau, tang_ket_thuc)
       VALUES ($1, $2, $3, $4, $5) RETURNING ma_van_phong`,
      [v.ma_cong_ty, v.ma_toa_nha, v.ten, v.tangDau, v.tangCuoi]
    );
    const maVP = vp.rows[0].ma_van_phong;
    const kv = await client.query(
      `INSERT INTO khu_vuc_cham_cong (ma_van_phong, da_giac_nen, z_min, z_max,
                                      dung_sai_ngang, dung_sai_dung, dang_hieu_luc)
       SELECT $1, COALESCE(${SQL_POLYGON("$2::text")}, tn.footprint), NULL, NULL, $3, $4, $5
         FROM toa_nha tn WHERE tn.ma_toa_nha = $6
       RETURNING ma_khu_vuc, z_min, z_max`,
      [maVP, v.daGiac, v.dxy, v.dz, v.hieuLuc, v.ma_toa_nha]
    );
    await client.query("COMMIT");
    ketQua = { ma_van_phong: maVP, ...kv.rows[0] };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  res.status(201).json(ketQua);
});

router.put("/quan-tri/van-phong/:id", laQuanTri, async (req, res) => {
  const id = soNguyenDuong(req.params.id, "Mã văn phòng");
  const v = thamSoVanPhong(req.body || {});
  const client = await pool.connect();
  let ketQua;
  try {
    await client.query("BEGIN");
    await kiemTraDaGiacTrongToaNha(client, v.ma_toa_nha, v.daGiac);
    const vp = await client.query(
      `UPDATE van_phong SET ma_cong_ty = $1, ma_toa_nha = $2, ten = $3,
              tang_bat_dau = $4, tang_ket_thuc = $5
        WHERE ma_van_phong = $6 RETURNING ma_van_phong`,
      [v.ma_cong_ty, v.ma_toa_nha, v.ten, v.tangDau, v.tangCuoi, id]
    );
    if (!vp.rows.length) throw loi(404, "Không tìm thấy văn phòng");
    // z_min / z_max đặt NULL để trigger suy lại theo dải tầng mới
    const kv = await client.query(
      `UPDATE khu_vuc_cham_cong kv
          SET da_giac_nen = COALESCE(${SQL_POLYGON("$2::text")}, tn.footprint),
              dung_sai_ngang = $3, dung_sai_dung = $4, dang_hieu_luc = $5,
              z_min = NULL, z_max = NULL
         FROM toa_nha tn
        WHERE kv.ma_van_phong = $1 AND tn.ma_toa_nha = $6
        RETURNING kv.ma_khu_vuc, kv.z_min, kv.z_max`,
      [id, v.daGiac, v.dxy, v.dz, v.hieuLuc, v.ma_toa_nha]
    );
    await client.query("COMMIT");
    ketQua = { ma_van_phong: id, ...kv.rows[0] };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  res.json(ketQua);
});

router.delete("/quan-tri/van-phong/:id", laQuanTri, async (req, res) => {
  const { rowCount } = await q(`DELETE FROM van_phong WHERE ma_van_phong = $1`,
    [soNguyenDuong(req.params.id, "Mã văn phòng")]);
  if (!rowCount) throw loi(404, "Không tìm thấy văn phòng");
  res.json({ da_xoa: true });
});

/* ================================================================== *
 * 5. NHÂN VIÊN + TÀI KHOẢN
 * ================================================================== */
router.get("/quan-tri/nhan-vien", laQuanTri, async (_req, res) => {
  const { rows } = await q(
    `SELECT nv.ma_nhan_vien, nv.ho_ten, nv.email, nv.ngay_vao_lam, nv.dang_lam_viec,
            nv.ma_cong_ty, ct.ten_cong_ty, nv.ma_phong_ban, pb.ten_phong_ban,
            nd.ten_dang_nhap, vt.ten_vai_tro AS vai_tro,
            (SELECT count(*)::int FROM ban_ghi_cham_cong b WHERE b.ma_nhan_vien = nv.ma_nhan_vien)
              AS so_ban_ghi
       FROM nhan_vien nv
       JOIN cong_ty ct ON ct.ma_cong_ty = nv.ma_cong_ty
       LEFT JOIN phong_ban pb ON pb.ma_phong_ban = nv.ma_phong_ban
       LEFT JOIN nguoi_dung nd ON nd.ma_nhan_vien = nv.ma_nhan_vien
       LEFT JOIN vai_tro vt ON vt.ma_vai_tro = nd.ma_vai_tro
      ORDER BY nv.ma_nhan_vien`
  );
  res.json(rows);
});

function thamSoNhanVien(b) {
  const vaiTro = b.vai_tro || "NHAN_VIEN";
  if (!["NHAN_VIEN", "QUAN_LY", "QUAN_TRI"].includes(vaiTro)) {
    throw loi(400, "Vai trò không hợp lệ");
  }
  const tenDN = chuoiBatBuoc(b.ten_dang_nhap, "tên đăng nhập");
  if (!/^[a-z0-9._-]{3,60}$/i.test(tenDN)) {
    throw loi(400, "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm, gạch (3–60 ký tự)");
  }
  return {
    ho_ten: chuoiBatBuoc(b.ho_ten, "họ tên"),
    email: b.email ? String(b.email).trim() : null,
    ma_cong_ty: soNguyenDuong(b.ma_cong_ty, "Công ty"),
    ma_phong_ban: b.ma_phong_ban ? soNguyenDuong(b.ma_phong_ban, "Phòng ban") : null,
    dang_lam_viec: b.dang_lam_viec === undefined ? true : Boolean(b.dang_lam_viec),
    ten_dang_nhap: tenDN,
    vai_tro: vaiTro,
    mat_khau: b.mat_khau ? String(b.mat_khau) : "",
  };
}

// Phòng ban phải thuộc đúng công ty của nhân viên.
async function kiemTraPhongBan(client, n) {
  if (!n.ma_phong_ban) return;
  const r = await client.query(
    `SELECT 1 FROM phong_ban WHERE ma_phong_ban = $1 AND ma_cong_ty = $2`,
    [n.ma_phong_ban, n.ma_cong_ty]
  );
  if (!r.rows.length) throw loi(400, "Phòng ban không thuộc công ty đã chọn");
}

router.post("/quan-tri/nhan-vien", laQuanTri, async (req, res) => {
  const n = thamSoNhanVien(req.body || {});
  if (n.mat_khau.length < 6) throw loi(400, "Mật khẩu phải có ít nhất 6 ký tự");
  const client = await pool.connect();
  let maNV;
  try {
    await client.query("BEGIN");
    await kiemTraPhongBan(client, n);
    const nv = await client.query(
      `INSERT INTO nhan_vien (ma_cong_ty, ma_phong_ban, ho_ten, email, dang_lam_viec)
       VALUES ($1, $2, $3, $4, $5) RETURNING ma_nhan_vien`,
      [n.ma_cong_ty, n.ma_phong_ban, n.ho_ten, n.email, n.dang_lam_viec]
    );
    maNV = nv.rows[0].ma_nhan_vien;
    await client.query(
      `INSERT INTO nguoi_dung (ma_nhan_vien, ma_vai_tro, ten_dang_nhap, mat_khau_bam)
       SELECT $1, ma_vai_tro, $2, $3 FROM vai_tro WHERE ten_vai_tro = $4`,
      [maNV, n.ten_dang_nhap, bcrypt.hashSync(n.mat_khau, 10), n.vai_tro]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  res.status(201).json({ ma_nhan_vien: maNV });
});

router.put("/quan-tri/nhan-vien/:id", laQuanTri, async (req, res) => {
  const id = soNguyenDuong(req.params.id, "Mã nhân viên");
  const n = thamSoNhanVien(req.body || {});
  if (n.mat_khau && n.mat_khau.length < 6) throw loi(400, "Mật khẩu phải có ít nhất 6 ký tự");
  if (id === req.nguoiDung.ma_nhan_vien && (n.vai_tro !== "QUAN_TRI" || !n.dang_lam_viec)) {
    throw loi(400, "Không thể tự hạ quyền hoặc tự khoá tài khoản quản trị đang đăng nhập");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await kiemTraPhongBan(client, n);
    const nv = await client.query(
      `UPDATE nhan_vien SET ma_cong_ty = $1, ma_phong_ban = $2, ho_ten = $3, email = $4,
              dang_lam_viec = $5
        WHERE ma_nhan_vien = $6 RETURNING ma_nhan_vien`,
      [n.ma_cong_ty, n.ma_phong_ban, n.ho_ten, n.email, n.dang_lam_viec, id]
    );
    if (!nv.rows.length) throw loi(404, "Không tìm thấy nhân viên");
    // Có tài khoản thì sửa, chưa có thì tạo (bắt buộc kèm mật khẩu).
    const tk = await client.query(
      `UPDATE nguoi_dung
          SET ten_dang_nhap = $2,
              ma_vai_tro = (SELECT ma_vai_tro FROM vai_tro WHERE ten_vai_tro = $3),
              mat_khau_bam = COALESCE($4, mat_khau_bam)
        WHERE ma_nhan_vien = $1`,
      [id, n.ten_dang_nhap, n.vai_tro, n.mat_khau ? bcrypt.hashSync(n.mat_khau, 10) : null]
    );
    if (!tk.rowCount) {
      if (!n.mat_khau) throw loi(400, "Nhân viên chưa có tài khoản — cần nhập mật khẩu");
      await client.query(
        `INSERT INTO nguoi_dung (ma_nhan_vien, ma_vai_tro, ten_dang_nhap, mat_khau_bam)
         SELECT $1, ma_vai_tro, $2, $3 FROM vai_tro WHERE ten_vai_tro = $4`,
        [id, n.ten_dang_nhap, bcrypt.hashSync(n.mat_khau, 10), n.vai_tro]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  res.json({ ma_nhan_vien: id });
});

// Nhân viên đã có bản ghi chấm công thì không xoá cứng (mất lịch sử công) —
// CSDL sẽ chặn bằng khoá ngoại; giao diện gợi ý chuyển sang "nghỉ việc".
router.delete("/quan-tri/nhan-vien/:id", laQuanTri, async (req, res) => {
  const id = soNguyenDuong(req.params.id, "Mã nhân viên");
  if (id === req.nguoiDung.ma_nhan_vien) throw loi(400, "Không thể tự xoá tài khoản đang đăng nhập");
  const { rowCount } = await q(`DELETE FROM nhan_vien WHERE ma_nhan_vien = $1`, [id]);
  if (!rowCount) throw loi(404, "Không tìm thấy nhân viên");
  res.json({ da_xoa: true });
});

/* ================================================================== *
 * 6. CA LÀM VIỆC + PHÂN CA
 * ================================================================== */
router.get("/quan-tri/ca-lam-viec", laQuanTri, async (_req, res) => {
  const { rows } = await q(
    `SELECT c.ma_ca, c.ten_ca, to_char(c.gio_vao, 'HH24:MI') AS gio_vao,
            to_char(c.gio_ra, 'HH24:MI') AS gio_ra, c.tre_toi_da_phut,
            (SELECT count(*)::int FROM phan_ca p WHERE p.ma_ca = c.ma_ca
                AND p.ngay_lam_viec >= CURRENT_DATE) AS so_luot_sap_toi
       FROM ca_lam_viec c ORDER BY c.gio_vao`
  );
  res.json(rows);
});

function thamSoCa(b) {
  const gio = (v, ten) => {
    const s = chuoiBatBuoc(v, ten);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw loi(400, ten + " phải có dạng HH:MM");
    return s;
  };
  const tre = b.tre_toi_da_phut === undefined || b.tre_toi_da_phut === "" ? 15 : Number(b.tre_toi_da_phut);
  if (!Number.isInteger(tre) || tre < 0 || tre > 240) throw loi(400, "Số phút trễ tối đa phải từ 0 đến 240");
  return [chuoiBatBuoc(b.ten_ca, "tên ca"), gio(b.gio_vao, "Giờ vào"), gio(b.gio_ra, "Giờ ra"), tre];
}

router.post("/quan-tri/ca-lam-viec", laQuanTri, async (req, res) => {
  const { rows } = await q(
    `INSERT INTO ca_lam_viec (ten_ca, gio_vao, gio_ra, tre_toi_da_phut)
     VALUES ($1, $2, $3, $4) RETURNING ma_ca`,
    thamSoCa(req.body || {})
  );
  res.status(201).json(rows[0]);
});

router.put("/quan-tri/ca-lam-viec/:id", laQuanTri, async (req, res) => {
  const { rows } = await q(
    `UPDATE ca_lam_viec SET ten_ca = $1, gio_vao = $2, gio_ra = $3, tre_toi_da_phut = $4
      WHERE ma_ca = $5 RETURNING ma_ca`,
    thamSoCa(req.body || {}).concat([soNguyenDuong(req.params.id, "Mã ca")])
  );
  if (!rows.length) throw loi(404, "Không tìm thấy ca làm việc");
  res.json(rows[0]);
});

router.delete("/quan-tri/ca-lam-viec/:id", laQuanTri, async (req, res) => {
  const { rowCount } = await q(`DELETE FROM ca_lam_viec WHERE ma_ca = $1`,
    [soNguyenDuong(req.params.id, "Mã ca")]);
  if (!rowCount) throw loi(404, "Không tìm thấy ca làm việc");
  res.json({ da_xoa: true });
});

// Phân ca trong 7 ngày kể từ ngày chọn, mặc định hôm nay.
router.get("/quan-tri/phan-ca", laQuanTri, async (req, res) => {
  const tuNgay = /^\d{4}-\d{2}-\d{2}$/.test(req.query.tu_ngay || "") ? req.query.tu_ngay : null;
  const { rows } = await q(
    `SELECT p.ma_phan_ca, p.ngay_lam_viec::text AS ngay_lam_viec, p.ma_ca, c.ten_ca,
            p.ma_nhan_vien, nv.ho_ten
       FROM phan_ca p
       JOIN ca_lam_viec c ON c.ma_ca = p.ma_ca
       JOIN nhan_vien nv ON nv.ma_nhan_vien = p.ma_nhan_vien
      WHERE p.ngay_lam_viec BETWEEN COALESCE($1::date, CURRENT_DATE)
                                AND COALESCE($1::date, CURRENT_DATE) + 6
      ORDER BY p.ngay_lam_viec, nv.ho_ten`,
    [tuNgay]
  );
  res.json(rows);
});

// Gán một ca cho một nhân viên trong khoảng ngày; ngày đã có ca thì ghi đè.
router.post("/quan-tri/phan-ca", laQuanTri, async (req, res) => {
  const b = req.body || {};
  const ngay = (v, ten) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) throw loi(400, ten + " phải có dạng YYYY-MM-DD");
    return v;
  };
  const tu = ngay(b.tu_ngay, "Từ ngày");
  const den = ngay(b.den_ngay || b.tu_ngay, "Đến ngày");
  if (den < tu) throw loi(400, "Đến ngày phải sau từ ngày");
  const { rowCount } = await q(
    `INSERT INTO phan_ca (ma_nhan_vien, ma_ca, ngay_lam_viec)
     SELECT $1, $2, d::date FROM generate_series($3::date, $4::date, interval '1 day') d
      WHERE ($5 OR extract(isodow FROM d) < 6)
     ON CONFLICT (ma_nhan_vien, ngay_lam_viec) DO UPDATE SET ma_ca = EXCLUDED.ma_ca`,
    [soNguyenDuong(b.ma_nhan_vien, "Nhân viên"), soNguyenDuong(b.ma_ca, "Ca"),
     tu, den, Boolean(b.ca_cuoi_tuan)]
  );
  res.status(201).json({ so_ngay: rowCount });
});

router.delete("/quan-tri/phan-ca/:id", laQuanTri, async (req, res) => {
  const { rowCount } = await q(`DELETE FROM phan_ca WHERE ma_phan_ca = $1`,
    [soNguyenDuong(req.params.id, "Mã phân ca")]);
  if (!rowCount) throw loi(404, "Không tìm thấy phân ca");
  res.json({ da_xoa: true });
});

/* ================================================================== *
 * 7. THỐNG KÊ KHÔNG GIAN
 * ================================================================== */
router.get("/quan-tri/thong-ke", laQuanTri, async (_req, res) => {
  const [tong, theoKhoi] = await Promise.all([
    q(`SELECT (SELECT count(*)::int FROM toa_nha)            AS so_toa_nha,
              (SELECT count(*)::int FROM van_phong)          AS so_van_phong,
              (SELECT count(*)::int FROM khu_vuc_cham_cong WHERE dang_hieu_luc) AS so_khoi_hieu_luc,
              (SELECT count(*)::int FROM nhan_vien WHERE dang_lam_viec) AS so_nhan_vien,
              (SELECT count(*)::int FROM cong_ty)            AS so_cong_ty,
              (SELECT count(*)::int FROM ca_lam_viec)        AS so_ca,
              (SELECT round(sum(ST_Area(da_giac_nen::geography) * (z_max - z_min))::numeric, 0)
                 FROM khu_vuc_cham_cong WHERE dang_hieu_luc) AS tong_the_tich`),
    q(`SELECT vp.ten, tn.ten AS ten_toa_nha,
              count(b.*)::int AS tong,
              count(*) FILTER (WHERE b.trang_thai = 'HOP_LE')::int     AS hop_le,
              count(*) FILTER (WHERE b.trang_thai = 'NGHI_NGO')::int   AS nghi_ngo,
              count(*) FILTER (WHERE b.trang_thai = 'NGOAI_VUNG')::int AS ngoai_vung
         FROM khu_vuc_cham_cong kv
         JOIN van_phong vp ON vp.ma_van_phong = kv.ma_van_phong
         JOIN toa_nha tn ON tn.ma_toa_nha = vp.ma_toa_nha
         LEFT JOIN ban_ghi_cham_cong b ON b.ma_khu_vuc = kv.ma_khu_vuc
        GROUP BY vp.ma_van_phong, vp.ten, tn.ten, vp.tang_bat_dau
        ORDER BY tn.ten, vp.tang_bat_dau`),
  ]);
  res.json({ tong: tong.rows[0], theo_khoi: theoKhoi.rows });
});

module.exports = router;
