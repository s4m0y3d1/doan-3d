// Các chức năng của nhân viên: chấm công, xem lịch sử, gửi đơn giải trình.
const express = require("express");
const { q } = require("../db");
const { canDangNhap } = require("../auth");
const { taoCsv, guiCsv } = require("../csv");

const router = express.Router();

/* ------------------------------------------------------------------ *
 * Xuất lịch sử chấm công của chính mình ra CSV
 * ------------------------------------------------------------------ */
router.get("/cham-cong/lich-su.csv", canDangNhap, async (req, res) => {
  const { rows } = await q(
    `SELECT b.ma_ban_ghi, b.thoi_diem, b.loai, b.trang_thai,
            b.tang_khai_bao, b.nguon_cao_do,
            ST_X(b.vi_tri) AS kinh_do, ST_Y(b.vi_tri) AS vi_do, ST_Z(b.vi_tri) AS cao_do,
            b.do_chinh_xac_ngang,
            (SELECT count(*) FROM canh_bao_bat_thuong c WHERE c.ma_ban_ghi = b.ma_ban_ghi)
              AS so_canh_bao,
            (SELECT string_agg(c.ma_quy_tac, ' ' ORDER BY c.ma_quy_tac)
               FROM canh_bao_bat_thuong c WHERE c.ma_ban_ghi = b.ma_ban_ghi)
              AS cac_quy_tac,
            d.trang_thai AS trang_thai_don
       FROM ban_ghi_cham_cong b
       LEFT JOIN don_giai_trinh d ON d.ma_ban_ghi = b.ma_ban_ghi
      WHERE b.ma_nhan_vien = $1
      ORDER BY b.thoi_diem DESC`,
    [req.nguoiDung.ma_nhan_vien]
  );
  const csv = taoCsv([
    ["ma_ban_ghi", "Mã bản ghi"],
    ["thoi_diem", "Thời điểm"],
    ["loai", "Loại"],
    ["trang_thai", "Trạng thái"],
    ["tang_khai_bao", "Tầng khai báo"],
    ["cao_do", "Cao độ (m)"],
    ["nguon_cao_do", "Nguồn cao độ"],
    ["kinh_do", "Kinh độ"],
    ["vi_do", "Vĩ độ"],
    ["do_chinh_xac_ngang", "Độ chính xác ngang (m)"],
    ["so_canh_bao", "Số cảnh báo"],
    ["cac_quy_tac", "Quy tắc vi phạm"],
    ["trang_thai_don", "Đơn giải trình"],
  ], rows);
  guiCsv(res, "cham-cong-" + req.nguoiDung.ma_nhan_vien + ".csv", csv);
});

/* ------------------------------------------------------------------ *
 * Thông tin người đang đăng nhập + văn phòng + khối MAP của họ
 * ------------------------------------------------------------------ */
router.get("/toi", canDangNhap, async (req, res) => {
  // Nhân viên chưa có văn phòng (vừa được quản trị viên tạo) vẫn đăng nhập
  // được — các trường khối MAP khi đó là null.
  const { rows } = await q(
    `SELECT nv.ma_nhan_vien, nv.ho_ten, nv.email,
            pb.ten_phong_ban, ct.ten_cong_ty, k.*
       FROM nhan_vien nv
       JOIN cong_ty   ct ON ct.ma_cong_ty = nv.ma_cong_ty
       LEFT JOIN phong_ban pb ON pb.ma_phong_ban = nv.ma_phong_ban
       LEFT JOIN LATERAL (
         SELECT vp.ma_van_phong, vp.ten AS ten_van_phong,
                vp.tang_bat_dau, vp.tang_ket_thuc,
                tn.ma_toa_nha, tn.ten AS ten_toa_nha, tn.cao_do_nen, tn.so_tang, tn.chieu_cao_tang,
                kv.ma_khu_vuc, kv.z_min, kv.z_max,
                kv.dung_sai_ngang, kv.dung_sai_dung,
                ST_AsGeoJSON(kv.da_giac_nen) AS da_giac_nen,
                (SELECT count(*)::int FROM van_phong v2 JOIN khu_vuc_cham_cong k2
                    ON k2.ma_van_phong = v2.ma_van_phong AND k2.dang_hieu_luc
                  WHERE v2.ma_cong_ty = nv.ma_cong_ty) AS so_khoi_cua_cong_ty
           FROM van_phong vp
           JOIN toa_nha   tn ON tn.ma_toa_nha = vp.ma_toa_nha
           JOIN khu_vuc_cham_cong kv ON kv.ma_van_phong = vp.ma_van_phong AND kv.dang_hieu_luc
          WHERE vp.ma_cong_ty = nv.ma_cong_ty
          ORDER BY vp.ma_van_phong
          LIMIT 1
       ) k ON true
      WHERE nv.ma_nhan_vien = $1`,
    [req.nguoiDung.ma_nhan_vien]
  );
  if (!rows.length) return res.status(404).json({ loi: "Không tìm thấy nhân viên" });
  res.json({ ...rows[0], vai_tro: req.nguoiDung.vai_tro });
});

/* ------------------------------------------------------------------ *
 * Danh sách toà nhà để dựng mô hình 3D (LOD1 / LOD3)
 * ------------------------------------------------------------------ */
router.get("/toa-nha", canDangNhap, async (_req, res) => {
  const { rows } = await q(
    `SELECT tn.ma_toa_nha, tn.ten, tn.dia_chi, tn.cao_do_nen, tn.so_tang,
            tn.chieu_cao_tang, tn.so_tang_de, tn.nguon_du_lieu,
            ST_AsGeoJSON(tn.footprint) AS footprint
       FROM toa_nha tn ORDER BY tn.ma_toa_nha`
  );
  res.json(rows);
});

/* ------------------------------------------------------------------ *
 * Khối MAP trải ra theo mô hình SSM (BODY – FACE – NODE)
 * ------------------------------------------------------------------ */
router.get("/khu-vuc/:id/ssm", canDangNhap, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ loi: "Mã khu vực không hợp lệ" });
  const { rows } = await q(`SELECT * FROM ssm_cua_khoi($1) ORDER BY ma_face, thu_tu`, [id]);
  if (!rows.length) return res.status(404).json({ loi: "Không tìm thấy khối MAP" });
  const face = new Map();
  const node = new Map();
  for (const r of rows) {
    if (!face.has(r.ma_face)) face.set(r.ma_face, { ma_face: r.ma_face, loai: r.loai_face, node: [] });
    face.get(r.ma_face).node.push(r.ma_node);
    node.set(r.ma_node, [r.x, r.y, r.z]);
  }
  // Dung lượng theo cách tính của môn: mã 4 byte, toạ độ 8 byte.
  const soNode = node.size, soFace = face.size, soNodeOnFace = rows.length;
  res.json({
    ma_body: rows[0].ma_body,
    so_node: soNode,
    so_face: soFace,
    so_node_on_face: soNodeOnFace,
    dung_luong_byte: {
      NODE: soNode * (4 + 3 * 8),
      FACE: soFace * (4 + 4),
      NODE_ON_FACE: soNodeOnFace * (4 + 4 + 4),
      BODY: 4,
      tong: soNode * 28 + soFace * 8 + soNodeOnFace * 12 + 4,
    },
    face: Array.from(face.values()),
    node: Object.fromEntries(node),
  });
});

/* ------------------------------------------------------------------ *
 * Danh sách khối MAP để vẽ lên bản đồ 3D
 * ------------------------------------------------------------------ */
router.get("/khu-vuc", canDangNhap, async (_req, res) => {
  const { rows } = await q(
    `SELECT kv.ma_khu_vuc, kv.z_min, kv.z_max,
            kv.dung_sai_ngang, kv.dung_sai_dung,
            ST_AsGeoJSON(kv.da_giac_nen) AS da_giac_nen,
            vp.ten AS ten_van_phong, vp.tang_bat_dau, vp.tang_ket_thuc,
            ct.ten_cong_ty,
            tn.ten AS ten_toa_nha, tn.cao_do_nen, tn.so_tang, tn.chieu_cao_tang,
            ST_AsGeoJSON(tn.footprint) AS footprint_toa_nha
       FROM khu_vuc_cham_cong kv
       JOIN van_phong vp ON vp.ma_van_phong = kv.ma_van_phong
       JOIN cong_ty   ct ON ct.ma_cong_ty  = vp.ma_cong_ty
       JOIN toa_nha   tn ON tn.ma_toa_nha  = vp.ma_toa_nha
      WHERE kv.dang_hieu_luc
      ORDER BY kv.z_min`
  );
  res.json(rows);
});

/* ------------------------------------------------------------------ *
 * CHẤM CÔNG — trái tim của hệ thống
 *   1. Lấy khối MAP của văn phòng nhân viên
 *   2. Gọi hàm kiem_tra_bao_ham() trong PostGIS
 *   3. Áp bốn quy tắc phát hiện bất thường R1–R4
 *   4. Ghi bản ghi + cảnh báo trong một giao dịch
 * ------------------------------------------------------------------ */
router.post("/cham-cong", canDangNhap, async (req, res) => {
  const maNV = req.nguoiDung.ma_nhan_vien;
  const {
    loai, kinh_do, vi_do, cao_do,
    do_chinh_xac_ngang, do_chinh_xac_dung,
    tang_khai_bao, nguon_cao_do, dinh_danh_thiet_bi,
  } = req.body || {};

  if (!["VAO", "RA"].includes(loai)) {
    return res.status(400).json({ loi: "Loại chấm công phải là VAO hoặc RA" });
  }
  if (typeof kinh_do !== "number" || typeof vi_do !== "number") {
    return res.status(400).json({ loi: "Thiếu toạ độ" });
  }

  const client = await require("../db").pool.connect();
  try {
    await client.query("BEGIN");

    // --- các khối MAP của công ty nhân viên (một công ty có thể thuê nhiều văn phòng)
    const kv = await client.query(
      `SELECT kv.*, vp.tang_bat_dau, vp.ma_toa_nha, tn.cao_do_nen, tn.chieu_cao_tang
         FROM khu_vuc_cham_cong kv
         JOIN van_phong vp ON vp.ma_van_phong = kv.ma_van_phong
         JOIN nhan_vien nv ON nv.ma_cong_ty  = vp.ma_cong_ty
         JOIN toa_nha   tn ON tn.ma_toa_nha  = vp.ma_toa_nha
        WHERE nv.ma_nhan_vien = $1 AND kv.dang_hieu_luc
        ORDER BY ST_Distance(kv.da_giac_nen::geography,
                             ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography),
                 vp.ma_van_phong`,
      [maNV, Number(kinh_do), Number(vi_do)]
    );
    if (!kv.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ loi: "Nhân viên chưa được gán khu vực chấm công" });
    }
    // Khối gần nhất theo mặt bằng; nếu công ty có nhiều khối trong cùng toà nhà
    // thì sau khi biết cao độ sẽ chọn lại khối có dải cao độ gần nhất.
    let khoi = kv.rows[0];

    // --- cao độ: ưu tiên giá trị thiết bị đo được, nếu không thì suy từ tầng khai báo
    let z = Number(cao_do);
    let nguon = nguon_cao_do === "THIET_BI" ? "THIET_BI" : "KHAI_BAO";
    if (nguon === "KHAI_BAO" || cao_do === null || cao_do === undefined || !Number.isFinite(z)) {
      const tang = Number(tang_khai_bao || khoi.tang_bat_dau || 1);
      if (!Number.isFinite(tang)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ loi: "Tầng khai báo không hợp lệ" });
      }
      z = Number(khoi.cao_do_nen) + (tang - 0.5) * Number(khoi.chieu_cao_tang);
      nguon = "KHAI_BAO";
    }

    // Trong cùng toà nhà, ưu tiên khối có dải cao độ gần z nhất — công ty
    // thuê hai dải tầng xa nhau thì nhân viên ở dải nào cũng khớp đúng khối đó.
    const lechZ = (k) => (z < Number(k.z_min) ? Number(k.z_min) - z
      : z > Number(k.z_max) ? z - Number(k.z_max) : 0);
    const cungToaNha = kv.rows.filter((k) => k.ma_toa_nha === khoi.ma_toa_nha);
    cungToaNha.sort((a, b) => lechZ(a) - lechZ(b));
    khoi = cungToaNha[0];

    // --- thiết bị
    let maThietBi = null;
    if (dinh_danh_thiet_bi) {
      const tb = await client.query(
        `INSERT INTO thiet_bi (ma_nhan_vien, dinh_danh_thiet_bi, he_dieu_hanh)
              VALUES ($1, $2, $3)
         ON CONFLICT (ma_nhan_vien, dinh_danh_thiet_bi)
              DO UPDATE SET he_dieu_hanh = EXCLUDED.he_dieu_hanh
           RETURNING ma_thiet_bi`,
        [maNV, String(dinh_danh_thiet_bi).slice(0, 120),
         String(req.headers["user-agent"] || "").slice(0, 50)]
      );
      maThietBi = tb.rows[0].ma_thiet_bi;
    }

    const diem = `ST_SetSRID(ST_MakePoint(${Number(kinh_do)}, ${Number(vi_do)}, ${Number(z)}), 4326)`;

    // --- (2) kiểm tra bao hàm khối, dùng chính hàm PL/pgSQL đã viết
    const kq = await client.query(
      `SELECT kiem_tra_bao_ham($1, ${diem}, $2) AS trang_thai,
              ST_Distance(kv.da_giac_nen::geography, ST_SetSRID(ST_MakePoint($3,$4),4326)::geography)
                AS khoang_cach
         FROM khu_vuc_cham_cong kv WHERE kv.ma_khu_vuc = $1`,
      [khoi.ma_khu_vuc, do_chinh_xac_ngang ?? null, Number(kinh_do), Number(vi_do)]
    );
    const trangThai = kq.rows[0].trang_thai;
    const khoangCach = Number(kq.rows[0].khoang_cach);

    // --- (3) quy tắc R2: dịch chuyển bất khả thi (hàm trong CSDL)
    const r2 = await client.query(`SELECT kiem_tra_r2($1, ${diem}, now()) AS bat_thuong`, [maNV]);

    // --- ghi bản ghi
    const bg = await client.query(
      `INSERT INTO ban_ghi_cham_cong
         (ma_nhan_vien, ma_khu_vuc, ma_thiet_bi, loai, vi_tri,
          do_chinh_xac_ngang, do_chinh_xac_dung, nguon_cao_do, tang_khai_bao, trang_thai)
       VALUES ($1,$2,$3,$4, ${diem}, $5,$6,$7,$8,$9)
       RETURNING ma_ban_ghi, thoi_diem`,
      [maNV, khoi.ma_khu_vuc, maThietBi, loai,
       do_chinh_xac_ngang ?? null, do_chinh_xac_dung ?? null,
       nguon, tang_khai_bao ?? null, trangThai]
    );
    const maBanGhi = bg.rows[0].ma_ban_ghi;

    // --- (4) sinh cảnh báo
    const canhBao = [];
    const lechCaoDo =
      z < Number(khoi.z_min) ? z - Number(khoi.z_min)
      : z > Number(khoi.z_max) ? z - Number(khoi.z_max) : 0;

    if (trangThai === "NGHI_NGO" && lechCaoDo !== 0) {
      const soTang = Math.abs(lechCaoDo / Number(khoi.chieu_cao_tang)).toFixed(1);
      canhBao.push(["R1", "CAO",
        `Sai tầng: lệch ${lechCaoDo.toFixed(2)} m so với dải khối, tương đương ${soTang} tầng`]);
    }
    if (r2.rows[0].bat_thuong) {
      canhBao.push(["R2", "CAO",
        "Dịch chuyển bất khả thi so với lần chấm công liền trước"]);
    }
    const dcx = Number(do_chinh_xac_ngang);
    if (!Number.isNaN(dcx)) {
      if (dcx > 0 && dcx < 1) {
        canhBao.push(["R3", "TRUNG_BINH",
          `Độ chính xác báo về ${dcx} m — nhỏ bất thường với môi trường đô thị, nghi giả lập vị trí`]);
      } else if (dcx > 100) {
        canhBao.push(["R3", "TRUNG_BINH",
          `Độ chính xác ${dcx} m quá lớn, không đủ tin cậy để kết luận`]);
      }
    }
    if (maThietBi) {
      const trung = await client.query(
        `SELECT count(DISTINCT b.ma_nhan_vien) AS n
           FROM ban_ghi_cham_cong b
           JOIN thiet_bi t ON t.ma_thiet_bi = b.ma_thiet_bi
          WHERE t.dinh_danh_thiet_bi = $1
            AND b.ma_nhan_vien <> $2
            AND b.thoi_diem > now() - interval '10 minutes'`,
        [String(dinh_danh_thiet_bi), maNV]
      );
      if (Number(trung.rows[0].n) > 0) {
        canhBao.push(["R4", "TRUNG_BINH",
          `Thiết bị này vừa được ${trung.rows[0].n} nhân viên khác dùng để chấm công`]);
      }
    }

    for (const [maQT, mucDo, moTa] of canhBao) {
      await client.query(
        `INSERT INTO canh_bao_bat_thuong (ma_ban_ghi, ma_quy_tac, muc_do, mo_ta)
         VALUES ($1,$2,$3,$4)`,
        [maBanGhi, maQT, mucDo, moTa]
      );
    }

    await client.query("COMMIT");
    res.json({
      ma_ban_ghi: maBanGhi,
      thoi_diem: bg.rows[0].thoi_diem,
      trang_thai: trangThai,
      khoang_cach_ngang: Math.round(khoangCach * 10) / 10,
      cao_do: Math.round(z * 100) / 100,
      nguon_cao_do: nguon,
      lech_cao_do: Math.round(lechCaoDo * 100) / 100,
      dai_khoi: { z_min: Number(khoi.z_min), z_max: Number(khoi.z_max) },
      dung_sai: { ngang: Number(khoi.dung_sai_ngang), dung: Number(khoi.dung_sai_dung) },
      canh_bao: canhBao.map(([ma, muc, mo]) => ({ ma_quy_tac: ma, muc_do: muc, mo_ta: mo })),
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[cham-cong]", e);
    res.status(500).json({ loi: e.message });
  } finally {
    client.release();
  }
});

/* ------------------------------------------------------------------ *
 * Lịch sử chấm công của chính mình
 * ------------------------------------------------------------------ */
router.get("/cham-cong/lich-su", canDangNhap, async (req, res) => {
  const { rows } = await q(
    `SELECT b.ma_ban_ghi, b.thoi_diem, b.loai, b.trang_thai,
            b.tang_khai_bao, b.nguon_cao_do,
            ST_X(b.vi_tri) AS kinh_do, ST_Y(b.vi_tri) AS vi_do, ST_Z(b.vi_tri) AS cao_do,
            b.do_chinh_xac_ngang,
            (SELECT count(*) FROM canh_bao_bat_thuong c WHERE c.ma_ban_ghi = b.ma_ban_ghi)
              AS so_canh_bao,
            d.trang_thai AS trang_thai_don
       FROM ban_ghi_cham_cong b
       LEFT JOIN don_giai_trinh d ON d.ma_ban_ghi = b.ma_ban_ghi
      WHERE b.ma_nhan_vien = $1
      ORDER BY b.thoi_diem DESC
      LIMIT 100`,
    [req.nguoiDung.ma_nhan_vien]
  );
  res.json(rows);
});

/* ------------------------------------------------------------------ *
 * Gửi đơn giải trình cho một bản ghi bị từ chối hoặc nghi ngờ
 * ------------------------------------------------------------------ */
router.post("/giai-trinh", canDangNhap, async (req, res) => {
  const { ma_ban_ghi, ly_do } = req.body || {};
  if (!ma_ban_ghi || !ly_do) {
    return res.status(400).json({ loi: "Thiếu mã bản ghi hoặc lý do" });
  }
  const own = await q(
    `SELECT 1 FROM ban_ghi_cham_cong WHERE ma_ban_ghi = $1 AND ma_nhan_vien = $2`,
    [ma_ban_ghi, req.nguoiDung.ma_nhan_vien]
  );
  if (!own.rows.length) {
    return res.status(403).json({ loi: "Bản ghi không thuộc về bạn" });
  }
  try {
    const { rows } = await q(
      `INSERT INTO don_giai_trinh (ma_nhan_vien, ma_ban_ghi, ly_do)
       VALUES ($1,$2,$3) RETURNING ma_don, trang_thai, thoi_diem_gui`,
      [req.nguoiDung.ma_nhan_vien, ma_ban_ghi, String(ly_do).slice(0, 1000)]
    );
    res.json(rows[0]);
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ loi: "Bản ghi này đã có đơn giải trình" });
    }
    throw e;
  }
});

module.exports = router;
