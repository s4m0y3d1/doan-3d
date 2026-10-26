/* ===================================================================
   Dựng mô hình 3D toà nhà và khối MAP trên SceneView (ArcGIS SDK 4.29)
   Đồ án IE402, nhóm 1

   Hai mức chi tiết theo chuẩn CityGML:
     - LOD1: khối đùn trơn từ footprint (P, chiều cao) — đúng với mô hình
             tính toán của hệ thống.
     - LOD3: mô hình kiến trúc mặt ngoài — khối đế, vách kính từng tầng,
             dầm biên, khung nhôm đứng, lối vào chính (cửa, mái sảnh, cột),
             tường chắn mái, chóp mái, thiết bị kỹ thuật, sân đỗ trực thăng
             và cột thu lôi. Mỗi thành phần gắn lớp ngữ nghĩa CityGML
             (WallSurface, Window, Door, RoofSurface, BuildingInstallation).
   Mọi chi tiết LOD3 được suy ra từ dữ liệu trong CSDL (footprint, cao độ
   nền, số tầng, chiều cao tầng, số tầng đế) — thêm toà nhà mới bằng tab
   Quản trị là tự có mô hình LOD3, không phải dựng tay.
   =================================================================== */
(function () {
  var M = null; // các module ArcGIS đã nạp

  function napModule() {
    if (M) return Promise.resolve(M);
    return new Promise(function (ok) {
      require([
        "esri/Graphic", "esri/geometry/Polygon", "esri/geometry/Point",
        "esri/geometry/Polyline",
      ], function (Graphic, Polygon, Point, Polyline) {
        M = { Graphic: Graphic, Polygon: Polygon, Point: Point, Polyline: Polyline };
        ok(M);
      });
    });
  }

  var SR = { wkid: 4326 };

  /* ---------- hệ toạ độ mét cục bộ quanh tâm footprint ---------- */
  function heMet(fp) {
    var vong = fp.coordinates[0];
    var n = vong.length - 1; // bỏ điểm đóng vòng
    var cx = 0, cy = 0;
    for (var i = 0; i < n; i++) { cx += vong[i][0]; cy += vong[i][1]; }
    cx /= n; cy /= n;
    var kx = 111320 * Math.cos(cy * Math.PI / 180), ky = 110540;
    var met = [];
    for (var j = 0; j < n; j++) met.push([(vong[j][0] - cx) * kx, (vong[j][1] - cy) * ky]);
    // diện tích có dấu: > 0 là ngược chiều kim đồng hồ
    var a = 0;
    for (var k = 0; k < n; k++) {
      var p = met[k], q = met[(k + 1) % n];
      a += p[0] * q[1] - q[0] * p[1];
    }
    var xs = met.map(function (p) { return p[0]; });
    var ys = met.map(function (p) { return p[1]; });
    return {
      cx: cx, cy: cy, vong: met, nguocChieu: a > 0,
      rong: Math.max.apply(null, xs) - Math.min.apply(null, xs),
      sau: Math.max.apply(null, ys) - Math.min.apply(null, ys),
      lonLat: function (x, y) { return [cx + x / kx, cy + y / ky]; },
    };
  }

  function phong(vong, heSo) {
    return vong.map(function (p) { return [p[0] * heSo, p[1] * heSo]; });
  }

  // ArcGIS quy ước vòng ngoài đi theo chiều kim đồng hồ: chuẩn hoá trước khi dựng.
  function ringZ(h, vongMet, z) {
    var a = 0;
    for (var i = 0; i < vongMet.length; i++) {
      var p0 = vongMet[i], p1 = vongMet[(i + 1) % vongMet.length];
      a += p0[0] * p1[1] - p1[0] * p0[1];
    }
    if (a > 0) vongMet = vongMet.slice().reverse();
    var r = vongMet.map(function (p) { var ll = h.lonLat(p[0], p[1]); return [ll[0], ll[1], z]; });
    r.push(r[0].slice());
    return [r];
  }

  function popup(tieuDe, lop, moTa) {
    return {
      title: tieuDe,
      content: "<b>Lớp CityGML:</b> " + lop + (moTa ? "<br/>" + moTa : ""),
    };
  }

  function khoi(h, vongMet, z, cao, mau, vien, pp) {
    return new M.Graphic({
      geometry: new M.Polygon({ rings: ringZ(h, vongMet, z), spatialReference: SR }),
      symbol: {
        type: "polygon-3d",
        symbolLayers: [{
          type: "extrude", size: cao, material: { color: mau },
          edges: vien ? { type: "solid", size: 0.6, color: vien } : null,
        }],
      },
      popupTemplate: pp || null,
    });
  }

  function vat(h, x, y, z, hinh, rong, sau, cao, mau, huong, pp) {
    var ll = h.lonLat(x, y);
    return new M.Graphic({
      geometry: new M.Point({ longitude: ll[0], latitude: ll[1], z: z, spatialReference: SR }),
      symbol: {
        type: "point-3d",
        symbolLayers: [{
          type: "object", resource: { primitive: hinh }, anchor: "bottom",
          width: rong, depth: sau, height: cao, heading: huong || 0,
          material: { color: mau },
        }],
      },
      popupTemplate: pp || null,
    });
  }

  // Một Polyline gồm nhiều đoạn đứng: khung nhôm của vách kính.
  function khungDung(h, vongMet, buoc, z0, z1, mau, rong, pp) {
    var paths = [];
    var n = vongMet.length;
    for (var i = 0; i < n; i++) {
      var p = vongMet[i], q = vongMet[(i + 1) % n];
      var dai = Math.hypot(q[0] - p[0], q[1] - p[1]);
      var so = Math.max(1, Math.round(dai / buoc));
      for (var t = 0; t < so; t++) {
        var x = p[0] + (q[0] - p[0]) * t / so, y = p[1] + (q[1] - p[1]) * t / so;
        var ll = h.lonLat(x, y);
        paths.push([[ll[0], ll[1], z0], [ll[0], ll[1], z1]]);
      }
    }
    return new M.Graphic({
      geometry: new M.Polyline({ paths: paths, hasZ: true, spatialReference: SR }),
      symbol: {
        type: "line-3d",
        symbolLayers: [{ type: "path", profile: "quad", width: rong, height: rong,
                         material: { color: mau }, cap: "butt" }],
      },
      popupTemplate: pp || null,
    });
  }

  // Đường viền chạy quanh mái: tường chắn mái (parapet).
  function vienQuanh(h, vongMet, z, cao, day, mau, pp) {
    var r = ringZ(h, vongMet, z)[0];
    return new M.Graphic({
      geometry: new M.Polyline({ paths: [r], hasZ: true, spatialReference: SR }),
      symbol: {
        type: "line-3d",
        symbolLayers: [{ type: "path", profile: "quad", width: day, height: cao,
                         anchor: "bottom", material: { color: mau }, join: "miter" }],
      },
      popupTemplate: pp || null,
    });
  }

  function thongSo(tn) {
    var zNen = Number(tn.cao_do_nen), hTang = Number(tn.chieu_cao_tang);
    var soTang = Number(tn.so_tang);
    var tangDe = Math.max(0, Math.min(Number(tn.so_tang_de || 0), soTang - 1));
    return { zNen: zNen, hTang: hTang, soTang: soTang, tangDe: tangDe,
             dinh: zNen + soTang * hTang };
  }

  /* =================================================================
     LOD1 — khối đùn trơn
     ================================================================= */
  function dungLod1(lop, tn) {
    var fp = JSON.parse(tn.footprint);
    var h = heMet(fp), s = thongSo(tn);
    lop.add(khoi(h, h.vong, s.zNen, s.dinh - s.zNen, [196, 200, 206, 0.55], [80, 90, 102, 0.9],
      { title: tn.ten + " — LOD1",
        content: "<b>Khối đùn</b> từ footprint, cao " + (s.dinh - s.zNen).toFixed(2) + " m<br/>" +
                 "<b>Số tầng:</b> " + s.soTang + " · <b>chiều cao tầng:</b> " + s.hTang.toFixed(2) + " m" }));
    nhanTen(lop, h, tn, s.dinh + 6);
  }

  /* =================================================================
     LOD3 — mô hình kiến trúc mặt ngoài
     ================================================================= */
  var KINH_THAP = [120, 160, 190, 0.32];
  var KINH_DE = [96, 136, 166, 0.55];
  var DA = [214, 208, 196, 0.96];
  var BETONG = [200, 202, 204, 0.95];
  var NHOM = [74, 82, 92, 1];
  var VIEN = [84, 96, 110, 0.85];

  function dungLod3(lop, tn) {
    var fp = JSON.parse(tn.footprint);
    var h = heMet(fp), s = thongSo(tn);
    var ten = tn.ten;
    var heSoDe = s.tangDe > 0 ? 1.18 : 1.0;
    var vongDe = phong(h.vong, heSoDe);
    var zThap = s.zNen + s.tangDe * s.hTang; // chân thân tháp

    /* Sân nền quanh chân công trình. */
    lop.add(khoi(h, phong(h.vong, heSoDe + 0.3), s.zNen - 0.4, 0.4, [226, 226, 222, 0.95], null,
      popup(ten + " — sân nền", "LandUse / TrafficArea", "Sân lát quanh chân công trình")));

    /* ---------- khối đế: từng tầng gồm băng tường đá + băng cửa kính ---------- */
    for (var t = 1; t <= s.tangDe; t++) {
      var zSan = s.zNen + (t - 1) * s.hTang;
      var tyLeKinh = t === 1 ? 0.82 : 0.6; // tầng trệt mặt tiền kính cao
      lop.add(khoi(h, vongDe, zSan, s.hTang * (1 - tyLeKinh), DA, null,
        popup(ten + " — khối đế, tầng " + t, "WallSurface", "Băng tường ốp đá")));
      lop.add(khoi(h, phong(vongDe, 0.995), zSan + s.hTang * (1 - tyLeKinh), s.hTang * tyLeKinh, KINH_DE, VIEN,
        popup(ten + " — khối đế, tầng " + t, "Window", "Băng cửa kính")));
    }
    if (s.tangDe > 0) {
      lop.add(khungDung(h, vongDe, 4.5, s.zNen, zThap, NHOM, 0.3,
        popup(ten + " — khung cửa khối đế", "BuildingInstallation", "Đố nhôm đứng, bước 4,5 m")));
      // mái khối đế: sàn mái nhô ra + tường chắn mái
      lop.add(khoi(h, phong(h.vong, heSoDe + 0.03), zThap, 0.8, BETONG, VIEN,
        popup(ten + " — mái khối đế", "RoofSurface", "Sàn mái nhô, cao độ " + zThap.toFixed(2) + " m")));
      lop.add(vienQuanh(h, phong(h.vong, heSoDe + 0.025), zThap + 0.8, 1.1, 0.3, BETONG,
        popup(ten + " — tường chắn mái khối đế", "WallSurface", "Parapet cao 1,1 m")));
    }

    /* ---------- thân tháp: vách kính, dầm biên từng tầng, khung đứng ---------- */
    lop.add(khoi(h, h.vong, zThap, s.dinh - zThap, KINH_THAP, null,
      popup(ten + " — vách kính thân tháp", "Window",
        "Tầng " + (s.tangDe + 1) + "–" + s.soTang + " · cao độ " + zThap.toFixed(2) +
        " → " + s.dinh.toFixed(2) + " m")));
    for (var u = s.tangDe + 1; u <= s.soTang; u++) {
      lop.add(khoi(h, phong(h.vong, 1.012), s.zNen + u * s.hTang - 0.45, 0.6, BETONG, null,
        popup(ten + " — dầm biên tầng " + u, "WallSurface", "Băng dầm bê tông giữa hai tầng")));
    }
    lop.add(khungDung(h, h.vong, 3.0, zThap, s.dinh, NHOM, 0.22,
      popup(ten + " — khung vách kính", "BuildingInstallation", "Đố nhôm đứng, bước 3 m")));

    /* ---------- lối vào chính: trên cạnh dài nhất của khối đế ---------- */
    loiVao(lop, h, vongDe, s, ten);

    /* ---------- mái ---------- */
    lop.add(vienQuanh(h, h.vong, s.dinh, 1.2, 0.35, BETONG,
      popup(ten + " — tường chắn mái", "WallSurface", "Parapet cao 1,2 m")));
    var hChop = s.hTang * 1.6;
    lop.add(khoi(h, phong(h.vong, 0.8), s.dinh, hChop, [178, 186, 194, 0.95], VIEN,
      popup(ten + " — tum kỹ thuật", "BuildingInstallation", "Phòng máy thang máy, bể nước mái")));
    var zChop = s.dinh + hChop;
    lop.add(khoi(h, phong(h.vong, 0.8), zChop, 0.3, BETONG, null,
      popup(ten + " — sàn mái tum", "RoofSurface")));
    // thiết bị kỹ thuật và sân đỗ trực thăng trên mái tum
    var dx = 0.18 * h.rong, dy = 0.18 * h.sau;
    var coMay = Math.max(2, Math.min(5, 0.12 * Math.min(h.rong, h.sau)));
    [[-dx, -dy], [dx, -dy], [-dx, dy]].forEach(function (p, i) {
      lop.add(vat(h, p[0], p[1], zChop + 0.3, "cube", coMay, coMay * 0.7, 2.4, [150, 156, 162],
        0, popup(ten + " — thiết bị kỹ thuật " + (i + 1), "BuildingInstallation",
          "Cụm máy làm lạnh / quạt hút trên mái")));
    });
    var dkSan = Math.max(6, Math.min(18, 0.3 * Math.min(h.rong, h.sau)));
    lop.add(vat(h, dx * 0.6, dy * 0.6, zChop + 0.3, "cylinder", dkSan, dkSan, 0.35, [205, 92, 60],
      0, popup(ten + " — sân đỗ trực thăng", "RoofSurface", "Bãi đáp khẩn cấp trên mái")));
    lop.add(vat(h, -dx * 0.9, dy * 0.9, zChop + 0.3, "cylinder", 0.6, 0.6, 12, [120, 128, 136],
      0, popup(ten + " — cột thu lôi", "BuildingInstallation")));

    nhanTen(lop, h, tn, zChop + 16);
  }

  function loiVao(lop, h, vong, s, ten) {
    var n = vong.length, best = 0, dai = -1;
    for (var i = 0; i < n; i++) {
      var p = vong[i], q = vong[(i + 1) % n];
      var d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d > dai) { dai = d; best = i; }
    }
    var a = vong[best], b = vong[(best + 1) % n];
    var ux = (b[0] - a[0]) / dai, uy = (b[1] - a[1]) / dai;
    // pháp tuyến hướng ra ngoài: vòng ngược chiều kim đồng hồ thì là (uy, -ux)
    var nx = h.nguocChieu ? uy : -uy, ny = h.nguocChieu ? -ux : ux;
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    var huong = -Math.atan2(uy, ux) * 180 / Math.PI; // trục x của vật trùng cạnh
    var rongSanh = Math.min(14, dai * 0.6);
    var zNen = s.zNen;
    var zMai = zNen + Math.min(s.hTang * 0.95, 4.6);

    // mái sảnh (canopy) đua ra 5 m
    var c1 = [mx - ux * rongSanh / 2, my - uy * rongSanh / 2];
    var c2 = [mx + ux * rongSanh / 2, my + uy * rongSanh / 2];
    var mai = [c1, c2, [c2[0] + nx * 5, c2[1] + ny * 5], [c1[0] + nx * 5, c1[1] + ny * 5]];
    lop.add(khoi(h, mai, zMai, 0.45, [235, 236, 238, 0.98], VIEN,
      popup(ten + " — mái sảnh lối vào chính", "BuildingInstallation", "Mái đua 5 m trước sảnh")));
    // hai cột đỡ mái sảnh
    [-1, 1].forEach(function (k) {
      lop.add(vat(h, mx + ux * k * (rongSanh / 2 - 0.6) + nx * 4.4, my + uy * k * (rongSanh / 2 - 0.6) + ny * 4.4,
        zNen, "cylinder", 0.55, 0.55, zMai - zNen, [228, 228, 228],
        0, popup(ten + " — cột mái sảnh", "BuildingInstallation")));
    });
    // cửa xoay ở giữa và hai cửa kính hai bên
    lop.add(vat(h, mx + nx * 0.9, my + ny * 0.9, zNen, "cylinder", 3.2, 3.2, 3.2, [150, 190, 215, 0.75],
      0, popup(ten + " — cửa xoay sảnh chính", "Door", "Lối vào chính, cạnh dài nhất của khối đế")));
    [-1, 1].forEach(function (k) {
      lop.add(vat(h, mx + ux * k * 3.4 + nx * 0.25, my + uy * k * 3.4 + ny * 0.25, zNen,
        "cube", 2.2, 0.25, 3.0, [70, 110, 140, 0.85], huong,
        popup(ten + " — cửa kính " + (k < 0 ? "trái" : "phải"), "Door", "Cửa mở hai cánh")));
    });
    // bậc tam cấp
    var bac = [[c1[0] + nx * 5, c1[1] + ny * 5], [c2[0] + nx * 5, c2[1] + ny * 5],
               [c2[0] + nx * 6.5, c2[1] + ny * 6.5], [c1[0] + nx * 6.5, c1[1] + ny * 6.5]];
    lop.add(khoi(h, bac, zNen - 0.4, 0.55, [190, 186, 178, 1], null,
      popup(ten + " — bậc tam cấp", "OuterFloorSurface")));
  }

  function nhanTen(lop, h, tn, z) {
    lop.add(new M.Graphic({
      geometry: new M.Point({ longitude: h.cx, latitude: h.cy, z: z, spatialReference: SR }),
      symbol: {
        type: "point-3d",
        symbolLayers: [{
          type: "text", text: tn.ten, size: 11,
          material: { color: [40, 48, 58] },
          halo: { color: [255, 255, 255, 0.9], size: 1.2 },
        }],
      },
      popupTemplate: {
        title: tn.ten,
        content:
          (tn.dia_chi ? tn.dia_chi + "<br/>" : "") +
          "<b>Số tầng:</b> " + tn.so_tang + " (đế " + (tn.so_tang_de || 0) + ")<br/>" +
          "<b>Chiều cao tầng:</b> " + Number(tn.chieu_cao_tang).toFixed(2) + " m<br/>" +
          "<b>Cao độ nền:</b> " + Number(tn.cao_do_nen).toFixed(2) + " m<br/>" +
          (tn.nguon_du_lieu ? "<b>Nguồn:</b> " + tn.nguon_du_lieu : ""),
      },
    }));
  }

  /* =================================================================
     Khối MAP (P, z_min, z_max) — vẽ bán trong suốt lồng trong toà nhà
     ================================================================= */
  function veKhoiMap(lop, k, tuyChon) {
    tuyChon = tuyChon || {};
    var hinh = typeof k.da_giac_nen === "string" ? JSON.parse(k.da_giac_nen) : k.da_giac_nen;
    var zMin = Number(k.z_min), zMax = Number(k.z_max);
    var c = tuyChon.mau || [31, 111, 235];
    var rings = hinh.coordinates.map(function (r) {
      return r.map(function (p) { return [p[0], p[1], zMin]; });
    });
    var g = new M.Graphic({
      geometry: new M.Polygon({ rings: rings, spatialReference: SR }),
      symbol: {
        type: "polygon-3d",
        symbolLayers: [{
          type: "extrude", size: zMax - zMin,
          material: { color: c.concat([tuyChon.noiBat ? 0.32 : 0.16]) },
          edges: { type: "solid", size: tuyChon.noiBat ? 1.6 : 0.8, color: c.concat([1]) },
        }],
      },
      popupTemplate: {
        title: k.ten_van_phong || k.ten || "Khối MAP",
        content:
          (k.ten_cong_ty ? "<b>Công ty:</b> " + k.ten_cong_ty + "<br/>" : "") +
          (k.ten_toa_nha ? "<b>Toà nhà:</b> " + k.ten_toa_nha + "<br/>" : "") +
          "<b>Dải tầng:</b> " + k.tang_bat_dau + "–" + k.tang_ket_thuc + "<br/>" +
          "<b>z_min:</b> " + zMin.toFixed(2) + " m · <b>z_max:</b> " + zMax.toFixed(2) + " m<br/>" +
          "<b>Dung sai:</b> δxy " + Number(k.dung_sai_ngang) + " m · δz " + Number(k.dung_sai_dung) + " m",
      },
    });
    lop.add(g);
    return g;
  }

  function tamCua(fpChuoi) {
    var h = heMet(JSON.parse(fpChuoi));
    return [h.cx, h.cy];
  }

  window.MoHinh3D = {
    napModule: napModule,
    dungLod1: dungLod1,
    dungLod3: dungLod3,
    veKhoiMap: veKhoiMap,
    tamCua: tamCua,
    // Nút chuyển LOD1 / LOD3 và bật tắt khối MAP, gắn vào góc bản đồ.
    nutDieuKhien: function (view, lop1, lop3, lopKhoi) {
      var o = document.createElement("div");
      o.className = "dk-lod esri-widget";
      o.innerHTML =
        "<div class='dk-nhom'><button data-lod='1'>LOD1</button>" +
        "<button data-lod='3' class='chon'>LOD3</button></div>" +
        "<label><input type='checkbox' checked> Khối MAP</label>";
      lop1.visible = false; lop3.visible = true;
      o.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          o.querySelectorAll("button").forEach(function (x) { x.classList.remove("chon"); });
          b.classList.add("chon");
          lop1.visible = b.dataset.lod === "1";
          lop3.visible = b.dataset.lod === "3";
        });
      });
      o.querySelector("input").addEventListener("change", function (e) {
        lopKhoi.visible = e.target.checked;
      });
      view.ui.add(o, "top-left");
      return o;
    },
  };
})();
