// Máy chủ hệ thống chấm công định vị 3D — đồ án IE402, nhóm 1.
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const { q } = require("./db");
const { taoToken, canDangNhap } = require("./auth");

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------- Đăng nhập ---------------- */
app.post("/api/dang-nhap", async (req, res) => {
  const { ten_dang_nhap, mat_khau } = req.body || {};
  if (!ten_dang_nhap || !mat_khau) {
    return res.status(400).json({ loi: "Thiếu tên đăng nhập hoặc mật khẩu" });
  }
  const { rows } = await q(
    `SELECT nd.ma_nguoi_dung, nd.ma_nhan_vien, nd.ten_dang_nhap, nd.mat_khau_bam,
            vt.ten_vai_tro, nv.ho_ten
       FROM nguoi_dung nd
       JOIN vai_tro   vt ON vt.ma_vai_tro   = nd.ma_vai_tro
       JOIN nhan_vien nv ON nv.ma_nhan_vien = nd.ma_nhan_vien
      WHERE nd.ten_dang_nhap = $1 AND nv.dang_lam_viec`,
    [ten_dang_nhap]
  );
  const u = rows[0];
  if (!u || !bcrypt.compareSync(mat_khau, u.mat_khau_bam)) {
    return res.status(401).json({ loi: "Sai tên đăng nhập hoặc mật khẩu" });
  }
  res.json({
    token: taoToken(u),
    nguoi_dung: {
      ma_nhan_vien: u.ma_nhan_vien,
      ten_dang_nhap: u.ten_dang_nhap,
      ho_ten: u.ho_ten,
      vai_tro: u.ten_vai_tro,
    },
  });
});

app.get("/api/kiem-tra-phien", canDangNhap, (req, res) => res.json(req.nguoiDung));

/* ---------------- Các nhóm chức năng ---------------- */
app.use("/api", require("./routes/chamcong"));
app.use("/api", require("./routes/quanly"));
app.use("/api", require("./routes/quantri"));

/* ---------------- Giao diện web ---------------- */
app.use(express.static(path.join(__dirname, "..", "..", "web")));

app.get("/healthz", async (_req, res) => {
  try {
    const r = await q("SELECT postgis_version() AS postgis, now() AS bay_gio");
    res.json({ trang_thai: "ok", ...r.rows[0] });
  } catch (e) {
    res.status(500).json({ trang_thai: "loi", loi: e.message });
  }
});

/* ---------------- Bắt lỗi chung ----------------
   Lỗi ràng buộc của PostgreSQL là lỗi dữ liệu nhập, không phải lỗi máy chủ:
   đổi sang mã HTTP và câu thông báo dễ hiểu cho người dùng. */
const LOI_CSDL = {
  "23503": [409, "Không thực hiện được vì dữ liệu này đang được dữ liệu khác tham chiếu " +
                 "(ví dụ: toà nhà còn văn phòng, nhân viên đã có bản ghi chấm công)"],
  "23505": [409, "Giá trị bị trùng với dữ liệu đã có (tên đăng nhập, email, mã số thuế…)"],
  "23514": [400, "Dữ liệu vi phạm ràng buộc kiểm tra của CSDL"],
  "22P02": [400, "Dữ liệu nhập sai định dạng"],
  P0001: [400, null], // RAISE EXCEPTION trong trigger: giữ nguyên câu thông báo
};
app.use((err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ loi: err.message });
  const ma = LOI_CSDL[err.code];
  if (ma) {
    return res.status(ma[0]).json({ loi: ma[1] || err.message, chi_tiet: err.detail || undefined });
  }
  if (err.type === "entity.parse.failed") return res.status(400).json({ loi: "JSON không hợp lệ" });
  console.error("[loi]", err);
  res.status(500).json({ loi: err.message || "Lỗi máy chủ" });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Máy chủ chấm công 3D đang chạy: http://127.0.0.1:${PORT}`);
});
