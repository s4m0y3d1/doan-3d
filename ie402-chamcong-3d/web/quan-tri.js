/* ===================================================================
   Tab QUẢN TRỊ — thêm / sửa / xoá dữ liệu nền và thống kê
   Đồ án IE402, nhóm 1

   - Toà nhà: vẽ footprint trên bản đồ 3D, nhập cao độ nền / số tầng /
     chiều cao tầng -> xem trước ngay mô hình LOD3.
   - Văn phòng & khối MAP: chọn toà nhà + dải tầng (+ vẽ đa giác riêng nếu
     văn phòng chỉ chiếm một phần mặt sàn) -> xem trước khối (P, z_min, z_max).
   - Nhân viên, ca làm việc + phân ca, công ty, phòng ban.
   Dùng chung các hàm api(), esc(), $() và MoHinh3D từ app.js / mo-hinh-3d.js.
   =================================================================== */
(function () {
  var st = {
    muc: "thong-ke",
    ds: {},            // dữ liệu từng mục: ds["toa-nha"] = [...]
    dangSua: null,     // dòng đang sửa (null = thêm mới)
    hinh: null,        // đa giác GeoJSON đang nhập trong biểu mẫu
    daMo: false,
  };
  var qv = null, lop1, lop3, lopKhoi, lopVe, lopXemTruoc, sketch, wmu;

  /* ---------------- cấu hình từng loại dữ liệu ---------------- */
  function luaChon(muc, khoa, nhan) {
    return function () {
      return (st.ds[muc] || []).map(function (r) { return [r[khoa], nhan(r)]; });
    };
  }

  var CH = {
    "toa-nha": {
      tieuDe: "Toà nhà", khoa: "ma_toa_nha", ten: function (r) { return r.ten; },
      cot: [
        ["Tên", function (r) { return "<b>" + esc(r.ten) + "</b><br/><small>" + esc(r.dia_chi || "") + "</small>"; }],
        ["Tầng", function (r) { return r.so_tang + " × " + Number(r.chieu_cao_tang).toFixed(2) + " m"; }],
        ["Nền", function (r) { return Math.round(r.dien_tich_nen) + " m²"; }],
        ["VP", function (r) { return r.so_van_phong; }],
      ],
      truong: [
        { k: "ten", n: "Tên toà nhà", bat: true, rong: true },
        { k: "dia_chi", n: "Địa chỉ", rong: true },
        { k: "cao_do_nen", n: "Cao độ nền (m)", kieu: "number", buoc: 0.01, mac: 5, bat: true },
        { k: "so_tang", n: "Số tầng", kieu: "number", mac: 20, bat: true },
        { k: "chieu_cao_tang", n: "Chiều cao tầng (m)", kieu: "number", buoc: 0.01, mac: 3.6, bat: true },
        { k: "so_tang_de", n: "Số tầng khối đế", kieu: "number", mac: 3, goiY: "dùng khi dựng LOD3" },
        { k: "nguon_du_lieu", n: "Nguồn dữ liệu", goiY: "ví dụ: OSM way/306578560", rong: true },
      ],
      hinh: { k: "footprint", nhan: "Footprint (mặt bằng toà nhà)", batBuoc: true },
    },
    "van-phong": {
      tieuDe: "Văn phòng & khối MAP", khoa: "ma_van_phong", ten: function (r) { return r.ten; },
      cot: [
        ["Văn phòng", function (r) {
          return "<b>" + esc(r.ten) + "</b><br/><small>" + esc(r.ten_cong_ty) + " · " + esc(r.ten_toa_nha) + "</small>";
        }],
        ["Tầng", function (r) { return r.tang_bat_dau + "–" + r.tang_ket_thuc; }],
        ["Khối (m)", function (r) {
          return Number(r.z_min).toFixed(1) + "–" + Number(r.z_max).toFixed(1) +
            (r.dang_hieu_luc ? "" : "<br/><small class='n-xau nhan'>ngừng</small>");
        }],
      ],
      truong: [
        { k: "ten", n: "Tên văn phòng", bat: true, rong: true },
        { k: "ma_cong_ty", n: "Công ty thuê", kieu: "select", so: true, nguon: luaChon("cong-ty", "ma_cong_ty", function (r) { return r.ten_cong_ty; }), bat: true },
        { k: "ma_toa_nha", n: "Toà nhà", kieu: "select", so: true, nguon: luaChon("toa-nha", "ma_toa_nha", function (r) { return r.ten + " (" + r.so_tang + " tầng)"; }), bat: true },
        { k: "tang_bat_dau", n: "Từ tầng", kieu: "number", bat: true, mac: 1 },
        { k: "tang_ket_thuc", n: "Đến tầng", kieu: "number", bat: true, mac: 1 },
        { k: "dung_sai_ngang", n: "Dung sai ngang δxy (m)", kieu: "number", buoc: 0.5, mac: 25 },
        { k: "dung_sai_dung", n: "Dung sai đứng δz (m)", kieu: "number", buoc: 0.5, mac: 5 },
        { k: "dang_hieu_luc", n: "Khối đang hiệu lực", kieu: "checkbox", mac: true },
      ],
      hinh: { k: "da_giac_nen", nhan: "Đa giác nền P của khối MAP", batBuoc: false,
              goiY: "Để trống = dùng toàn bộ mặt sàn toà nhà" },
    },
    "nhan-vien": {
      tieuDe: "Nhân viên", khoa: "ma_nhan_vien", ten: function (r) { return r.ho_ten; },
      cot: [
        ["Họ tên", function (r) {
          return "<b>" + esc(r.ho_ten) + "</b><br/><small>" + esc(r.ten_dang_nhap || "chưa có tài khoản") +
            " · " + esc(r.vai_tro || "") + "</small>";
        }],
        ["Công ty", function (r) { return esc(r.ten_cong_ty) + "<br/><small>" + esc(r.ten_phong_ban || "") + "</small>"; }],
        ["", function (r) { return r.dang_lam_viec ? "" : "<span class='nhan n-xau'>nghỉ việc</span>"; }],
      ],
      truong: [
        { k: "ho_ten", n: "Họ và tên", bat: true, rong: true },
        { k: "email", n: "Email", kieu: "email", rong: true },
        { k: "ma_cong_ty", n: "Công ty", kieu: "select", so: true, bat: true,
          nguon: luaChon("cong-ty", "ma_cong_ty", function (r) { return r.ten_cong_ty; }) },
        { k: "ma_phong_ban", n: "Phòng ban", kieu: "select", so: true, rong: false, coTrong: true,
          nguon: function () {
            var ct = Number(($("f_ma_cong_ty") || {}).value);
            return (st.ds["phong-ban"] || []).filter(function (p) { return p.ma_cong_ty === ct; })
              .map(function (p) { return [p.ma_phong_ban, p.ten_phong_ban]; });
          } },
        { k: "ten_dang_nhap", n: "Tên đăng nhập", bat: true },
        { k: "mat_khau", n: "Mật khẩu", kieu: "password", goiY: "để trống khi sửa = giữ nguyên" },
        { k: "vai_tro", n: "Vai trò", kieu: "select", mac: "NHAN_VIEN", nguon: function () {
          return [["NHAN_VIEN", "Nhân viên"], ["QUAN_LY", "Quản lý"], ["QUAN_TRI", "Quản trị"]];
        } },
        { k: "dang_lam_viec", n: "Đang làm việc", kieu: "checkbox", mac: true },
      ],
    },
    "ca-lam-viec": {
      tieuDe: "Ca làm việc", khoa: "ma_ca", ten: function (r) { return r.ten_ca; },
      cot: [
        ["Ca", function (r) { return "<b>" + esc(r.ten_ca) + "</b>"; }],
        ["Giờ", function (r) { return r.gio_vao + " – " + r.gio_ra; }],
        ["Trễ tối đa", function (r) { return r.tre_toi_da_phut + " phút"; }],
      ],
      truong: [
        { k: "ten_ca", n: "Tên ca", bat: true, rong: true },
        { k: "gio_vao", n: "Giờ vào", kieu: "time", bat: true, mac: "08:00" },
        { k: "gio_ra", n: "Giờ ra", kieu: "time", bat: true, mac: "17:30" },
        { k: "tre_toi_da_phut", n: "Cho phép trễ (phút)", kieu: "number", mac: 15 },
      ],
    },
    "cong-ty": {
      tieuDe: "Công ty", khoa: "ma_cong_ty", ten: function (r) { return r.ten_cong_ty; },
      cot: [
        ["Tên công ty", function (r) { return "<b>" + esc(r.ten_cong_ty) + "</b><br/><small>MST " + esc(r.ma_so_thue || "—") + "</small>"; }],
        ["NV", function (r) { return r.so_nhan_vien; }],
        ["VP", function (r) { return r.so_van_phong; }],
      ],
      truong: [
        { k: "ten_cong_ty", n: "Tên công ty", bat: true, rong: true },
        { k: "ma_so_thue", n: "Mã số thuế" },
      ],
    },
    "phong-ban": {
      tieuDe: "Phòng ban", khoa: "ma_phong_ban", ten: function (r) { return r.ten_phong_ban; },
      cot: [
        ["Phòng ban", function (r) { return "<b>" + esc(r.ten_phong_ban) + "</b>"; }],
        ["Công ty", function (r) { return esc(r.ten_cong_ty); }],
      ],
      truong: [
        { k: "ten_phong_ban", n: "Tên phòng ban", bat: true, rong: true },
        { k: "ma_cong_ty", n: "Công ty", kieu: "select", so: true, bat: true, rong: true,
          nguon: luaChon("cong-ty", "ma_cong_ty", function (r) { return r.ten_cong_ty; }) },
      ],
    },
  };
  // Mục nào cần nạp kèm để có danh sách chọn
  var CAN_NAP = ["cong-ty", "toa-nha", "phong-ban", "van-phong", "nhan-vien", "ca-lam-viec"];

  /* ---------------- nạp dữ liệu ---------------- */
  async function napTatCa() {
    var kq = await Promise.all(CAN_NAP.map(function (m) { return api("/api/quan-tri/" + m); }));
    CAN_NAP.forEach(function (m, i) { st.ds[m] = kq[i]; });
  }

  async function mo() {
    try {
      await napTatCa();
    } catch (e) { alert("Không nạp được dữ liệu quản trị: " + e.message); return; }
    if (!st.daMo) {
      st.daMo = true;
      dungBanDo();
    } else {
      veBanDo();
    }
    chonMuc(st.muc);
  }

  /* ---------------- chuyển mục ---------------- */
  document.querySelectorAll("#qtTab button").forEach(function (b) {
    b.addEventListener("click", function () { chonMuc(b.dataset.qt); });
  });

  function chonMuc(muc) {
    st.muc = muc;
    document.querySelectorAll("#qtTab button").forEach(function (b) {
      b.classList.toggle("chon", b.dataset.qt === muc);
    });
    dongForm();
    var laThongKe = muc === "thong-ke";
    $("qtThongKe").classList.toggle("an", !laThongKe);
    $("qtDanhSach").classList.toggle("an", laThongKe);
    $("qtPhanCa").classList.toggle("an", muc !== "ca-lam-viec");
    if (laThongKe) return taiThongKe();
    veBang();
    if (muc === "ca-lam-viec") taiPhanCa();
  }

  /* ---------------- thống kê ---------------- */
  async function taiThongKe() {
    var tk = await api("/api/quan-tri/thong-ke");
    var t = tk.tong;
    $("qtOSo").innerHTML = [
      ["Toà nhà", t.so_toa_nha], ["Văn phòng", t.so_van_phong],
      ["Khối MAP hiệu lực", t.so_khoi_hieu_luc], ["Nhân viên", t.so_nhan_vien],
      ["Công ty", t.so_cong_ty], ["Ca làm việc", t.so_ca],
      ["Tổng thể tích khối", Number(t.tong_the_tich || 0).toLocaleString("vi-VN") + " m³"],
    ].map(function (o) {
      return "<div class='o'><b>" + esc(o[1]) + "</b><span>" + esc(o[0]) + "</span></div>";
    }).join("");
    $("qtBangKhoi").querySelector("tbody").innerHTML = tk.theo_khoi.map(function (r, i) {
      return "<tr data-i='" + i + "' style='cursor:pointer'><td><b>" + esc(r.ten) + "</b><br/><small>" +
        esc(r.ten_toa_nha) + "</small></td><td>" + r.tong + "</td><td>" + r.hop_le + "</td><td>" +
        r.nghi_ngo + "</td><td>" + r.ngoai_vung + "</td></tr>";
    }).join("") || "<tr><td colspan='5' style='color:#8c959f'>Chưa có khối MAP</td></tr>";
    $("qtBangKhoi").querySelectorAll("tr[data-i]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        var r = tk.theo_khoi[Number(tr.dataset.i)];
        var vp = (st.ds["van-phong"] || []).find(function (v) { return v.ten === r.ten && v.ten_toa_nha === r.ten_toa_nha; });
        if (vp) bayToiVanPhong(vp);
      });
    });
  }

  /* ---------------- bảng danh sách ---------------- */
  function veBang() {
    var c = CH[st.muc];
    var rows = st.ds[st.muc] || [];
    $("qtTieuDe").textContent = c.tieuDe + " (" + rows.length + ")";
    var bang = $("qtBang");
    bang.querySelector("thead").innerHTML = "<tr>" + c.cot.map(function (x) {
      return "<th>" + esc(x[0]) + "</th>";
    }).join("") + "<th></th></tr>";
    bang.querySelector("tbody").innerHTML = rows.map(function (r, i) {
      return "<tr data-i='" + i + "'>" + c.cot.map(function (x) { return "<td>" + x[1](r) + "</td>"; }).join("") +
        "<td class='thao-tac'><button class='btn nho' data-sua='" + i + "'>Sửa</button>" +
        "<button class='btn nho xoa' data-xoa='" + i + "'>Xoá</button></td></tr>";
    }).join("") || "<tr><td colspan='9' style='color:#8c959f'>Chưa có dữ liệu</td></tr>";

    bang.querySelectorAll("[data-sua]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); moForm(rows[Number(b.dataset.sua)]); });
    });
    bang.querySelectorAll("[data-xoa]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); xoa(rows[Number(b.dataset.xoa)]); });
    });
    bang.querySelectorAll("tbody tr[data-i]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        bang.querySelectorAll("tr").forEach(function (x) { x.classList.remove("dang-chon"); });
        tr.classList.add("dang-chon");
        xemTrenBanDo(rows[Number(tr.dataset.i)]);
      });
    });
  }

  $("qtThem").addEventListener("click", function () { moForm(null); });
  $("qtDong").addEventListener("click", dongForm);

  async function xoa(r) {
    var c = CH[st.muc];
    if (!confirm("Xoá " + c.tieuDe.toLowerCase() + " “" + c.ten(r) + "”?")) return;
    try {
      await api("/api/quan-tri/" + st.muc + "/" + r[c.khoa], { method: "DELETE" });
      await sauKhiLuu();
    } catch (e) {
      var goiY = st.muc === "nhan-vien"
        ? "\n\nGợi ý: sửa nhân viên và bỏ chọn “Đang làm việc” để khoá tài khoản mà vẫn giữ lịch sử công."
        : st.muc === "van-phong"
          ? "\n\nGợi ý: sửa văn phòng và bỏ chọn “Khối đang hiệu lực” để ngừng dùng khối mà vẫn giữ lịch sử."
          : "";
      alert(e.message + goiY);
    }
  }

  async function sauKhiLuu() {
    await napTatCa();
    veBang();
    veBanDo();
    if (st.muc === "ca-lam-viec") taiPhanCa();
    if (window.napLaiDuLieuNen) window.napLaiDuLieuNen().catch(function () {});
  }

  /* ---------------- biểu mẫu thêm / sửa ---------------- */
  function moForm(r) {
    var c = CH[st.muc];
    st.dangSua = r;
    st.hinh = null;
    if (c.hinh && r && r[c.hinh.k]) {
      // Khối dùng nguyên footprint toà nhà thì để trống, sửa toà nhà sẽ tự đi theo.
      if (!(st.muc === "van-phong" && r.dung_footprint)) st.hinh = JSON.parse(r[c.hinh.k]);
    }
    $("qtFormTieuDe").textContent = (r ? "Sửa " : "Thêm ") + c.tieuDe.toLowerCase() + (r ? ": " + c.ten(r) : "");
    $("qtLoi").textContent = "";

    var html = c.truong.map(function (f) {
      var gt = r ? r[f.k] : f.mac;
      if (f.kieu === "password") gt = "";
      var id = "f_" + f.k;
      var nhan = esc(f.n) + (f.bat ? " *" : "") +
        (f.goiY ? " <span class='goi-y-nho'>(" + esc(f.goiY) + ")</span>" : "");
      if (f.kieu === "checkbox") {
        return "<label class='hop-chon rong'><input type='checkbox' id='" + id + "'" +
          (gt ? " checked" : "") + "> " + esc(f.n) + "</label>";
      }
      if (f.kieu === "select") {
        return "<label" + (f.rong ? " class='rong'" : "") + ">" + nhan +
          "<select id='" + id + "' data-gt='" + esc(gt === undefined || gt === null ? "" : gt) + "'></select></label>";
      }
      return "<label" + (f.rong ? " class='rong'" : "") + ">" + nhan +
        "<input id='" + id + "' type='" + (f.kieu || "text") + "'" +
        (f.buoc ? " step='" + f.buoc + "'" : "") +
        " value='" + esc(gt === undefined || gt === null ? "" : gt) + "'></label>";
    }).join("");

    if (c.hinh) {
      html += "<div class='hinh-hoc'><b>" + esc(c.hinh.nhan) + (c.hinh.batBuoc ? " *" : "") + "</b>" +
        (c.hinh.goiY ? "<div class='goi-y-nho'>" + esc(c.hinh.goiY) + "</div>" : "") +
        "<div id='hinhTrangThai' style='margin-top:5px'></div>" +
        "<div class='hang'>" +
        "<button type='button' class='btn nho' id='hinhVe'>Vẽ đa giác trên bản đồ</button>" +
        "<button type='button' class='btn nho' id='hinhSua'>Sửa đỉnh</button>" +
        (c.hinh.batBuoc ? "" : "<button type='button' class='btn nho' id='hinhBo'>Dùng toàn bộ mặt sàn</button>") +
        "</div></div>";
    }
    $("qtTruong").innerHTML = html;

    // đổ danh sách chọn
    c.truong.forEach(function (f) { if (f.kieu === "select") doLuaChon(f); });
    if (st.muc === "nhan-vien") {
      $("f_ma_cong_ty").addEventListener("change", function () {
        doLuaChon(c.truong.find(function (f) { return f.k === "ma_phong_ban"; }));
      });
    }

    if (c.hinh) {
      $("hinhVe").addEventListener("click", batDauVe);
      $("hinhSua").addEventListener("click", suaDinh);
      if ($("hinhBo")) $("hinhBo").addEventListener("click", function () {
        st.hinh = null; lopVe.removeAll(); capNhatHinh();
      });
      capNhatHinh();
    }
    // xem trước mô hình mỗi khi đổi thông số
    $("qtTruong").querySelectorAll("input,select").forEach(function (el) {
      el.addEventListener("input", xemTruoc);
      el.addEventListener("change", xemTruoc);
    });

    $("qtForm").classList.remove("an");
    $("qtForm").scrollIntoView({ behavior: "smooth", block: "start" });
    if (r) xemTrenBanDo(r);
    xemTruoc();
  }

  function doLuaChon(f) {
    var el = $("f_" + f.k);
    var gt = el.dataset.gt;
    var ds = f.nguon();
    el.innerHTML = (f.coTrong ? "<option value=''>— không —</option>" : "") + ds.map(function (o) {
      return "<option value='" + esc(o[0]) + "'" + (String(o[0]) === String(gt) ? " selected" : "") + ">" +
        esc(o[1]) + "</option>";
    }).join("");
  }

  function dongForm() {
    $("qtForm").classList.add("an");
    st.dangSua = null;
    st.hinh = null;
    if (sketch) sketch.cancel();
    if (lopVe) lopVe.removeAll();
    if (lopXemTruoc) lopXemTruoc.removeAll();
    goiY("Chọn một dòng để xem trên bản đồ 3D.");
  }

  function layGiaTri() {
    var c = CH[st.muc];
    var b = {};
    c.truong.forEach(function (f) {
      var el = $("f_" + f.k);
      if (f.kieu === "checkbox") { b[f.k] = el.checked; return; }
      var v = el.value.trim();
      if (f.kieu === "password" && !v) return;
      if (f.kieu === "number") { b[f.k] = v === "" ? "" : Number(v); return; }
      if (f.so) { b[f.k] = v === "" ? null : Number(v); return; }
      b[f.k] = v;
    });
    if (c.hinh) b[c.hinh.k] = st.hinh;
    return b;
  }

  $("qtForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var c = CH[st.muc];
    var b = layGiaTri();
    $("qtLoi").textContent = "";
    var thieu = c.truong.filter(function (f) { return f.bat && (b[f.k] === "" || b[f.k] === null); });
    if (thieu.length) { $("qtLoi").textContent = "Chưa nhập: " + thieu.map(function (f) { return f.n; }).join(", "); return; }
    if (c.hinh && c.hinh.batBuoc && !st.hinh) { $("qtLoi").textContent = "Chưa vẽ " + c.hinh.nhan.toLowerCase(); return; }
    if (st.muc === "nhan-vien" && !st.dangSua && !b.mat_khau) { $("qtLoi").textContent = "Nhân viên mới cần mật khẩu"; return; }
    $("qtLuu").disabled = true;
    try {
      if (st.dangSua) {
        await api("/api/quan-tri/" + st.muc + "/" + st.dangSua[c.khoa], { method: "PUT", body: JSON.stringify(b) });
      } else {
        await api("/api/quan-tri/" + st.muc, { method: "POST", body: JSON.stringify(b) });
      }
      dongForm();
      await sauKhiLuu();
      goiY("Đã lưu.");
    } catch (err) {
      $("qtLoi").textContent = err.message;
    } finally {
      $("qtLuu").disabled = false;
    }
  });

  /* ---------------- phân ca ---------------- */
  function homNay(lech) {
    var d = new Date(); d.setDate(d.getDate() + (lech || 0));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  async function taiPhanCa() {
    var nvCu = $("pcNhanVien").value, caCu = $("pcCa").value;
    $("pcNhanVien").innerHTML = (st.ds["nhan-vien"] || []).filter(function (n) { return n.dang_lam_viec; })
      .map(function (n) { return "<option value='" + n.ma_nhan_vien + "'>" + esc(n.ho_ten) + "</option>"; }).join("");
    $("pcCa").innerHTML = (st.ds["ca-lam-viec"] || [])
      .map(function (c) { return "<option value='" + c.ma_ca + "'>" + esc(c.ten_ca) + " (" + c.gio_vao + "–" + c.gio_ra + ")</option>"; }).join("");
    if (nvCu) $("pcNhanVien").value = nvCu;
    if (caCu) $("pcCa").value = caCu;
    if (!$("pcTu").value) $("pcTu").value = homNay(0);
    if (!$("pcDen").value) $("pcDen").value = homNay(6);
    var ds = await api("/api/quan-tri/phan-ca");
    var tb = $("pcBang").querySelector("tbody");
    tb.innerHTML = ds.map(function (p) {
      return "<tr><td>" + esc(p.ngay_lam_viec) + "</td><td>" + esc(p.ho_ten) + "</td><td>" + esc(p.ten_ca) +
        "</td><td class='thao-tac'><button class='btn nho xoa' data-pc='" + p.ma_phan_ca + "'>Bỏ</button></td></tr>";
    }).join("") || "<tr><td colspan='4' style='color:#8c959f'>Chưa phân ca</td></tr>";
    tb.querySelectorAll("[data-pc]").forEach(function (b) {
      b.addEventListener("click", async function () {
        try { await api("/api/quan-tri/phan-ca/" + b.dataset.pc, { method: "DELETE" }); taiPhanCa(); }
        catch (e) { alert(e.message); }
      });
    });
  }

  $("pcGan").addEventListener("click", async function () {
    $("pcLoi").textContent = "";
    try {
      var kq = await api("/api/quan-tri/phan-ca", {
        method: "POST",
        body: JSON.stringify({
          ma_nhan_vien: Number($("pcNhanVien").value), ma_ca: Number($("pcCa").value),
          tu_ngay: $("pcTu").value, den_ngay: $("pcDen").value, ca_cuoi_tuan: $("pcCuoiTuan").checked,
        }),
      });
      $("pcLoi").textContent = "";
      goiY("Đã gán ca cho " + kq.so_ngay + " ngày.");
      taiPhanCa();
    } catch (e) { $("pcLoi").textContent = e.message; }
  });

  /* =================================================================
     BẢN ĐỒ QUẢN TRỊ
     ================================================================= */
  function goiY(chu, laVe) {
    var o = $("qtGoiY");
    o.textContent = chu;
    o.classList.toggle("ve", Boolean(laVe));
  }

  function dungBanDo() {
    require([
      "esri/Map", "esri/views/SceneView", "esri/layers/GraphicsLayer",
      "esri/widgets/Sketch/SketchViewModel", "esri/geometry/support/webMercatorUtils",
    ], function (Map, SceneView, GraphicsLayer, SketchViewModel, webMercatorUtils) {
      wmu = webMercatorUtils;
      var tuyet = { elevationInfo: { mode: "absolute-height" } };
      lop1 = new GraphicsLayer(tuyet);
      lop3 = new GraphicsLayer(tuyet);
      lopKhoi = new GraphicsLayer(tuyet);
      lopXemTruoc = new GraphicsLayer(tuyet);
      lopVe = new GraphicsLayer({ elevationInfo: { mode: "on-the-ground" } });

      var tn0 = (st.ds["toa-nha"] || [])[0];
      var tam = tn0 ? MoHinh3D.tamCua(tn0.footprint) : [106.7009, 10.7769];
      qv = new SceneView({
        container: "banDoQuanTri",
        map: new Map({ basemap: "hybrid", ground: "world-elevation",
                       layers: [lop1, lop3, lopKhoi, lopXemTruoc, lopVe] }),
        camera: { position: [tam[0] - 0.0021, tam[1] - 0.0021, 330], heading: 40, tilt: 62 },
      });
      qv.ui.move("zoom", "top-right");
      MoHinh3D.nutDieuKhien(qv, lop1, lop3, lopKhoi);

      sketch = new SketchViewModel({
        view: qv, layer: lopVe,
        polygonSymbol: {
          type: "polygon-3d",
          symbolLayers: [{ type: "fill", material: { color: [255, 196, 0, 0.35] },
                           outline: { color: [255, 160, 0], size: 2.5 } }],
        },
        defaultCreateOptions: { hasZ: false },
        defaultUpdateOptions: { tool: "reshape", enableZ: false },
      });
      sketch.on("create", function (e) {
        if (e.state === "complete") {
          st.hinh = sangGeoJSON(e.graphic.geometry);
          capNhatHinh(); xemTruoc();
          goiY("Đã vẽ xong. Bấm “Sửa đỉnh” để chỉnh, hoặc Lưu.");
        }
      });
      sketch.on("update", function (e) {
        if (e.state === "complete" && e.graphics[0]) {
          st.hinh = sangGeoJSON(e.graphics[0].geometry);
          capNhatHinh(); xemTruoc();
          goiY("Đã cập nhật đa giác.");
        }
      });
      veBanDo();
    });
  }

  function veBanDo() {
    if (!lop1) return;
    MoHinh3D.napModule().then(function () {
      lop1.removeAll(); lop3.removeAll(); lopKhoi.removeAll();
      (st.ds["toa-nha"] || []).forEach(function (tn) {
        MoHinh3D.dungLod1(lop1, tn);
        MoHinh3D.dungLod3(lop3, tn);
      });
      var mau = [[232, 98, 42], [31, 111, 235], [130, 80, 223], [26, 127, 55]];
      (st.ds["van-phong"] || []).forEach(function (v, i) {
        if (!v.ma_khu_vuc) return;
        MoHinh3D.veKhoiMap(lopKhoi, v, { mau: v.dang_hieu_luc ? mau[i % mau.length] : [140, 140, 140] });
      });
    });
  }

  function sangGeoJSON(g) {
    var dl = g.spatialReference && g.spatialReference.isWebMercator ? wmu.webMercatorToGeographic(g) : g;
    var vong = dl.rings[0].map(function (p) { return [Number(p[0].toFixed(7)), Number(p[1].toFixed(7))]; });
    var a = vong[0], b = vong[vong.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) vong.push(a.slice());
    return { type: "Polygon", coordinates: [vong] };
  }

  function capNhatHinh() {
    var o = $("hinhTrangThai");
    if (!o) return;
    if (st.hinh) {
      o.innerHTML = "Đã có đa giác <b>" + (st.hinh.coordinates[0].length - 1) + " đỉnh</b>.";
    } else {
      o.innerHTML = st.muc === "van-phong"
        ? "Dùng <b>toàn bộ mặt sàn</b> của toà nhà đã chọn."
        : "<span style='color:#cf222e'>Chưa có — bấm “Vẽ đa giác trên bản đồ”.</span>";
    }
  }

  function batDauVe() {
    lopVe.removeAll();
    lopXemTruoc.removeAll();
    sketch.create("polygon");
    goiY("Bấm lên bản đồ để đặt từng đỉnh · bấm đúp để kết thúc · Esc để huỷ", true);
  }

  function suaDinh() {
    var hinh = st.hinh;
    if (!hinh && st.muc === "van-phong") {
      var tn = toaNhaDangChon();
      if (tn) hinh = JSON.parse(tn.footprint);
    }
    if (!hinh) { batDauVe(); return; }
    require(["esri/Graphic", "esri/geometry/Polygon"], function (Graphic, Polygon) {
      lopVe.removeAll();
      var g = new Graphic({
        geometry: new Polygon({ rings: hinh.coordinates, spatialReference: { wkid: 4326 } }),
        symbol: sketch.polygonSymbol,
      });
      lopVe.add(g);
      sketch.update(g, { tool: "reshape" });
      goiY("Kéo đỉnh để chỉnh · bấm ra ngoài để kết thúc", true);
    });
  }

  function toaNhaDangChon() {
    var el = $("f_ma_toa_nha");
    if (!el) return null;
    var id = Number(el.value);
    return (st.ds["toa-nha"] || []).find(function (t) { return t.ma_toa_nha === id; }) || null;
  }

  /* Xem trước ngay trên bản đồ những gì sắp lưu. */
  function xemTruoc() {
    if (!lopXemTruoc || $("qtForm").classList.contains("an")) return;
    MoHinh3D.napModule().then(function () {
      lopXemTruoc.removeAll();
      var b = layGiaTri();
      if (st.muc === "toa-nha" && st.hinh && b.so_tang > 0 && b.chieu_cao_tang > 0) {
        var tnXem = {
          ten: (b.ten || "Toà nhà mới") + " (xem trước)", footprint: JSON.stringify(st.hinh),
          cao_do_nen: b.cao_do_nen || 0, so_tang: b.so_tang, chieu_cao_tang: b.chieu_cao_tang,
          so_tang_de: b.so_tang_de || 0,
        };
        MoHinh3D.dungLod3(lopXemTruoc, tnXem);
      }
      if (st.muc === "van-phong") {
        var tn = toaNhaDangChon();
        if (!tn || !(b.tang_bat_dau >= 1) || !(b.tang_ket_thuc >= b.tang_bat_dau)) return;
        var zNen = Number(tn.cao_do_nen), h = Number(tn.chieu_cao_tang);
        var vuot = b.tang_ket_thuc > tn.so_tang;
        MoHinh3D.veKhoiMap(lopXemTruoc, {
          ten: (b.ten || "Khối mới") + " (xem trước)",
          da_giac_nen: st.hinh || JSON.parse(tn.footprint),
          z_min: zNen + (b.tang_bat_dau - 1) * h,
          z_max: zNen + b.tang_ket_thuc * h,
          tang_bat_dau: b.tang_bat_dau, tang_ket_thuc: b.tang_ket_thuc,
          dung_sai_ngang: b.dung_sai_ngang, dung_sai_dung: b.dung_sai_dung,
          ten_toa_nha: tn.ten,
        }, { mau: vuot ? [207, 34, 46] : [255, 176, 0], noiBat: true });
        goiY(vuot
          ? "Toà nhà chỉ có " + tn.so_tang + " tầng — khối vượt quá mái (sẽ bị CSDL từ chối)"
          : "Khối xem trước: z = " + (zNen + (b.tang_bat_dau - 1) * h).toFixed(2) + " → " +
            (zNen + b.tang_ket_thuc * h).toFixed(2) + " m", vuot);
      }
    });
  }

  /* ---------------- bay tới đối tượng ---------------- */
  function bayToi(fpChuoi, z) {
    if (!qv) return;
    var t = MoHinh3D.tamCua(fpChuoi);
    qv.goTo({ position: { longitude: t[0] - 0.0021, latitude: t[1] - 0.0021, z: z + 180 },
              heading: 40, tilt: 62 }, { duration: 1100 }).catch(function () {});
  }

  function bayToiVanPhong(v) {
    if (!v.da_giac_nen) return;
    bayToi(v.da_giac_nen, Number(v.z_max));
    goiY(v.ten + ": tầng " + v.tang_bat_dau + "–" + v.tang_ket_thuc + " · z " +
      Number(v.z_min).toFixed(2) + " → " + Number(v.z_max).toFixed(2) + " m");
  }

  function xemTrenBanDo(r) {
    if (st.muc === "toa-nha") {
      bayToi(r.footprint, Number(r.cao_do_mai) / 2);
      goiY(r.ten + ": " + r.so_tang + " tầng, mái ở " + Number(r.cao_do_mai).toFixed(2) + " m");
    } else if (st.muc === "van-phong") {
      bayToiVanPhong(r);
    }
  }

  window.QuanTri = { mo: mo };
})();
