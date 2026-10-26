// Sinh slide PowerPoint thuyết trình đồ án IE402.
//   cd tools/thuyet-trinh && npm install && node build_pptx.js
// Lời nói của từng slide lấy từ noi-dung.json (dùng chung với kịch bản PDF)
// và được ghi vào phần ghi chú người nói (Speaker Notes) của slide.
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const fa = require("react-icons/fa");

const GOC = path.resolve(__dirname, "..", "..");
const DOCS = path.join(GOC, "docs");
const DG = path.join(DOCS, "diagrams");
const RA = path.join(GOC, "THUYET-TRINH-IE402-Cham-cong-dinh-vi-3D.pptx");
const ND = JSON.parse(fs.readFileSync(path.join(__dirname, "noi-dung.json"), "utf8"));

// applyTheme của skill pptx (ghi màu theme vào tệp); không có thì bỏ qua.
// Nó cần tìm thấy pptxgenjs/jszip cài trong thư mục này.
process.env.NODE_PATH = path.join(__dirname, "node_modules");
require("module").Module._initPaths();
let applyTheme = null;
for (const p of [
  process.env.PPTX_APPLY_THEME,
  path.join(process.env.HOME || "", ".claude/skills/synced"),
]) {
  if (!p || !fs.existsSync(p)) continue;
  if (p.endsWith(".js")) { applyTheme = require(p).applyTheme; break; }
  const tim = require("child_process")
    .execSync(`find "${p}" -path "*pptx/scripts/apply_theme.js" | head -1`).toString().trim();
  if (tim) { applyTheme = require(tim).applyTheme; break; }
}

const THEME = {
  name: "IE402 MAP",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1B2230", lt1: "FFFFFF", dk2: "13294B", lt2: "EEF2F7",
    accent1: "E8622A", // cam — khối Alpha Tech, điểm nhấn
    accent2: "1A7F37", // xanh lá — HỢP LỆ
    accent3: "C98A0B", // hổ phách — NGHI NGỜ
    accent4: "C0392B", // đỏ — NGOÀI VÙNG
    accent5: "1F6FEB", // xanh dương — khối Beta Finance
    accent6: "8250DF", // tím — khối Gamma Media
    hlink: "1F6FEB", folHlink: "8250DF",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13,333" x 7,5"
pres.author = "Nhóm 1 — IE402";
pres.title = ND.tieu_de;
pres.subject = ND.mon;
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const W = 13.333, H = 7.5, LE = 0.6;

/* ------------------------------------------------------------------ *
 * Bố cục (layout)
 * ------------------------------------------------------------------ */
pres.defineSlideMaster({
  title: "BIA",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: LE, y: 1.45, w: 7.4, h: 2.0,
      fontFace: THEME.headFontFace, fontSize: 40, bold: true, color: C.background1, valign: "bottom", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: LE, y: 3.55, w: 7.4, h: 0.9,
      fontSize: 18, color: C.background2, valign: "top", align: "left" }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "PHAN",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "body", type: "body", x: LE, y: 2.2, w: 3, h: 1.2,
      fontFace: THEME.headFontFace, fontSize: 60, bold: true, color: C.accent1, align: "left" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: LE, y: 3.4, w: 11, h: 1.2,
      fontFace: THEME.headFontFace, fontSize: 40, bold: true, color: C.background1, align: "left" }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "NOI_DUNG",
  background: { color: C.background1 },
  margin: [0.4, LE, 0.6, LE],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: LE, y: 0.35, w: W - 2 * LE, h: 0.85,
      fontFace: THEME.headFontFace, fontSize: 32, bold: true, color: C.text2, valign: "middle" }, text: "" } },
    { text: { text: "IE402 · Nhóm 1 · Chấm công định vị 3D",
      options: { x: LE, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: "6B7785", margin: 0 } } },
  ],
  slideNumber: { x: W - LE - 0.6, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: "6B7785", align: "right" },
});

/* ------------------------------------------------------------------ *
 * Tiện ích
 * ------------------------------------------------------------------ */
async function icon(Comp, mau, kich = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Comp, { color: "#" + mau, size: kich }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

async function kichThuoc(f) {
  const m = await sharp(f).metadata();
  return [m.width, m.height];
}

// Đặt ảnh vừa khung (x, y, w, h), giữ tỉ lệ, căn giữa trong khung.
async function anh(slide, f, x, y, w, h, ten, canh = "giua") {
  const [pw, ph] = await kichThuoc(f);
  let ww = w, hh = w * ph / pw;
  if (hh > h) { hh = h; ww = h * pw / ph; }
  const xx = canh === "trai" ? x : x + (w - ww) / 2;
  const yy = canh === "tren" ? y : y + (h - hh) / 2;
  slide.addImage({ path: f, x: xx, y: yy, w: ww, h: hh, objectName: ten,
    altText: ten, shadow: { type: "outer", color: "000000", opacity: 0.18, blur: 6, offset: 2, angle: 90 } });
  return { x: xx, y: yy, w: ww, h: hh };
}

async function anhCat(slide, f, cat, x, y, w, h, ten) {
  const buf = await sharp(f).extract(cat).png().toBuffer();
  let ww = w, hh = w * cat.height / cat.width;
  if (hh > h) { hh = h; ww = h * cat.width / cat.height; }
  slide.addImage({ data: "image/png;base64," + buf.toString("base64"),
    x: x + (w - ww) / 2, y: y + (h - hh) / 2, w: ww, h: hh, objectName: ten, altText: ten });
}

function the(slide, x, y, w, h, ten, mau = C.background2) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.12, fill: { color: mau }, line: { color: mau, width: 0 }, objectName: ten,
  });
}

function vongIcon(slide, x, y, d, mau, data, ten) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: mau }, line: { color: mau, width: 0 },
    objectName: ten + " (nền)" });
  const p = d * 0.26;
  slide.addImage({ data, x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, objectName: ten, altText: ten });
}

function chu(slide, text, o) {
  slide.addText(text, Object.assign({ isTextBox: true, margin: 0, fontSize: 16, color: C.text1, valign: "top" }, o));
}

let soSlide = 0;
function slideMoi(layout, tenPhan) {
  const nd = ND.slides[soSlide];
  soSlide += 1;
  const s = pres.addSlide({ masterName: layout, sectionTitle: tenPhan });
  s.addNotes("[" + nd.nguoi + " · ~" + nd.giay + " giây] " + nd.loi);
  return s;
}

function bang(slide, header, rows, o) {
  const tieuDe = header.map((t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text2 } } }));
  const than = rows.map((r, i) => r.map((c) => (typeof c === "object" ? c : {
    text: String(c), options: { fill: { color: i % 2 ? C.background1 : C.background2 } } })));
  slide.addTable([tieuDe].concat(than), Object.assign({
    fontSize: 14, color: C.text1, border: { type: "solid", pt: 0.75, color: "D0D7DE" },
    valign: "middle", margin: [0.06, 0.1, 0.06, 0.1],
  }, o));
}

/* ------------------------------------------------------------------ *
 * Slide
 * ------------------------------------------------------------------ */
(async () => {
  const I = {};
  const DS = {
    building: [fa.FaBuilding, HEX.lt1], layer: [fa.FaLayerGroup, HEX.lt1], warn: [fa.FaExclamationTriangle, HEX.lt1],
    chart: [fa.FaChartBar, HEX.lt1], cube: [fa.FaCube, HEX.lt1], server: [fa.FaServer, HEX.lt1],
    db: [fa.FaDatabase, HEX.lt1], globe: [fa.FaGlobeAsia, HEX.lt1], stair: [fa.FaSortAmountUp, HEX.lt1],
    run: [fa.FaRunning, HEX.lt1], crosshair: [fa.FaCrosshairs, HEX.lt1], mobile: [fa.FaMobileAlt, HEX.lt1],
    pen: [fa.FaDrawPolygon, HEX.lt1], ban: [fa.FaBan, HEX.lt1], eye: [fa.FaEye, HEX.lt1],
    user: [fa.FaUserCircle, HEX.lt1], check: [fa.FaCheck, HEX.lt1], wifi: [fa.FaBroadcastTower, HEX.lt1],
    person: [fa.FaUser, HEX.lt1],
  };
  for (const k of Object.keys(DS)) I[k] = await icon(DS[k][0], DS[k][1]);

  /* 1 — Bìa ------------------------------------------------------------ */
  pres.addSection({ title: "Mở đầu" });
  let s = slideMoi("BIA", "Mở đầu");
  s.addText([{ text: "Hệ thống chấm công", options: { breakLine: true } }, { text: "định vị 3D" }], { placeholder: "title" });
  s.addText("theo mô hình khối không gian phân tầng (MAP)", { placeholder: "body" });
  chu(s, ND.mon + "\nGVHD: " + ND.gvhd, { x: LE, y: 4.55, w: 7.2, h: 0.75, fontSize: 14, color: "C9D3E0" });
  chu(s, [{ text: ND.nhom + "   ", options: { bold: true, color: C.accent1 } }].concat(
    ND.thanh_vien.map((t, i) => ({ text: t.ten + " (" + t.mssv + ")" + (i < 3 ? "  ·  " : ""),
      options: { color: C.background1 } }))),
  { x: LE, y: 5.6, w: 7.4, h: 0.8, fontSize: 13 });
  await anhCat(s, path.join(DOCS, "03-app-cham-cong.png"), { left: 798, top: 52, width: 240, height: 600 },
    8.4, 0.5, 4.4, 6.5, "Toà nhà IFC One Saigon dựng LOD3 với ba khối MAP");

  /* 2 — Vấn đề ------------------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Mở đầu");
  s.addText("Hàng rào 2D không biết bạn ở tầng nào", { placeholder: "title" });
  // mặt cắt toà nhà
  const bx = 0.9, by = 1.55, bw = 2.4, bh = 5.1, so = 24;
  s.addShape(pres.shapes.RECTANGLE, { x: bx, y: by, w: bw, h: bh, fill: { color: C.background2 },
    line: { color: "8C959F", width: 1 }, objectName: "Mặt cắt toà nhà" });
  for (let t = 1; t < so; t++) {
    s.addShape(pres.shapes.LINE, { x: bx, y: by + bh - t * bh / so, w: bw, h: 0,
      line: { color: "C9D1D9", width: 0.5 }, objectName: "Sàn " + t });
  }
  const tang = (t) => by + bh - t * bh / so;
  s.addShape(pres.shapes.RECTANGLE, { x: bx, y: tang(8), w: bw, h: 4 * bh / so, fill: { color: C.accent1, transparency: 55 },
    line: { color: C.accent1, width: 1.5 }, objectName: "Dải tầng 5–8 Alpha Tech" });
  s.addShape(pres.shapes.RECTANGLE, { x: bx, y: tang(22), w: bw, h: bh / so, fill: { color: C.accent5, transparency: 45 },
    line: { color: C.accent5, width: 1.5 }, objectName: "Tầng 22" });
  vongIcon(s, bx + bw / 2 - 0.17, tang(5.5) - 0.17, 0.34, C.accent1, I.person, "Nhân viên ở tầng 5");
  vongIcon(s, bx + bw / 2 - 0.17, tang(21.5) - 0.17, 0.34, C.accent5, I.person, "Nhân viên ở tầng 22");
  s.addShape(pres.shapes.LINE, { x: bx + bw / 2, y: tang(21.5) + 0.2, w: 0, h: tang(5.5) - tang(21.5) - 0.4,
    line: { color: C.text1, width: 1.25, dashType: "dash" }, objectName: "Cùng toạ độ ngang" });
  chu(s, "Tầng 22", { x: bx + bw + 0.12, y: tang(22) - 0.05, w: 1.3, h: 0.3, fontSize: 13, bold: true, color: C.accent5 });
  chu(s, "Tầng 5–8\nAlpha Tech", { x: bx + bw + 0.12, y: tang(8), w: 1.4, h: 0.6, fontSize: 13, bold: true, color: C.accent1 });
  chu(s, "cùng (kinh độ, vĩ độ)", { x: bx + bw + 0.12, y: tang(15), w: 1.6, h: 0.5, fontSize: 12, italic: true, color: "57606A" });
  // nội dung bên phải
  const rx = 5.4;
  chu(s, "IFC One Saigon — 42 tầng, nhiều công ty thuê cùng lúc", { x: rx, y: 1.6, w: 7.3, h: 0.45, fontSize: 18, bold: true, color: C.text2 });
  const ds2 = [
    ["Hàng rào 2D", "Chỉ hỏi: điểm có nằm trong đa giác văn phòng không?", C.accent4, I.crosshair],
    ["Tầng 5 và tầng 22", "Cùng kinh độ, vĩ độ → hệ 2D chấp nhận cả hai", C.accent3, I.layer],
    ["Hệ quả", "Ngồi ở văn phòng công ty khác vài chục tầng vẫn được ghi công", C.accent1, I.warn],
  ];
  ds2.forEach((d, i) => {
    const y = 2.35 + i * 1.3;
    the(s, rx, y, 7.3, 1.1, "Thẻ " + d[0]);
    vongIcon(s, rx + 0.25, y + 0.2, 0.7, d[2], d[3], "Biểu tượng " + d[0]);
    chu(s, d[0], { x: rx + 1.2, y: y + 0.15, w: 5.9, h: 0.4, fontSize: 18, bold: true, color: C.text2 });
    chu(s, d[1], { x: rx + 1.2, y: y + 0.55, w: 5.9, h: 0.45, fontSize: 15 });
  });
  chu(s, "Thiếu một chiều: chiều cao.", { x: rx, y: 6.3, w: 7.3, h: 0.45, fontSize: 18, italic: true, bold: true, color: C.accent1 });

  /* 3 — Mục tiêu ------------------------------------------------------ */
  s = slideMoi("NOI_DUNG", "Mở đầu");
  s.addText("Mục tiêu đề tài", { placeholder: "title" });
  const mt = [
    ["Điểm thuộc khối", "Chuyển phép kiểm tra từ “điểm thuộc đa giác” sang “điểm thuộc khối” để xác thực được tầng.", C.accent5, I.cube],
    ["Phát hiện bất thường", "Ba trạng thái HỢP LỆ · NGHI NGỜ · NGOÀI VÙNG và bốn quy tắc R1–R4 thay cho đúng/sai.", C.accent3, I.warn],
    ["Quản lý & trực quan 3D", "Thêm / sửa / xoá, thống kê dữ liệu nền; bản đồ 3D mức chi tiết 3 (LOD3).", C.accent2, I.building],
  ];
  mt.forEach((d, i) => {
    const x = LE + i * 4.12, y = 1.75, w = 3.85, h = 4.6;
    the(s, x, y, w, h, "Mục tiêu " + (i + 1));
    vongIcon(s, x + 0.35, y + 0.4, 1.0, d[2], d[3], "Biểu tượng mục tiêu " + (i + 1));
    chu(s, "0" + (i + 1), { x: x + w - 1.2, y: y + 0.45, w: 0.9, h: 0.8, fontSize: 36, bold: true, color: "C9D1D9", align: "right",
      fontFace: THEME.headFontFace });
    chu(s, d[0], { x: x + 0.35, y: y + 1.7, w: w - 0.7, h: 0.5, fontSize: 21, bold: true, color: C.text2 });
    chu(s, d[1], { x: x + 0.35, y: y + 2.35, w: w - 0.7, h: 2.0, fontSize: 16 });
  });

  /* 4 — Phần 01 ------------------------------------------------------- */
  pres.addSection({ title: "Phân tích và mô hình hoá" });
  s = slideMoi("PHAN", "Phân tích và mô hình hoá");
  s.addText("01", { placeholder: "body" });
  s.addText("Phân tích và mô hình hoá", { placeholder: "title" });

  /* 5 — So sánh mô hình ---------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Phân tích và mô hình hoá");
  s.addText("So sánh các mô hình dữ liệu 3D đã học", { placeholder: "title" });
  chu(s, "B-REP · Voxel · CSG · Tổ hợp — bài toán chỉ cần một lăng trụ đứng có đáy là mặt sàn được thuê",
    { x: LE, y: 1.3, w: 12, h: 0.4, fontSize: 15, italic: true, color: "57606A" });
  const noiBat = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.accent1 } } });
  bang(s, ["Mô hình", "Hướng", "Nguyên tố", "Với bài toán chấm công"], [
    ["3D-FDS (Molenaar, 1990)", "B-REP", "NODE, ARC, EDGE, FACE", "Lưu thừa ARC, EDGE — dữ liệu lớn"],
    [noiBat("SSM (Zlatanova, 2000)"), noiBat("B-REP"), noiBat("NODE, FACE"), noiBat("Gọn, làm cho web 3D, có FACE IN BODY → chọn")],
    ["UDM (Coors, 2003)", "B-REP", "NODE, tam giác", "Phải tam giác hoá đáy lõm"],
    ["SUDM", "B-REP", "Chuyên biệt đô thị", "Phức tạp hơn mức cần"],
    ["3D Array / Octree", "Voxel", "Ô lập phương", "Tốn bộ nhớ, biên răng cưa"],
    ["CSG", "CSG", "Khối cơ bản", "Không tả được footprint bất quy tắc"],
    ["V-3D", "Tổ hợp", "NODE, EDGE, FACET + ảnh", "Không cần ảnh mặt dựng"],
  ], { x: LE, y: 1.85, w: 12.1, colW: [3.0, 1.3, 3.0, 4.8], rowH: 0.56 });

  /* 6 — SSM ----------------------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Phân tích và mô hình hoá");
  s.addText("Lựa chọn: SSM làm mô hình logic", { placeholder: "title" });
  await anh(s, path.join(DG, "08-ssm-map.png"), LE, 1.45, 8.3, 5.2, "Mô hình SSM áp vào khối MAP");
  const ly = [
    ["1 văn phòng = 1 BODY", "bao bởi FACE đáy, FACE nắp và n mặt bên"],
    ["Chỉ NODE + FACE", "không cần ARC, EDGE như 3D-FDS"],
    ["Cho web 3D", "đúng môi trường ArcGIS JS trên trình duyệt"],
    ["Điều chỉnh", "nới ràng buộc FACE lồi cho đáy và nắp (footprint thật lõm)"],
  ];
  ly.forEach((d, i) => {
    const y = 1.55 + i * 1.28;
    the(s, 9.2, y, 3.55, 1.12, "Lý do " + (i + 1));
    chu(s, d[0], { x: 9.42, y: y + 0.13, w: 3.15, h: 0.38, fontSize: 16, bold: true, color: i === 3 ? C.accent1 : C.text2 });
    chu(s, d[1], { x: 9.42, y: y + 0.52, w: 3.15, h: 0.55, fontSize: 13 });
  });

  /* 7 — Dung lượng ------------------------------------------------------ */
  s = slideMoi("NOI_DUNG", "Phân tích và mô hình hoá");
  s.addText("Dung lượng: lưu gọn, trải ra SSM khi cần", { placeholder: "title" });
  const so7 = [
    ["564 B", "Hình hộp chữ nhật lưu theo SSM", "8 NODE · 6 FACE · 24 NODE ON FACE", C.accent5],
    ["2.468 B", "Khối Alpha Tech (đáy 18 đỉnh) theo SSM", "36 NODE · 20 FACE · 108 NODE ON FACE", C.accent6],
    ["≈ 340 B", "Khối MAP lưu gọn (P, z_min, z_max, δxy, δz)", "nhỏ hơn khoảng 7 lần", C.accent1],
  ];
  so7.forEach((d, i) => {
    const x = LE + i * 4.12;
    the(s, x, 1.7, 3.85, 3.3, "Số liệu " + (i + 1));
    chu(s, d[0], { x: x + 0.3, y: 1.95, w: 3.25, h: 1.2, fontSize: 60, bold: true, color: d[3], fontFace: THEME.headFontFace });
    chu(s, d[1], { x: x + 0.3, y: 3.25, w: 3.25, h: 0.8, fontSize: 16, bold: true, color: C.text2 });
    chu(s, d[2], { x: x + 0.3, y: 4.15, w: 3.25, h: 0.6, fontSize: 14, color: "57606A" });
  });
  chu(s, [
    { text: "Cách tính theo tài liệu ví dụ môn học: ", options: { bold: true } },
    { text: "mã 4 byte, toạ độ 8 byte — NODE(#NID, X, Y, Z) 28 B · FACE(#FID, BID) 8 B · NODE_ON_FACE(#FID, #NID, thứ tự) 12 B. " },
    { text: "Số liệu khối Alpha lấy trực tiếp từ hàm ssm_cua_khoi() trong CSDL.", options: { italic: true } },
  ], { x: LE, y: 5.35, w: 12.1, h: 1.1, fontSize: 15 });

  /* 8 — Mô hình MAP --------------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Phân tích và mô hình hoá");
  s.addText("Mô hình MAP — khối chấm công phân tầng", { placeholder: "title" });
  the(s, LE, 1.5, 6.3, 5.1, "Định nghĩa MAP", C.text2);
  chu(s, "MAP = ( P, z_min, z_max, δxy, δz )", { x: LE + 0.35, y: 1.8, w: 5.8, h: 0.6, fontSize: 24, bold: true,
    color: C.background1, fontFace: "Cambria" });
  chu(s, [
    { text: "z_min = z_nền + (tầng_đầu − 1) × h_tầng", options: { breakLine: true } },
    { text: "z_max = z_nền + tầng_cuối × h_tầng" },
  ], { x: LE + 0.35, y: 2.6, w: 5.8, h: 0.8, fontSize: 16, color: "F9C784", fontFace: "Courier New" });
  chu(s, [
    { text: "Kiểm tra hai bước:", options: { bold: true, breakLine: true } },
    { text: "1.  Q.xy ∈ buffer(P, δxy)", options: { breakLine: true } },
    { text: "2.  z_min − δz ≤ Q.z ≤ z_max + δz", options: { breakLine: true } },
    { text: "z suy ra bằng trigger, không nhập tay", options: { italic: true, color: "C9D3E0" } },
  ], { x: LE + 0.35, y: 3.65, w: 5.8, h: 2.7, fontSize: 17, color: C.background1, paraSpaceAfter: 6 });
  const tt = [
    ["HỢP LỆ", "Thoả cả điều kiện ngang và đứng", "Ghi công bình thường", C.accent2],
    ["NGHI NGỜ", "Đúng toà nhà, sai tầng", "Trạng thái hệ 2D không sinh ra được", C.accent3],
    ["NGOÀI VÙNG", "Không thoả điều kiện ngang", "Từ chối, mời gửi giải trình", C.accent4],
  ];
  tt.forEach((d, i) => {
    const y = 1.5 + i * 1.75;
    the(s, 7.2, y, 5.55, 1.55, "Trạng thái " + d[0]);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.45, y: y + 0.42, w: 1.9, h: 0.7, rectRadius: 0.35,
      fill: { color: d[3] }, line: { color: d[3], width: 0 }, objectName: "Nhãn " + d[0] });
    chu(s, d[0], { x: 7.45, y: y + 0.42, w: 1.9, h: 0.7, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
    chu(s, d[1], { x: 9.55, y: y + 0.18, w: 3.1, h: 0.62, fontSize: 15, bold: true, color: C.text2, valign: "bottom" });
    chu(s, d[2], { x: 9.55, y: y + 0.88, w: 3.1, h: 0.55, fontSize: 13.5 });
  });

  /* 9 — R1–R4 ---------------------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Phân tích và mô hình hoá");
  s.addText("Bốn quy tắc phát hiện bất thường", { placeholder: "title" });
  const qt = [
    ["R1", "Sai tầng", "Lệch cao độ so với dải khối, quy ra số tầng — mức CAO", C.accent1, I.stair],
    ["R2", "Dịch chuyển bất khả thi", "Vận tốc giữa hai lần chấm công > 150 km/h — hàm kiem_tra_r2() trong PostGIS", C.accent4, I.run],
    ["R3", "Độ chính xác bất thường", "accuracy < 1 m (nghi giả lập GPS) hoặc > 100 m (không đủ tin cậy)", C.accent3, I.crosshair],
    ["R4", "Trùng thiết bị", "Cùng định danh thiết bị, khác nhân viên, trong vòng 10 phút", C.accent6, I.mobile],
  ];
  qt.forEach((d, i) => {
    const x = LE + (i % 2) * 6.15, y = 1.6 + Math.floor(i / 2) * 2.55, w = 5.95, h = 2.3;
    the(s, x, y, w, h, "Quy tắc " + d[0]);
    vongIcon(s, x + 0.35, y + 0.4, 1.0, d[3], d[4], "Biểu tượng " + d[0]);
    chu(s, d[0] + " · " + d[1], { x: x + 1.65, y: y + 0.4, w: w - 1.95, h: 0.5, fontSize: 20, bold: true, color: C.text2 });
    chu(s, d[2], { x: x + 1.65, y: y + 1.0, w: w - 1.95, h: 1.1, fontSize: 15 });
  });

  /* 10 — ERD ----------------------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Phân tích và mô hình hoá");
  s.addText("Sơ đồ quan hệ thực thể", { placeholder: "title" });
  await anh(s, path.join(DG, "01-erd.png"), LE, 1.3, 5.6, 5.55, "Sơ đồ ERD", "trai");
  const so10 = [["14", "bảng"], ["8", "hàm PL/pgSQL"], ["4", "trigger"]];
  so10.forEach((d, i) => {
    const x = 6.7 + i * 2.05;
    chu(s, d[0], { x, y: 1.5, w: 1.9, h: 1.0, fontSize: 54, bold: true, color: C.accent1, fontFace: THEME.headFontFace });
    chu(s, d[1], { x, y: 2.5, w: 1.9, h: 0.4, fontSize: 15, color: "57606A" });
  });
  const nhom = [
    ["Tổ chức", "công ty · phòng ban"],
    ["Không gian", "toà nhà · văn phòng · khối chấm công (MAP)"],
    ["Nhân sự", "nhân viên · vai trò · tài khoản · thiết bị · ca · phân ca"],
    ["Chấm công", "bản ghi PointZ · cảnh báo R1–R4 · đơn giải trình"],
  ];
  nhom.forEach((d, i) => {
    const y = 3.2 + i * 0.85;
    the(s, 6.7, y, 6.05, 0.72, "Nhóm " + d[0]);
    chu(s, d[0], { x: 6.9, y: y + 0.17, w: 1.6, h: 0.4, fontSize: 15, bold: true, color: C.text2 });
    chu(s, d[1], { x: 8.5, y: y + 0.17, w: 4.15, h: 0.4, fontSize: 14 });
  });

  /* 11 — Use case + luồng --------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Phân tích và mô hình hoá");
  s.addText("Use case và luồng chấm công", { placeholder: "title" });
  await anh(s, path.join(DG, "02-usecase.png"), LE, 1.3, 4.2, 5.4, "Sơ đồ use case");
  await anh(s, path.join(DG, "05-sd1-cham-cong.png"), 5.1, 1.3, 7.6, 4.8, "Sơ đồ trình tự chấm công");
  chu(s, "Kiểm tra bao hàm, áp R1–R4, ghi bản ghi và cảnh báo trong một giao dịch",
    { x: 5.1, y: 6.25, w: 7.6, h: 0.4, fontSize: 14, italic: true, color: "57606A", align: "center" });

  /* 12 — Phần 02 ------------------------------------------------------- */
  pres.addSection({ title: "Thiết kế ứng dụng" });
  s = slideMoi("PHAN", "Thiết kế ứng dụng");
  s.addText("02", { placeholder: "body" });
  s.addText("Thiết kế ứng dụng", { placeholder: "title" });

  /* 13 — Kiến trúc ----------------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Thiết kế ứng dụng");
  s.addText("Kiến trúc và công nghệ", { placeholder: "title" });
  const kt = [
    ["Trình duyệt", "ArcGIS Maps SDK 4.29\nSceneView · SketchViewModel\nHTML/JS thuần · Geolocation API", C.accent5, I.globe],
    ["Máy chủ", "Node.js + Express 5\nJWT · 3 vai trò\nAPI chấm công + quản trị", C.accent1, I.server],
    ["CSDL không gian", "PostgreSQL 17 + PostGIS 3.5\nkiem_tra_bao_ham() · kiem_tra_r2()\ntrigger · ssm_cua_khoi()", C.accent2, I.db],
  ];
  kt.forEach((d, i) => {
    const x = LE + i * 4.25, y = 1.7, w = 3.6, h = 3.6;
    the(s, x, y, w, h, "Lớp " + d[0]);
    vongIcon(s, x + w / 2 - 0.55, y + 0.35, 1.1, d[2], d[3], "Biểu tượng " + d[0]);
    chu(s, d[0], { x: x + 0.2, y: y + 1.6, w: w - 0.4, h: 0.45, fontSize: 20, bold: true, color: C.text2, align: "center" });
    chu(s, d[1], { x: x + 0.2, y: y + 2.15, w: w - 0.4, h: 1.3, fontSize: 14, align: "center" });
    if (i < 2) {
      s.addShape(pres.shapes.RIGHT_ARROW, { x: x + w + 0.1, y: y + h / 2 - 0.25, w: 0.45, h: 0.5,
        fill: { color: "8C959F" }, line: { color: "8C959F", width: 0 }, objectName: "Mũi tên " + (i + 1) });
    }
  });
  chu(s, [
    { text: "Một cổng duy nhất ", options: { bold: true, color: C.text2 } },
    { text: "— máy chủ phục vụ luôn giao diện web, vì Geolocation API chỉ cấp quyền trên HTTPS hoặc localhost. " },
    { text: "Logic không gian và ràng buộc đặt trong CSDL, ", options: { bold: true, color: C.text2 } },
    { text: "cạnh dữ liệu: một bản duy nhất, sửa bằng giao diện hay SQL đều được kiểm tra." },
  ], { x: LE, y: 5.65, w: 12.1, h: 1.0, fontSize: 15 });

  /* 14 — LOD1 vs LOD3 --------------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Thiết kế ứng dụng");
  s.addText("LOD3 để hiển thị, LOD1 để tính toán", { placeholder: "title" });
  const k14a = await anh(s, path.join(DOCS, "06-lod3.png"), LE, 2.0, 5.95, 4.2, "Toà nhà dựng ở LOD3", "tren");
  const k14b = await anh(s, path.join(DOCS, "07-lod1.png"), 6.78, 2.0, 5.95, 4.2, "Toà nhà dựng ở LOD1", "tren");
  chu(s, "LOD3 — kiến trúc mặt ngoài", { x: k14a.x, y: 1.45, w: k14a.w, h: 0.4, fontSize: 17, bold: true, color: C.accent1 });
  chu(s, "LOD1 — khối đùn trơn", { x: k14b.x, y: 1.45, w: k14b.w, h: 0.4, fontSize: 17, bold: true, color: C.text2 });
  chu(s, "Khối đế, vách kính, dầm từng tầng, khung đứng, lối vào, mái — lồng bên trong là ba khối MAP",
    { x: k14a.x, y: k14a.y + k14a.h + 0.2, w: k14a.w, h: 0.7, fontSize: 15, color: "57606A" });
  chu(s, "Phép kiểm tra bao hàm chỉ cần đa giác nền và dải cao độ — chi tiết mặt dựng không đổi kết quả",
    { x: k14b.x, y: k14b.y + k14b.h + 0.2, w: k14b.w, h: 0.7, fontSize: 15, color: "57606A" });

  /* 15 — CityGML -------------------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Thiết kế ứng dụng");
  s.addText("Thành phần LOD3 theo CityGML", { placeholder: "title" });
  bang(s, ["Thành phần (sinh tự động từ CSDL)", "Lớp CityGML"], [
    ["Băng tường đá khối đế, dầm biên từng tầng, tường chắn mái", "WallSurface"],
    ["Băng cửa kính khối đế, vách kính thân tháp", "Window"],
    ["Cửa xoay, hai cửa kính sảnh (giữa cạnh dài nhất)", "Door"],
    ["Mái khối đế, sàn mái tum, sân đỗ trực thăng", "RoofSurface"],
    ["Khung nhôm, mái sảnh, cột, tum kỹ thuật, thiết bị mái", "BuildingInstallation"],
  ], { x: LE, y: 1.5, w: 7.6, colW: [5.2, 2.4], rowH: 0.72 });
  chu(s, "Đầu vào: footprint · cao độ nền · số tầng · chiều cao tầng · số tầng đế. Thêm toà nhà mới là tự có LOD3; bấm vào thành phần nào cũng hiện lớp của nó.",
    { x: LE, y: 6.0, w: 7.6, h: 0.75, fontSize: 14, italic: true, color: "57606A" });
  await anhCat(s, path.join(DOCS, "03-app-cham-cong.png"), { left: 798, top: 52, width: 240, height: 590 },
    8.6, 1.4, 4.1, 5.35, "Cận cảnh toà nhà LOD3");

  /* 16 — Quản trị -------------------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Thiết kế ứng dụng");
  s.addText("Quản trị: thêm, sửa, xoá dữ liệu nền", { placeholder: "title" });
  await anh(s, path.join(DOCS, "05-quan-tri-khoi-map.png"), LE, 1.4, 8.4, 5.3, "Tab Quản trị đang sửa khối MAP", "trai");
  const qtri = [
    ["6 loại dữ liệu", "toà nhà · văn phòng & khối MAP · nhân viên · ca · công ty · phòng ban", I.layer, C.accent5],
    ["Vẽ trên bản đồ 3D", "footprint và đa giác khối bằng SketchViewModel, xem trước ngay", I.pen, C.accent1],
    ["CSDL tự chặn", "văn phòng vượt số tầng toà nhà, trùng tài khoản, xoá dữ liệu đang dùng", I.ban, C.accent4],
  ];
  qtri.forEach((d, i) => {
    const y = 1.45 + i * 1.75;
    the(s, 9.25, y, 3.5, 1.55, "Điểm " + (i + 1));
    vongIcon(s, 9.45, y + 0.2, 0.6, d[3], d[2], "Biểu tượng " + d[0]);
    chu(s, d[0], { x: 10.2, y: y + 0.27, w: 2.45, h: 0.45, fontSize: 16, bold: true, color: C.text2 });
    chu(s, d[1], { x: 9.45, y: y + 0.85, w: 3.15, h: 0.65, fontSize: 12.5 });
  });

  /* 17 — Phần 03 -------------------------------------------------------- */
  pres.addSection({ title: "Kết quả" });
  s = slideMoi("PHAN", "Kết quả");
  s.addText("03", { placeholder: "body" });
  s.addText("Kết quả", { placeholder: "title" });

  /* 18 — Ba tình huống -------------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Kết quả");
  s.addText("Ba tình huống trên toà nhà thật", { placeholder: "title" });
  const nhan = (t, m) => ({ text: t, options: { bold: true, color: m } });
  bang(s, ["Tình huống", "Cao độ", "Hệ 3D (MAP)", "Hàng rào 2D"], [
    ["Alpha Tech chấm công ở tầng 6", "30,58 m", nhan("HỢP LỆ", C.accent2), "hợp lệ"],
    ["Cùng toạ độ, khai báo tầng 22", "104,98 m", nhan("NGHI NGỜ + R1", C.accent3),
      { text: "hợp lệ — bỏ sót", options: { bold: true, color: C.accent4 } }],
    ["Cách toà nhà vài trăm mét", "30,58 m", nhan("NGOÀI VÙNG", C.accent4), "ngoài vùng"],
  ], { x: LE, y: 1.6, w: 8.0, colW: [3.4, 1.3, 1.9, 1.4], rowH: 0.75, fontSize: 15 });
  the(s, 9.0, 1.6, 3.75, 4.6, "Số liệu nổi bật", C.text2);
  chu(s, "13,5", { x: 9.25, y: 1.9, w: 3.25, h: 1.4, fontSize: 72, bold: true, color: C.accent1, fontFace: THEME.headFontFace });
  chu(s, "tầng lệch", { x: 9.25, y: 3.3, w: 3.25, h: 0.45, fontSize: 20, bold: true, color: C.background1 });
  chu(s, "+62,78 m so với dải 23,60–42,20 m của Alpha Tech — cùng kinh độ, vĩ độ với tình huống 1",
    { x: 9.25, y: 3.9, w: 3.25, h: 1.9, fontSize: 15, color: "C9D3E0" });
  chu(s, "Tình huống 2 là kết quả quan trọng nhất: hàng rào 2D kết luận hợp lệ, mô hình MAP phát hiện sai tầng.",
    { x: LE, y: 5.0, w: 8.0, h: 1.0, fontSize: 17, bold: true, italic: true, color: C.text2 });

  /* 19 — Màn hình sai tầng --------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Kết quả");
  s.addText("Màn hình tình huống sai tầng", { placeholder: "title" });
  const k19 = await anh(s, path.join(DOCS, "02-ket-qua-nghi-ngo.png"), LE, 1.3, 9.3, 5.45, "Kết quả NGHI NGỜ trên ứng dụng", "trai");
  const ch19 = [
    ["Tấm sàn tầng 22", "nằm trong dải xanh của Beta Finance, xa dải cam của Alpha Tech"],
    ["Ngang ≈ 0 m", "khoảng cách ngang tới khối — hàng rào 2D chấp nhận"],
    ["Lệch +62,78 m", "R1 mức CAO: ≈ 13,5 tầng"],
  ];
  ch19.forEach((d, i) => {
    const y = 1.4 + i * 1.75;
    the(s, k19.x + k19.w + 0.3, y, W - LE - (k19.x + k19.w + 0.3), 1.55, "Chú thích " + (i + 1));
    chu(s, d[0], { x: k19.x + k19.w + 0.5, y: y + 0.18, w: W - LE - (k19.x + k19.w + 0.7), h: 0.45, fontSize: 16, bold: true, color: C.accent1 });
    chu(s, d[1], { x: k19.x + k19.w + 0.5, y: y + 0.68, w: W - LE - (k19.x + k19.w + 0.7), h: 0.8, fontSize: 13.5 });
  });

  /* 20 — Kiểm thử + yêu cầu ------------------------------------------- */
  s = slideMoi("NOI_DUNG", "Kết quả");
  s.addText("Kiểm thử tự động và yêu cầu môn học", { placeholder: "title" });
  the(s, LE, 1.5, 3.9, 5.15, "Kết quả kiểm thử", C.background2);
  vongIcon(s, LE + 0.3, 1.8, 0.8, C.accent2, I.check, "Biểu tượng đạt");
  chu(s, "34/34", { x: LE + 0.3, y: 2.75, w: 3.4, h: 1.2, fontSize: 64, bold: true, color: C.accent2, fontFace: THEME.headFontFace });
  chu(s, "ca kiểm thử đầu–cuối đạt (npm test)", { x: LE + 0.3, y: 3.95, w: 3.4, h: 0.45, fontSize: 15, bold: true, color: C.text2 });
  chu(s, "API thật trên CSDL thật: ba tình huống MAP, phân quyền, thêm / sửa / xoá, ràng buộc CSDL, tự tính lại khối, trải SSM",
    { x: LE + 0.3, y: 4.5, w: 3.4, h: 1.9, fontSize: 13.5 });
  bang(s, ["Yêu cầu (Danh sách đồ án 2026)", "Đáp ứng"], [
    ["Thêm, xoá, sửa dữ liệu", "Tab Quản trị: 6 loại dữ liệu + phân ca"],
    ["Thống kê dữ liệu", "Bảng điều khiển, báo cáo công, thống kê theo khối, xuất CSV"],
    ["Hiển thị thực thể không gian", "Toà nhà, khối MAP, tấm sàn, điểm chấm công trên SceneView"],
    ["Bản đồ 3D mức chi tiết 3", "LOD3 sinh tự động, có lớp ngữ nghĩa CityGML"],
  ], { x: 4.85, y: 1.5, w: 7.9, colW: [3.1, 4.8], rowH: 1.0, fontSize: 15 });

  /* 21 — Demo ------------------------------------------------------------ */
  s = slideMoi("PHAN", "Kết quả");
  s.addText("DEMO", { placeholder: "body" });
  s.addText("Trình diễn trực tiếp", { placeholder: "title" });
  const buoc = ND.demo.buoc;
  buoc.forEach((b, i) => {
    const x = LE + (i % 3) * 4.1, y = 4.85 + Math.floor(i / 3) * 1.0;
    s.addShape(pres.shapes.OVAL, { x, y: y + 0.05, w: 0.5, h: 0.5, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 },
      objectName: "Số bước " + (i + 1) });
    chu(s, String(i + 1), { x, y: y + 0.05, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
    chu(s, b.ten, { x: x + 0.65, y: y + 0.08, w: 3.3, h: 0.5, fontSize: 15, color: C.background1, valign: "middle" });
  });

  /* 22 — Hạn chế, hướng phát triển ------------------------------------ */
  pres.addSection({ title: "Kết luận" });
  s = slideMoi("NOI_DUNG", "Kết luận");
  s.addText("Hạn chế và hướng phát triển", { placeholder: "title" });
  const hc = [
    "Độ cao GPS trong nhà rất kém → dùng tầng khai báo, hệ thống đối chiếu chứ không tự quyết",
    "Chưa dùng cảm biến bổ trợ (BLE beacon, khí áp kế)",
    "Chỉ ~3,7 % công trình TP.HCM trên OSM có thuộc tính chiều cao",
    "Không chặn hoàn toàn được giả lập GPS từ phía web",
  ];
  const hpt = [
    "Hợp nhất BLE beacon và khí áp kế để xác định tầng độc lập với GPS",
    "Nâng lên LOD4 (nội thất) để chấm công theo phòng",
    "Khối MAP có chiều thời gian cho công trường đang thi công",
    "Tích hợp hệ thống tính lương và quản lý nhân sự",
  ];
  [[hc, "Hạn chế", C.accent4, I.warn], [hpt, "Hướng phát triển", C.accent2, I.building]].forEach((cot, j) => {
    const x = LE + j * 6.15;
    the(s, x, 1.5, 5.95, 5.15, cot[1]);
    vongIcon(s, x + 0.3, 1.75, 0.7, cot[2], cot[3], "Biểu tượng " + cot[1]);
    chu(s, cot[1], { x: x + 1.2, y: 1.85, w: 4.5, h: 0.5, fontSize: 21, bold: true, color: C.text2 });
    s.addText(cot[0].map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < cot[0].length - 1 } })),
      { isTextBox: true, x: x + 0.3, y: 2.7, w: 5.35, h: 3.8, fontSize: 16, color: C.text1, valign: "top", paraSpaceAfter: 10, margin: 0 });
  });

  /* 23 — Cảm ơn --------------------------------------------------------- */
  s = slideMoi("BIA", "Kết luận");
  s.addText("Cảm ơn thầy và các bạn", { placeholder: "title" });
  s.addText("Nhóm 1 xin nhận câu hỏi", { placeholder: "body" });
  chu(s, "“Điểm thuộc đa giác” → “điểm thuộc khối”: một trạng thái mới — đúng toà nhà, sai tầng — mà mô hình hai chiều không có dữ liệu để phát hiện.",
    { x: LE, y: 4.7, w: 7.2, h: 1.3, fontSize: 16, italic: true, color: "C9D3E0" });
  await anhCat(s, path.join(DOCS, "02-ket-qua-nghi-ngo.png"), { left: 798, top: 52, width: 240, height: 600 },
    8.4, 0.5, 4.4, 6.5, "Toà nhà với tấm sàn tầng 22 nằm ngoài dải của Alpha Tech");

  if (soSlide !== ND.slides.length) {
    throw new Error("Số slide (" + soSlide + ") khác số mục lời nói (" + ND.slides.length + ")");
  }
  await pres.writeFile({ fileName: RA });
  if (applyTheme) await applyTheme(RA, THEME);
  else console.warn("Không tìm thấy apply_theme.js — màu theme sẽ là bảng màu mặc định của Office");
  console.log("DONE ->", RA, "(" + soSlide + " slide)");
})().catch((e) => { console.error(e); process.exit(1); });
