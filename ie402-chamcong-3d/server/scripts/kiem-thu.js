// Kiểm thử đầu-cuối qua API: chạy khi máy chủ đang bật.
//   npm test                    -> kiểm thử http://127.0.0.1:3000
//   BASE=http://host:port npm test
// Tự dọn dữ liệu thử nghiệm do chính nó tạo ra (công ty, toà nhà, nhân viên…).
const BASE = process.env.BASE || "http://127.0.0.1:" + (process.env.PORT || 3000);

let dat = 0, truot = 0;
function kiem(dieuKien, moTa, chiTiet) {
  if (dieuKien) { dat++; console.log("  ✔ " + moTa); }
  else { truot++; console.log("  ✘ " + moTa + (chiTiet ? "  ->  " + JSON.stringify(chiTiet) : "")); }
}

async function goi(duong, { method = "GET", body, token } = {}) {
  const res = await fetch(BASE + duong, {
    method,
    headers: Object.assign({ "Content-Type": "application/json" },
      token ? { Authorization: "Bearer " + token } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch (_e) { /* CSV hoặc rỗng */ }
  return { status: res.status, data };
}

async function dangNhap(ten) {
  const r = await goi("/api/dang-nhap", { method: "POST", body: { ten_dang_nhap: ten, mat_khau: "123456" } });
  if (r.status !== 200) throw new Error("Không đăng nhập được " + ten + ": " + JSON.stringify(r.data));
  return r.data.token;
}

// Tâm toà nhà IFC One Saigon trong dữ liệu mẫu
const TAM = { kinh_do: 106.70553, vi_do: 10.77012 };
// Hình vuông nhỏ khoảng 30 m x 30 m, cách IFC One Saigon ~1 km
const VUONG = {
  type: "Polygon",
  coordinates: [[[106.7000, 10.7800], [106.7003, 10.7800], [106.7003, 10.7803],
                 [106.7000, 10.7803], [106.7000, 10.7800]]],
};

(async () => {
  const sk = Date.now().toString(36);
  console.log("Kiểm thử " + BASE);

  console.log("\n[1] Sức khoẻ");
  const h = await goi("/healthz");
  kiem(h.status === 200 && h.data.trang_thai === "ok", "CSDL + PostGIS sẵn sàng", h.data);

  const tkAn = await dangNhap("khoi.nm");
  const tkBinh = await dangNhap("nhan.vt");
  const tkDung = await dangNhap("tin.nh");

  console.log("\n[2] Chấm công — ba tình huống của mô hình MAP");
  const cc = (tang, dx = 0) => goi("/api/cham-cong", {
    method: "POST", token: tkAn,
    body: { loai: "VAO", kinh_do: TAM.kinh_do + dx, vi_do: TAM.vi_do,
            tang_khai_bao: tang, do_chinh_xac_ngang: 8, dinh_danh_thiet_bi: "kiem-thu-" + sk },
  });
  let r = await cc(6);
  kiem(r.data && r.data.trang_thai === "HOP_LE", "Tầng 6 (trong dải 5–8) -> HOP_LE", r.data);
  r = await cc(22);
  kiem(r.data && r.data.trang_thai === "NGHI_NGO", "Tầng 22 -> NGHI_NGO (đúng toà nhà, sai tầng)", r.data);
  kiem(r.data && r.data.canh_bao.some((c) => c.ma_quy_tac === "R1"), "Sinh cảnh báo R1 sai tầng");
  r = await cc(6, 0.00277);
  kiem(r.data && r.data.trang_thai === "NGOAI_VUNG", "Cách toà nhà ~300 m -> NGOAI_VUNG", r.data);

  console.log("\n[3] Phân quyền");
  r = await goi("/api/quan-tri/toa-nha", { token: tkAn });
  kiem(r.status === 403, "Nhân viên không vào được API quản trị");
  r = await goi("/api/quan-tri/toa-nha", { token: tkBinh });
  kiem(r.status === 403, "Quản lý không vào được API quản trị");
  r = await goi("/api/canh-bao", { token: tkBinh });
  kiem(r.status === 200, "Quản lý xem được cảnh báo");

  console.log("\n[4] Quản trị — thêm / sửa / xoá");
  const ct = await goi("/api/quan-tri/cong-ty", {
    method: "POST", token: tkDung, body: { ten_cong_ty: "Công ty thử nghiệm " + sk } });
  kiem(ct.status === 201, "Thêm công ty", ct.data);
  const maCT = ct.data && ct.data.ma_cong_ty;

  const pb = await goi("/api/quan-tri/phong-ban", {
    method: "POST", token: tkDung, body: { ma_cong_ty: maCT, ten_phong_ban: "Phòng thử" } });
  kiem(pb.status === 201, "Thêm phòng ban", pb.data);

  const tn = await goi("/api/quan-tri/toa-nha", {
    method: "POST", token: tkDung,
    body: { ten: "Toà nhà thử " + sk, footprint: VUONG, cao_do_nen: 3, so_tang: 10,
            chieu_cao_tang: 4, so_tang_de: 2 } });
  kiem(tn.status === 201, "Thêm toà nhà từ đa giác vẽ trên bản đồ", tn.data);
  const maTN = tn.data && tn.data.ma_toa_nha;

  r = await goi("/api/quan-tri/van-phong", {
    method: "POST", token: tkDung,
    body: { ma_cong_ty: maCT, ma_toa_nha: maTN, ten: "VP vượt tầng", tang_bat_dau: 8, tang_ket_thuc: 12 } });
  kiem(r.status === 400 && /10 tầng/.test(r.data.loi), "Chặn văn phòng vượt quá số tầng toà nhà", r.data);

  r = await goi("/api/quan-tri/van-phong", {
    method: "POST", token: tkDung,
    body: { ma_cong_ty: maCT, ma_toa_nha: maTN, ten: "VP lệch chỗ", tang_bat_dau: 1, tang_ket_thuc: 2,
            da_giac_nen: { type: "Polygon", coordinates: [[[106.71, 10.79], [106.7103, 10.79],
              [106.7103, 10.7903], [106.71, 10.79]]] } } });
  kiem(r.status === 400, "Chặn khối MAP vẽ ra ngoài toà nhà", r.data);

  const vp = await goi("/api/quan-tri/van-phong", {
    method: "POST", token: tkDung,
    body: { ma_cong_ty: maCT, ma_toa_nha: maTN, ten: "VP thử", tang_bat_dau: 3, tang_ket_thuc: 5,
            dung_sai_ngang: 20, dung_sai_dung: 4 } });
  kiem(vp.status === 201 && Number(vp.data.z_min) === 11 && Number(vp.data.z_max) === 23,
    "Thêm văn phòng: trigger suy z = 11 → 23 m", vp.data);
  const maVP = vp.data && vp.data.ma_van_phong;

  r = await goi("/api/quan-tri/van-phong/" + maVP, {
    method: "PUT", token: tkDung,
    body: { ma_cong_ty: maCT, ma_toa_nha: maTN, ten: "VP thử", tang_bat_dau: 6, tang_ket_thuc: 7,
            dung_sai_ngang: 20, dung_sai_dung: 4 } });
  kiem(r.status === 200 && Number(r.data.z_min) === 23 && Number(r.data.z_max) === 31,
    "Sửa dải tầng 6–7: khối tự tính lại 23 → 31 m", r.data);

  r = await goi("/api/quan-tri/toa-nha/" + maTN, {
    method: "PUT", token: tkDung,
    body: { ten: "Toà nhà thử " + sk, footprint: VUONG, cao_do_nen: 3, so_tang: 10,
            chieu_cao_tang: 5, so_tang_de: 2 } });
  const ds = await goi("/api/quan-tri/van-phong", { token: tkDung });
  const vpSau = ds.data.find((x) => x.ma_van_phong === maVP);
  kiem(r.status === 200 && vpSau && Number(vpSau.z_min) === 28 && Number(vpSau.z_max) === 38,
    "Sửa chiều cao tầng toà nhà 4 → 5 m: khối bên trong tính lại 28 → 38 m", vpSau);

  const ssm = await goi("/api/khu-vuc/" + vpSau.ma_khu_vuc + "/ssm", { token: tkDung });
  kiem(ssm.status === 200 && ssm.data.so_node === 8 && ssm.data.so_face === 6 &&
       ssm.data.so_node_on_face === 24,
    "Khối hình hộp trải theo SSM: 8 NODE, 6 FACE, 24 NODE-ON-FACE", ssm.data && ssm.data.dung_luong_byte);

  const nv = await goi("/api/quan-tri/nhan-vien", {
    method: "POST", token: tkDung,
    body: { ho_ten: "Nhân viên thử", ma_cong_ty: maCT, ma_phong_ban: pb.data.ma_phong_ban,
            ten_dang_nhap: "thu." + sk, mat_khau: "matkhau1", vai_tro: "NHAN_VIEN" } });
  kiem(nv.status === 201, "Thêm nhân viên kèm tài khoản", nv.data);
  const maNV = nv.data && nv.data.ma_nhan_vien;

  r = await goi("/api/dang-nhap", { method: "POST", body: { ten_dang_nhap: "thu." + sk, mat_khau: "matkhau1" } });
  kiem(r.status === 200, "Nhân viên mới đăng nhập được");
  const tkMoi = r.data && r.data.token;
  r = await goi("/api/cham-cong", {
    method: "POST", token: tkMoi,
    body: { loai: "VAO", kinh_do: 106.70015, vi_do: 10.78015, tang_khai_bao: 6, do_chinh_xac_ngang: 8 } });
  kiem(r.data && r.data.trang_thai === "HOP_LE", "Nhân viên mới chấm công trong khối vừa dựng -> HOP_LE", r.data);

  r = await goi("/api/quan-tri/nhan-vien", {
    method: "POST", token: tkDung,
    body: { ho_ten: "Trùng", ma_cong_ty: maCT, ten_dang_nhap: "khoi.nm", mat_khau: "matkhau1" } });
  kiem(r.status === 409, "Chặn trùng tên đăng nhập", r.data);

  r = await goi("/api/quan-tri/nhan-vien/" + maNV, { method: "DELETE", token: tkDung });
  kiem(r.status === 409, "Không xoá cứng nhân viên đã có bản ghi chấm công", r.data);

  r = await goi("/api/quan-tri/nhan-vien/" + maNV, {
    method: "PUT", token: tkDung,
    body: { ho_ten: "Nhân viên thử", ma_cong_ty: maCT, ten_dang_nhap: "thu." + sk,
            vai_tro: "NHAN_VIEN", dang_lam_viec: false } });
  kiem(r.status === 200, "Chuyển nhân viên sang nghỉ việc");
  r = await goi("/api/dang-nhap", { method: "POST", body: { ten_dang_nhap: "thu." + sk, mat_khau: "matkhau1" } });
  kiem(r.status === 401, "Nhân viên nghỉ việc không đăng nhập được");

  r = await goi("/api/quan-tri/toa-nha/" + maTN, { method: "DELETE", token: tkDung });
  kiem(r.status === 409, "Không xoá được toà nhà còn văn phòng", r.data);

  const ca = await goi("/api/quan-tri/ca-lam-viec", {
    method: "POST", token: tkDung, body: { ten_ca: "Ca thử", gio_vao: "07:00", gio_ra: "16:00" } });
  kiem(ca.status === 201, "Thêm ca làm việc", ca.data);
  r = await goi("/api/quan-tri/ca-lam-viec", {
    method: "POST", token: tkDung, body: { ten_ca: "Ca sai", gio_vao: "25:00", gio_ra: "16:00" } });
  kiem(r.status === 400, "Chặn giờ sai định dạng");

  r = await goi("/api/quan-tri/thong-ke", { token: tkDung });
  kiem(r.status === 200 && r.data.tong.so_toa_nha >= 2, "Thống kê tổng hợp", r.data && r.data.tong);

  console.log("\n[5] Dọn dữ liệu thử nghiệm");
  const { Pool } = require("pg");
  require("dotenv").config();
  const pool = new Pool({
    host: process.env.PGHOST || "127.0.0.1", port: Number(process.env.PGPORT || 55432),
    user: process.env.PGUSER || "postgres", password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "chamcong3d",
  });
  await pool.query(`DELETE FROM ban_ghi_cham_cong WHERE ma_nhan_vien = $1`, [maNV]);
  await pool.query(`DELETE FROM ban_ghi_cham_cong b USING thiet_bi t
                     WHERE b.ma_thiet_bi = t.ma_thiet_bi AND t.dinh_danh_thiet_bi = $1`, ["kiem-thu-" + sk]);
  await pool.query(`DELETE FROM thiet_bi WHERE dinh_danh_thiet_bi = $1`, ["kiem-thu-" + sk]);
  await pool.end();
  for (const [duong, id] of [["nhan-vien", maNV], ["van-phong", maVP], ["toa-nha", maTN],
                             ["ca-lam-viec", ca.data && ca.data.ma_ca],
                             ["phong-ban", pb.data && pb.data.ma_phong_ban], ["cong-ty", maCT]]) {
    r = await goi("/api/quan-tri/" + duong + "/" + id, { method: "DELETE", token: tkDung });
    kiem(r.status === 200, "Xoá " + duong + " #" + id, r.data);
  }

  console.log("\nKết quả: " + dat + " đạt, " + truot + " trượt");
  process.exit(truot ? 1 : 0);
})().catch((e) => {
  console.error("\nKiểm thử dừng vì lỗi:", e.message);
  console.error("Máy chủ đã bật chưa? (npm start)");
  process.exit(2);
});
