# -*- coding: utf-8 -*-
"""
Sinh file .docx đồ án IE402 từ đúng template của thầy (Mau_do_an_IE402.docx).

Cách làm: mở template, giữ nguyên trang bìa / bảng thành viên / mục lục / phần
tài liệu tham khảo, chỉ thay các đoạn giữ chỗ dạng <...> bằng nội dung thật.

    python tools/build_docx.py
"""
import os
import copy
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(os.path.expanduser("~"), "Downloads", "Mau_do_an_IE402.docx")
# Bản mẫu nằm sẵn trong zip tài liệu môn học ở thư mục gốc repo
ZIP_TAI_LIEU = os.path.join(os.path.dirname(ROOT), "tai lieu mon 3D")
OUT = os.path.join(ROOT, "DO-AN-IE402-Cham-cong-dinh-vi-3D.docx")
DG = os.path.join(ROOT, "docs", "diagrams")
SHOT = os.path.join(ROOT, "docs")

MAX_W = 6.1          # inch — bề ngang tối đa vừa khổ A4 lề mặc định
MAX_H = 7.8          # inch — cao tối đa để ảnh không tràn sang trang sau

# Danh sách nhóm 1 — trích từ DS_IE402_F31_Danhsachlop
THANH_VIEN = [
    ("23730217", "Nguyễn Hữu Tín"),      # nhóm trưởng
    ("23730177", "Nguyễn Minh Khôi"),
    ("23730226", "Nguyễn Tường Vy"),
    ("23730204", "Võ Thành Nhân"),
]
TEN_NHOM = "Nhóm 1"

TIEU_DE = ("HỆ THỐNG CHẤM CÔNG ĐỊNH VỊ 3D\n"
           "THEO MÔ HÌNH KHỐI KHÔNG GIAN PHÂN TẦNG")


# ---------------------------------------------------------------------------
#  Hạ tầng chèn nội dung
# ---------------------------------------------------------------------------
class Builder:
    """Gom các phần tử mới rồi chèn vào trước một đoạn giữ chỗ."""

    def __init__(self, doc, anchor):
        self.doc = doc
        self.anchor = anchor          # paragraph giữ chỗ

    def _move(self, element):
        self.anchor._element.addprevious(element)

    def para(self, text="", bold=False, italic=False, size=None, align=None):
        p = self.doc.add_paragraph()
        run = p.add_run(text)
        run.bold = bold
        run.italic = italic
        if size:
            run.font.size = Pt(size)
        if align:
            p.alignment = align
        self._move(p._element)
        return p

    def heading(self, text, level=3):
        p = self.doc.add_paragraph(text, style="Heading %d" % level)
        self._move(p._element)
        return p

    def _list_para(self, style):
        """Dùng style danh sách của template nếu có, không thì tự thụt lề."""
        try:
            return self.doc.add_paragraph(style=style), True
        except KeyError:
            p = self.doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.3)
            p.paragraph_format.space_after = Pt(4)
            return p, False

    def bullets(self, items, style="List Bullet", marker="• "):
        for it in items:
            p, styled = self._list_para(style)
            prefix = "" if styled else marker
            if isinstance(it, tuple):      # (phần in đậm, phần thường)
                r = p.add_run(prefix + it[0]); r.bold = True
                p.add_run(it[1])
            else:
                p.add_run(prefix + it)
            self._move(p._element)

    def numbers(self, items):
        for i, it in enumerate(items, 1):
            p, styled = self._list_para("List Number")
            p.add_run(("" if styled else "%d. " % i) + it)
            self._move(p._element)

    def table(self, headers, rows, widths=None):
        t = self.doc.add_table(rows=1, cols=len(headers))
        t.style = "Table Grid"
        for i, h in enumerate(headers):
            cell = t.rows[0].cells[i]
            cell.text = ""
            r = cell.paragraphs[0].add_run(h)
            r.bold = True
            r.font.size = Pt(10)
        for row in rows:
            cells = t.add_row().cells
            for i, v in enumerate(row):
                cells[i].text = ""
                r = cells[i].paragraphs[0].add_run(str(v))
                r.font.size = Pt(10)
        if widths:
            for row in t.rows:
                for i, w in enumerate(widths):
                    row.cells[i].width = Inches(w)
        self._move(t._element)
        self.para()                      # đoạn trống sau bảng
        return t

    def code(self, text):
        for line in text.split("\n"):
            p = self.doc.add_paragraph()
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(line if line else " ")
            r.font.name = "Consolas"
            r.font.size = Pt(8.5)
            self._move(p._element)
        self.para()

    def image(self, filename, caption=None, max_w=MAX_W, max_h=MAX_H):
        path = filename if os.path.isabs(filename) else os.path.join(DG, filename)
        if not os.path.exists(path):
            self.para("[thiếu ảnh: %s]" % os.path.basename(path), italic=True)
            return
        w_px, h_px = Image.open(path).size
        w_in = max_w
        h_in = w_in * h_px / w_px
        if h_in > max_h:
            h_in = max_h
            w_in = h_in * w_px / h_px
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(path, width=Inches(w_in))
        self._move(p._element)
        if caption:
            c = self.doc.add_paragraph()
            c.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = c.add_run(caption)
            r.italic = True
            r.font.size = Pt(9.5)
            self._move(c._element)
        self.para()

    def finish(self):
        """Xoá đoạn giữ chỗ."""
        self.anchor._element.getparent().remove(self.anchor._element)


def fill(doc, marker, writer):
    """Tìm đoạn chứa `marker` rồi thay bằng nội dung do `writer(b)` sinh ra."""
    for p in doc.paragraphs:
        if marker in p.text:
            b = Builder(doc, p)
            writer(b)
            b.finish()
            return True
    raise SystemExit("KHÔNG tìm thấy đoạn giữ chỗ: %r" % marker)


# ---------------------------------------------------------------------------
#  Nội dung từng mục
# ---------------------------------------------------------------------------
def ch1_tong_quan(b):
    b.para("Chấm công định vị (geolocation-based attendance) là hình thức xác nhận sự "
           "có mặt của người lao động bằng toạ độ thiết bị di động, thay cho máy chấm "
           "công vân tay hoặc thẻ từ đặt cố định. Hình thức này trở nên phổ biến khi "
           "doanh nghiệp có nhiều chi nhánh, nhân viên làm việc tại công trường hoặc "
           "di chuyển liên tục — việc yêu cầu tất cả về một máy chấm công vật lý là "
           "không khả thi.")
    b.para("Hầu hết ứng dụng chấm công định vị hiện nay đều dựa trên hàng rào địa lý "
           "hai chiều (2D geofence): một hình tròn bán kính R quanh một toạ độ, hoặc "
           "một đa giác phẳng. Hệ thống chỉ trả lời được câu hỏi “người này có đứng "
           "trong vùng hay không” trên mặt phẳng, hoàn toàn bỏ qua chiều cao.")
    b.para("Đồ án xây dựng một hệ thống chấm công định vị sử dụng mô hình khối ba "
           "chiều, cho phép phân biệt vị trí người lao động theo cả chiều đứng, áp "
           "dụng cho bối cảnh toà nhà văn phòng cao tầng tại TP. Hồ Chí Minh.")


def ch1_dat_van_de(b):
    b.para("Hàng rào 2D thất bại trong chính bối cảnh mà chấm công định vị được dùng "
           "nhiều nhất — toà nhà văn phòng cao tầng ở đô thị. Bốn vấn đề cụ thể:")
    b.para("a) Không phân biệt được theo chiều cao.", bold=True)
    b.para("Một cao ốc 40 tầng có hàng chục doanh nghiệp thuê các tầng khác nhau. "
           "Nhân viên công ty A ở tầng 5 và nhân viên công ty B ở tầng 22 có cùng một "
           "toạ độ kinh độ – vĩ độ. Hàng rào 2D chấp nhận cả hai như nhau. Nghiêm "
           "trọng hơn, một người ngồi ở quán cà phê tầng trệt hoặc đang ở hầm giữ xe "
           "vẫn được ghi nhận “chấm công hợp lệ” cho văn phòng tầng 22.")
    b.para("b) Sai số GPS trong đô thị (hiệu ứng urban canyon).", bold=True)
    b.para("Tín hiệu vệ tinh bị các khối nhà cao tầng che chắn và phản xạ nhiều đường "
           "(multipath), khiến sai số ngang có thể lên tới hàng chục mét — đủ để một "
           "người đứng ở toà nhà kế bên vẫn lọt vào hàng rào. Trên mô hình 2D không "
           "có cách nào phân tích hay khoanh vùng hiện tượng này; phải có mô hình "
           "khối của các công trình xung quanh mới mô tả được vùng bị che khuất.")
    b.para("c) Không phát hiện được gian lận theo chiều đứng.", bold=True)
    b.para("Các thủ thuật phổ biến như dùng ứng dụng giả lập vị trí (fake GPS) hoặc "
           "nhờ đồng nghiệp chấm hộ ngay dưới sảnh đều tạo ra bản ghi “đúng toạ độ” "
           "nhưng sai độ cao hoặc sai quy luật di chuyển. Dữ liệu 2D không lưu giữ "
           "thông tin cần thiết để phát hiện.")
    b.para("d) Không trực quan hoá được để đối chiếu khi có tranh chấp.", bold=True)
    b.para("Khi phát sinh tranh chấp về công, người quản lý cần nhìn thấy nhân viên "
           "đã chấm công ở đâu. Một điểm trên bản đồ phẳng không cho biết điểm đó nằm "
           "trong hay ngoài khối văn phòng.")


def ch1_y_nghia(b):
    b.para("Ý nghĩa.", bold=True)
    b.para("Đề tài chuyển bài toán chấm công từ phép kiểm tra “điểm thuộc đa giác” "
           "(2D) sang phép kiểm tra “điểm thuộc khối” (3D). Nhờ đó giải quyết được "
           "lớp bài toán mà hệ thống 2D không xử lý được: phân biệt doanh nghiệp theo "
           "tầng trong cùng một cao ốc, và kiểm chứng tính hợp lệ của bản ghi chấm "
           "công theo chiều đứng. Đây cũng là minh hoạ cụ thể cho giá trị thực tiễn "
           "của việc bổ sung chiều thứ ba vào một hệ thống thông tin địa lý.")
    b.para()
    b.para("Mục tiêu cụ thể.", bold=True)
    b.table(
        ["Mã", "Mục tiêu", "Tiêu chí hoàn thành"],
        [
            ["M1", "Xây dựng mô hình dữ liệu 3D cho vùng chấm công phân tầng",
             "Mô hình MAP (mục 2.2) được định nghĩa hình thức và cài đặt trong CSDL không gian"],
            ["M2", "Cài đặt thuật toán kiểm tra bao hàm khối có xét sai số",
             "Hàm trả về ba trạng thái HỢP LỆ / NGHI NGỜ / NGOÀI VÙNG, thời gian phản hồi dưới 200 ms"],
            ["M3", "Ứng dụng web cho ba vai trò: nhân viên, quản lý, quản trị",
             "Đủ luồng chấm công – giải trình – duyệt – báo cáo"],
            ["M4", "Trực quan hoá 3D bản ghi chấm công",
             "SceneView hiển thị khối toà nhà, khối văn phòng và điểm chấm công đúng cao độ"],
            ["M5", "Phát hiện bốn dạng bất thường R1–R4",
             "Sinh cảnh báo kèm mức độ cho người quản lý"],
            ["M6", "Cho phép quản trị viên dựng khối vùng chấm công trên bản đồ 3D",
             "Công cụ vẽ đa giác nền và nhập dải tầng, hệ thống tự suy ra cao độ"],
        ],
        widths=[0.5, 2.3, 3.3])


def ch2_co_so_ly_thuyet(b):
    b.para("Mục này trình bày các nền tảng lý thuyết mà đề tài dựa vào: khái niệm GIS và GIS "
           "ba chiều, hệ toạ độ và cao độ, các mô hình dữ liệu không gian 2D và 3D đã học, chuẩn "
           "mức chi tiết CityGML, nguyên lý định vị GNSS cùng sai số của nó trong đô thị, các "
           "thuật toán kiểm tra bao hàm, và hai công nghệ nền là PostGIS và ArcGIS Maps SDK. Cuối "
           "mỗi phần là cách đề tài áp dụng lý thuyết đó.")

    # ------------------------------------------------------------------ 2.1.1
    b.heading("2.1.1. Hệ thống thông tin địa lý và GIS ba chiều", 3)
    b.para("Thuật ngữ GIS được hiểu theo ba nghĩa tuỳ trọng tâm: Geographic Information System "
           "khi nhấn mạnh hạ tầng (phần cứng, phần mềm, dữ liệu), Geographic Information Science "
           "khi nhấn mạnh lý thuyết và nguyên lý, và Geographic Information Service khi nhấn mạnh "
           "dịch vụ phục vụ kinh tế – xã hội. Theo mô hình năm thành phần, một hệ GIS gồm phần cứng, "
           "phần mềm, dữ liệu không gian và thuộc tính, con người, và quy trình – phương pháp xử lý; "
           "mô hình sáu thành phần bổ sung thêm mạng truyền thông.")
    b.para("Xét vị trí của GIS trong một ứng dụng, có ba mức: GIS giữ vai trò chính (ứng dụng mà "
           "mục đích chính là xử lý không gian), vai trò bán phần (GIS là một phần có giá trị nghiệp "
           "vụ), và chỉ là một chức năng nhỏ. Trong đề tài, GIS giữ vai trò chính: quyết định ghi "
           "công hay không được đưa ra trực tiếp từ một phép toán không gian ba chiều.")
    b.para("Các khái niệm nền tảng và cách đề tài sử dụng:", bold=True)
    b.table(
        ["Khái niệm", "Nội dung", "Áp dụng trong đề tài"],
        [
            ["Không gian", "Tập hợp đối tượng và quan hệ giữa chúng; có không gian tuyệt đối (gắn hệ "
             "toạ độ) và tương đối (theo quan hệ)", "Không gian tuyệt đối: mọi đối tượng gắn toạ độ WGS84"],
            ["Chiều", "2D; 2.5D là 2D thêm thuộc tính chiều cao; 3D; thời gian được tính là một chiều "
             "(2D + thời gian = 3D, 3D + thời gian = 4D)",
             "Khối MAP là 3D thật (có z_min, z_max); quy tắc R2 dùng thêm chiều thời gian"],
            ["Vị trí", "Bắt buộc trong mọi hệ GIS, gắn với một hệ toạ độ cụ thể",
             "Điểm chấm công là PointZ (kinh độ, vĩ độ, cao độ)"],
            ["Hình học", "2D: điểm, đường, đa giác. 3D: điểm, đường, mặt, khối",
             "Toà nhà: đa giác nền; khối MAP: khối lăng trụ; bản ghi: điểm"],
            ["Hướng", "Vector đơn vị; trong 3D có trước – sau, trái – phải, trên – dưới",
             "Hướng mặt (pháp tuyến) của FACE trong SSM; hướng cửa chính của toà nhà LOD3"],
            ["Thời gian", "Rời rạc hoặc liên tục; có thứ tự giữa các sự kiện",
             "Thứ tự các lần chấm công để tính vận tốc dịch chuyển (R2) và trùng thiết bị (R4)"],
        ],
        widths=[1.0, 2.7, 2.4])

    # ------------------------------------------------------------------ 2.1.2
    b.heading("2.1.2. Hệ toạ độ và cao độ", 3)
    b.para("Toạ độ của một điểm luôn gắn với một hệ toạ độ xác định. Đề tài dùng hai hệ:")
    b.bullets([
        ("WGS84 — EPSG:4326: ", "hệ toạ độ địa lý (kinh độ, vĩ độ tính bằng độ) trên elipxoit WGS84. "
         "Đây là hệ mà GPS và Geolocation API trả về, và là hệ lưu trữ mọi hình học trong CSDL."),
        ("Web Mercator — EPSG:3857: ", "hệ toạ độ phẳng (mét) mà các nền bản đồ trực tuyến dùng để "
         "hiển thị. Khi quản trị viên vẽ đa giác trên SceneView, hình học nhận được ở hệ này và "
         "được đổi về WGS84 (webMercatorToGeographic) trước khi gửi lên máy chủ."),
    ])
    b.para("Vì kinh độ, vĩ độ là góc, không thể lấy hiệu toạ độ để có khoảng cách. Khoảng cách "
           "giữa hai điểm trên mặt cầu bán kính R được tính bằng công thức haversine:")
    b.code("d = 2R · arcsin( sqrt( sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2) ) )\n"
           "φ: vĩ độ, λ: kinh độ (radian), R ≈ 6 371 km")
    b.para("PostGIS làm việc này chính xác hơn trên elipxoit khi hình học được ép sang kiểu "
           "geography; kết quả của ST_Distance và ST_DWithin khi đó tính bằng mét. Đề tài dùng "
           "đúng cách này cho dung sai ngang δxy và cho quy tắc R2.")
    b.para("Cao độ là phần dễ nhầm nhất. Có ba đại lượng khác nhau:", bold=True)
    b.bullets([
        ("h — cao độ elipxoit: ", "khoảng cách tới elipxoit WGS84. Đây là giá trị altitude mà GNSS "
         "và Geolocation API trả về."),
        ("H — cao độ chuẩn: ", "khoảng cách tới geoid, xấp xỉ mực nước biển trung bình. Bản đồ, "
         "hồ sơ công trình và cao độ nền toà nhà trong CSDL dùng loại này."),
        ("N — độ cao geoid: ", "chênh lệch giữa hai mặt chuẩn, thay đổi theo vị trí (trên toàn cầu "
         "khoảng −106 m đến +85 m). Ba đại lượng liên hệ: h = H + N."),
    ])
    b.image("13-cao-do-gnss.png", "Hình 2.1 — Cao độ elipxoit h, cao độ chuẩn H và độ cao geoid N")
    b.para("Hệ quả cho đề tài: z_min, z_max của khối MAP là cao độ chuẩn (tính từ cao độ nền), "
           "nên khi dùng cao độ do thiết bị đo được phải trừ N tại vị trí toà nhà trước khi so sánh. "
           "Bản cài đặt hiện tại chủ yếu dùng tầng khai báo (đã quy về cao độ chuẩn); việc hiệu chỉnh "
           "N cho nguồn cao độ thiết bị được ghi nhận ở phần hạn chế.", italic=True)

    # ------------------------------------------------------------------ 2.1.3
    b.heading("2.1.3. Mô hình và cấu trúc dữ liệu không gian 2D", 3)
    b.para("Mô hình dữ liệu không gian là cách biểu diễn thế giới thực thành dữ liệu máy tính lưu "
           "và xử lý được, gồm ba mức: quan niệm, logic và vật lý. Có hai cách tiếp cận lớn. Mô hình "
           "raster chia không gian thành lưới ô, mỗi ô mang một giá trị — phù hợp ảnh vệ tinh, "
           "địa hình, hiện tượng liên tục. Mô hình vector biểu diễn đối tượng bằng điểm, đường, đa "
           "giác với toạ độ chính xác — phù hợp đối tượng có ranh giới rõ như toà nhà, văn phòng. "
           "Đề tài dùng vector.")
    b.para("Trong mô hình vector 2D có ba cách tổ chức:")
    b.image("14-vector-2d.png", "Hình 2.2 — Ba mô hình vector 2D: spaghetti, mạng, topology")
    b.table(
        ["Mô hình", "Cách lưu", "Ưu điểm", "Nhược điểm"],
        [
            ["Spaghetti", "Mỗi đối tượng tự giữ dãy toạ độ của mình", "Đơn giản, dễ cài đặt, "
             "là dạng của chuẩn OGC Simple Features", "Không lưu quan hệ; cạnh chung bị lưu hai lần"],
            ["Mạng", "Node và cung; cung nối hai node, có thể có hướng", "Phân tích luồng, đường đi "
             "ngắn nhất (giao thông, điện, nước)", "Không mô tả quan hệ giữa các vùng"],
            ["Topology", "Cung biết node đầu, node cuối, đa giác trái, đa giác phải", "Truy vấn kề "
             "– chứa – nối nhanh, không dư thừa", "Cấu trúc phức tạp, cập nhật tốn công"],
        ],
        widths=[0.9, 1.7, 1.8, 1.7])
    b.para("Áp dụng: các khối MAP độc lập với nhau, không cần truy vấn kề hay nối, nên đa giác nền "
           "P được lưu kiểu spaghetti theo chuẩn OGC Simple Features (kiểu Polygon của PostGIS). "
           "Quan hệ “văn phòng nằm trong toà nhà” được kiểm tra bằng phép toán hình học "
           "(ST_Intersects) khi nhập liệu thay vì lưu sẵn topology.", italic=True)

    # ------------------------------------------------------------------ 2.1.4
    b.heading("2.1.4. Mô hình dữ liệu không gian 3D", 3)
    b.para("Một mô hình dữ liệu GIS 3D cũng cần ba mức quan niệm, logic và vật lý; sự phát triển "
           "của nó phụ thuộc vào CSDL không gian và kỹ thuật thu nhận dữ liệu (viễn thám, quét laser). "
           "Có bốn hướng tiếp cận biểu diễn đối tượng 3D:")
    b.image("09-bon-huong-3d.png", "Hình 2.3 — Bốn hướng biểu diễn đối tượng 3D")
    b.table(
        ["Hướng tiếp cận", "Ý tưởng", "Mô hình tiêu biểu"],
        [
            ["B-REP (biểu diễn bởi đường biên)",
             "Mô tả đối tượng bằng các phần tử biên: điểm, đường, bề mặt, khối", "3D-FDS, SSM, UDM, SUDM, TEN, OO, CityGML"],
            ["Voxel (chia nhỏ không gian)", "Chia khối thành các ô con, mỗi ô mang một giá trị", "3D Array, Octree"],
            ["CSG (tổ hợp khối cơ bản)",
             "Ghép các khối cơ bản bằng phép biến đổi và phép hội, giao, hiệu", "CSG"],
            ["Tổ hợp", "Kết hợp các cách trên", "V-3D, B-REP + CSG"],
        ],
        widths=[1.6, 2.6, 1.9])
    b.para("Đặc điểm các mô hình đã học:", bold=True)
    b.bullets([
        ("3D-FDS (Molenaar, 1990): ", "bốn đối tượng cơ sở BODY, SURFACE, LINE, POINT và bốn đối "
         "tượng nguyên tố NODE, ARC, EDGE, FACE. ARC là đoạn thẳng, ARC và FACE không giao nhau. "
         "Topology đầy đủ nhưng dữ liệu lớn."),
        ("SSM — Simplified Spatial Model (Zlatanova, 2000): ", "chỉ hai đối tượng nguyên tố NODE, "
         "FACE và bốn đối tượng cơ sở POINT, LINE, SURFACE, BODY. Không dùng ARC — cạnh được xem là "
         "một phần của các FACE. FACE phải phẳng, lồi, có hướng; quan hệ NODE ON FACE (có thứ tự) "
         "và FACE IN BODY được lưu tường minh. Thiết kế cho truy vấn hiển thị 3D trên web."),
        ("UDM — Urban Data Model (Coors, 2003): ", "tương tự SSM nhưng FACE là tam giác; hợp với "
         "đồ hoạ máy tính, đổi lại phải tam giác hoá mọi mặt."),
        ("SUDM, LUDM (Nguyễn Gia Tuấn Anh): ", "các mô hình chuyên biệt cho dữ liệu đô thị, phát "
         "triển từ hướng B-REP."),
        ("3D Array và Octree: ", "mảng ba chiều giá trị 0/1, hoặc cây tám nhánh chia đôi không gian "
         "theo từng trục. Có biểu diễn bên trong, dùng nhiều trong địa chất; độ phân giải càng mịn "
         "thì dữ liệu càng lớn."),
        ("CSG: ", "khối được tạo bằng phép tịnh tiến, quay, co giãn và phép hội, giao, hiệu trên "
         "hình lập phương, trụ, cầu. Thuận lợi tính thể tích, phổ biến trong CAD, nhưng không hợp "
         "với hình dạng bất quy tắc."),
        ("V-3D (Xinhua Wang, 2000) và B-REP + CSG: ", "mô hình tổ hợp. V-3D dùng NODE, EDGE, "
         "FACET và gắn ảnh raster cho FACET; B-REP + CSG lấy B-REP cho đường biên ngoài và CSG "
         "để giảm dữ liệu lưu trữ."),
    ])
    b.para("So sánh cho bài toán chấm công. Bài toán chỉ cần biểu diễn khối văn phòng — một lăng "
           "trụ đứng có đáy là mặt sàn được thuê — và trả lời “điểm chấm công có nằm trong khối "
           "không”. Tiêu chí: dựng được từ dữ liệu sẵn có (footprint OpenStreetMap và số tầng), "
           "dung lượng nhỏ, hiển thị được trên web, mô tả được quan hệ “mặt thuộc khối”.")
    b.table(
        ["Mô hình", "Nguyên tố", "Ưu điểm", "Nhược điểm với bài toán"],
        [
            ["3D-FDS", "NODE, ARC, EDGE, FACE", "Topology đầy đủ",
             "Phải lưu cả ARC, EDGE — thừa so với nhu cầu"],
            ["SSM", "NODE, FACE",
             "Chỉ hai nguyên tố; làm cho web 3D; FACE IN BODY tường minh",
             "FACE phải lồi; không biểu diễn bên trong khối"],
            ["UDM", "NODE, FACE tam giác", "Gọn, hợp đồ hoạ",
             "Phải tam giác hoá đáy lõm; một bức tường thành nhiều tam giác"],
            ["SUDM", "Chuyên biệt đô thị", "Hướng tới đối tượng đô thị", "Phức tạp hơn mức cần"],
            ["3D Array / Octree", "Voxel", "Có biểu diễn bên trong",
             "Tốn bộ nhớ; biên khối răng cưa"],
            ["CSG", "Khối cơ bản", "Tính thể tích thuận tiện",
             "Không biểu diễn được footprint bất quy tắc"],
            ["V-3D", "NODE, EDGE, FACET + ảnh", "Gắn ảnh cho mặt",
             "Không cần ảnh mặt dựng"],
        ],
        widths=[1.2, 1.3, 1.8, 1.8])
    b.para("Lựa chọn: mô hình SSM làm mô hình logic.", bold=True)
    b.bullets([
        "Khối văn phòng là một BODY bao bởi các FACE phẳng — mặt đáy, mặt nắp và n mặt bên — "
        "đúng cấu trúc NODE – FACE – BODY của SSM, không cần ARC, EDGE như 3D-FDS.",
        "SSM được thiết kế cho ứng dụng GIS 3D trên nền web, đúng môi trường của đề tài "
        "(ArcGIS Maps SDK for JavaScript chạy trên trình duyệt).",
        "Mặt đáy giữ nguyên đa giác nền lấy từ OpenStreetMap, không phải tam giác hoá như UDM; "
        "mỗi mặt bên ứng với đúng một đoạn tường thật.",
        "Quan hệ FACE IN BODY cho biết mặt nào thuộc văn phòng nào; NODE ON FACE có thứ tự nên "
        "suy được hướng (pháp tuyến) của từng mặt.",
    ])
    b.para("Điều chỉnh so với SSM gốc: footprint thật thường lõm (IFC One Saigon có 18 đỉnh, mặt "
           "cong) nên ràng buộc FACE lồi được nới lỏng cho mặt đáy và mặt nắp; các mặt bên luôn là "
           "tứ giác lồi. SSM không biểu diễn bên trong khối, nhưng khối là lăng trụ đứng nên phép "
           "kiểm tra điểm thuộc khối tách được thành hai phép kiểm tra đơn giản (mục 2.1.7).",
           italic=True)
    b.image("08-ssm-map.png", "Hình 2.4 — Mô hình SSM áp vào khối MAP: lược đồ đối tượng "
            "và cách đánh số NODE, FACE của hàm ssm_cua_khoi()")
    b.para("Biểu diễn và dung lượng dữ liệu. Theo cách tính của tài liệu ví dụ môn học (mã định "
           "danh 4 byte, toạ độ 8 byte):", bold=True)
    b.code("NODE(#NID, X, Y, Z)              -> 4 + 3 x 8 = 28 byte / dòng\n"
           "FACE(#FID, BID)                  -> 4 + 4     =  8 byte / dòng\n"
           "NODE_ON_FACE(#FID, #NID, THU_TU) -> 4 + 4 + 4 = 12 byte / dòng\n"
           "BODY(#BID)                       -> 4 byte / dòng")
    b.para("Khối có đáy n đỉnh gồm 2n NODE, n + 2 FACE và 6n quan hệ NODE ON FACE.")
    b.table(
        ["Khối", "NODE", "FACE", "NODE ON FACE", "Tổng SSM"],
        [
            ["Hình hộp chữ nhật (n = 4)", "8 × 28 = 224", "6 × 8 = 48", "24 × 12 = 288", "564 byte"],
            ["Khối Alpha Tech, IFC One Saigon (n = 18)", "36 × 28 = 1.008", "20 × 8 = 160",
             "108 × 12 = 1.296", "2.468 byte"],
        ],
        widths=[2.0, 1.1, 0.9, 1.2, 0.9])
    b.para("Vì khối là lăng trụ đứng, toàn bộ NODE và FACE được xác định bởi bộ (P, z_min, z_max). "
           "Ở mức vật lý nhóm chỉ lưu bộ này: đa giác 19 điểm × 16 byte = 304 byte cộng 4 số thực "
           "= 32 byte, khoảng 340 byte — nhỏ hơn khoảng 7 lần so với lưu đầy đủ. Khi cần dạng SSM, "
           "hàm ssm_cua_khoi() trong CSDL trải khối ra đúng cấu trúc NODE – FACE – BODY; số liệu của "
           "khối Alpha Tech ở bảng trên lấy trực tiếp từ hàm này.")

    # ------------------------------------------------------------------ 2.1.5
    b.heading("2.1.5. Mức chi tiết (LOD) theo chuẩn CityGML", 3)
    b.para("CityGML là chuẩn mở của Open Geospatial Consortium để lưu trữ và trao đổi mô hình "
           "thành phố 3D. Ngoài hình học, CityGML gắn ngữ nghĩa cho từng thành phần (tường, mái, "
           "cửa…), và chia mức chi tiết (Level of Detail) như sau:")
    b.image("10-lod-citygml.png", "Hình 2.5 — Các mức chi tiết LOD0 đến LOD4 theo CityGML 2.0")
    b.table(
        ["Mức", "Nội dung", "Dữ liệu cần", "Trong đề tài"],
        [
            ["LOD0", "Mặt bằng 2.5D: footprint, mô hình địa hình", "Đa giác nền", "Footprint toà nhà (OSM)"],
            ["LOD1", "Khối đùn (block model) với chiều cao đồng nhất", "Footprint + chiều cao",
             "Khối MAP dùng cho kiểm tra bao hàm"],
            ["LOD2", "Thêm hình dạng mái, phân biệt mặt tường / mặt mái", "Hình dạng mái", "—"],
            ["LOD3", "Kiến trúc mặt ngoài: cửa sổ, cửa đi, ban công, chi tiết mái",
             "Mặt dựng chi tiết", "Mô hình toà nhà hiển thị trên bản đồ"],
            ["LOD4", "Thêm nội thất: phòng, cầu thang, đồ đạc", "Bản vẽ trong nhà",
             "Hướng phát triển (chấm công theo phòng)"],
        ],
        widths=[0.6, 2.2, 1.5, 1.8])
    b.para("Từ CityGML 3.0 (2021), LOD4 được bỏ và phần nội thất có thể biểu diễn ở các mức LOD0–LOD3; "
           "báo cáo dùng cách chia của CityGML 2.0 vì phổ biến hơn trong tài liệu.")
    b.para("Đề tài dùng hai mức cho hai mục đích: LOD1 cho phép kiểm tra bao hàm (chi tiết mặt dựng "
           "không làm thay đổi kết quả), LOD3 để hiển thị toà nhà, đáp ứng yêu cầu bản đồ 3D mức độ "
           "chi tiết 3 của môn học. Mô hình LOD3 được sinh tự động từ dữ liệu trong CSDL; mỗi thành "
           "phần gắn một lớp ngữ nghĩa CityGML:")
    b.table(
        ["Thành phần LOD3", "Lớp CityGML"],
        [
            ["Băng tường ốp đá khối đế, dầm biên từng tầng, tường chắn mái", "WallSurface"],
            ["Băng cửa kính khối đế, vách kính thân tháp", "Window"],
            ["Cửa xoay và hai cửa kính sảnh chính (giữa cạnh dài nhất)", "Door"],
            ["Mái khối đế, sàn mái tum, sân đỗ trực thăng", "RoofSurface"],
            ["Khung nhôm đứng, mái sảnh, cột sảnh, tum kỹ thuật, thiết bị mái, cột thu lôi",
             "BuildingInstallation"],
        ],
        widths=[4.4, 1.7])

    # ------------------------------------------------------------------ 2.1.6
    b.heading("2.1.6. Định vị GNSS và sai số trong môi trường đô thị", 3)
    b.para("Hệ thống định vị toàn cầu bằng vệ tinh (GNSS — gồm GPS, GLONASS, Galileo, BeiDou) xác "
           "định vị trí bằng cách đo khoảng cách giả tới các vệ tinh dựa trên thời gian truyền tín "
           "hiệu. Vì đồng hồ của máy thu không đồng bộ với vệ tinh, cần ít nhất bốn vệ tinh để giải "
           "bốn ẩn: ba toạ độ và sai lệch đồng hồ.")
    b.para("Trong đô thị có nhiều nhà cao tầng, độ chính xác giảm mạnh vì:")
    b.bullets([
        ("Đa đường (multipath): ", "tín hiệu phản xạ trên mặt kính, bê tông rồi mới tới máy thu, "
         "làm khoảng cách đo bị dài ra."),
        ("Che khuất (NLOS) — hiệu ứng “hẻm phố đô thị”: ", "chỉ thấy được phần trời hẹp giữa hai "
         "dãy nhà, các vệ tinh nhìn thấy dồn về một hướng nên hình học vệ tinh kém."),
        ("Trong nhà: ", "tín hiệu suy hao qua tường và sàn, nhiều khi không định vị được."),
        ("Thành phần đứng kém hơn thành phần ngang: ", "các vệ tinh đều ở phía trên máy thu nên sai "
         "số cao độ thường lớn hơn sai số ngang nhiều lần."),
    ])
    b.para("Ngoài trời thoáng, điện thoại thông minh thường đạt sai số ngang khoảng 5 m; giữa các "
           "toà nhà cao tầng sai số có thể lên hàng chục mét. Đây là lý do mô hình MAP cần dung sai "
           "δxy, và lý do cao độ GNSS không đủ tin cậy để tự phân biệt tầng.")
    b.para("Geolocation API của trình duyệt trả về latitude, longitude, accuracy (bán kính sai số "
           "ngang, mét), altitude (cao độ so với elipxoit WGS84, có thể null) và altitudeAccuracy. "
           "API chỉ hoạt động trong ngữ cảnh an toàn (HTTPS hoặc localhost). Hệ thống dùng accuracy "
           "cho quy tắc R3 và chỉ dùng altitude khi altitudeAccuracy đủ nhỏ.")
    b.para("Các công nghệ định vị trong nhà có thể bổ trợ:", bold=True)
    b.table(
        ["Công nghệ", "Nguyên lý", "Độ chính xác điển hình", "Ghi chú"],
        [
            ["Wi-Fi RSSI", "So cường độ sóng các điểm phát với bản đồ vân tay đã đo",
             "Vài mét", "Cần khảo sát trước, phải đo lại khi bố trí điểm phát thay đổi"],
            ["BLE beacon", "Đặt beacon theo tầng / phòng, đo cường độ tín hiệu", "1–3 m",
             "Phân biệt tầng tốt nếu beacon đặt ở mỗi tầng"],
            ["Khí áp kế", "Áp suất giảm khoảng 12 Pa mỗi mét cao (gần mực nước biển)",
             "Phân biệt được từng tầng khi có mốc tham chiếu", "Có sẵn trên nhiều điện thoại; trôi theo thời tiết"],
            ["UWB", "Đo thời gian bay giữa thẻ và trạm neo", "Dưới 1 m", "Cần hạ tầng riêng"],
        ],
        widths=[1.0, 2.3, 1.3, 1.5])
    b.para("Trong phạm vi đồ án, các công nghệ này được nêu làm hướng phát triển; hệ thống hiện "
           "dùng nguồn cao độ hỗn hợp — cao độ thiết bị nếu đủ tin cậy, nếu không thì tầng khai báo "
           "— và đối chiếu với khối MAP.", italic=True)

    # ------------------------------------------------------------------ 2.1.7
    b.heading("2.1.7. Thuật toán kiểm tra bao hàm", 3)
    b.para("Điểm thuộc đa giác (point in polygon). Thuật toán phổ biến nhất là bắn tia (ray "
           "casting), dựa trên định lý đường cong Jordan: từ điểm Q bắn một tia theo một hướng cố "
           "định và đếm số lần tia cắt các cạnh của đa giác. Số giao điểm lẻ thì Q nằm trong, chẵn "
           "thì nằm ngoài. Độ phức tạp O(n) với n là số đỉnh.", bold=False)
    b.image("11-ray-casting.png", "Hình 2.6 — Kiểm tra điểm thuộc đa giác bằng ray casting")
    b.para("Các trường hợp biên cần xử lý: tia đi đúng qua một đỉnh (dùng quy tắc nửa mở — cạnh "
           "được tính khi một đầu mút ở trên tia và đầu kia ở dưới hoặc trên đúng tia), và điểm nằm "
           "đúng trên cạnh. Trong thực tế đề tài không tự cài đặt mà dùng hàm của PostGIS, vốn đã xử "
           "lý các trường hợp này.")
    b.para("Điểm thuộc khối (point in polyhedron). Với một khối đa diện bất kỳ, có thể mở rộng ray "
           "casting sang 3D: bắn tia và đếm số FACE bị cắt, độ phức tạp O(F) theo số mặt. Nhưng khối "
           "MAP là lăng trụ đứng, nên bài toán tách được thành hai bước rẻ:")
    b.code("Q thuộc khối  <=>  Q.xy thuộc đa giác đáy P   (2D, O(n))\n"
           "              AND  z_min <= Q.z <= z_max     (so sánh khoảng, O(1))")
    b.para("Kiểm tra có dung sai. Vì vị trí đo có sai số, đề tài kiểm tra trên khối đã nới biên. "
           "Điều kiện ngang trở thành “khoảng cách từ Q tới đa giác không vượt quá δxy” (bằng 0 khi "
           "Q nằm trong P), cài bằng ST_DWithin trên kiểu geography để có đơn vị mét. Điều kiện đứng "
           "trở thành z_min − δz ≤ Q.z ≤ z_max + δz. Tổ hợp hai điều kiện cho ba trạng thái:")
    b.image("12-map-dung-sai.png", "Hình 2.7 — Khối MAP, vùng dung sai và ba trạng thái kết quả")
    b.para("Phát hiện dịch chuyển bất khả thi (R2). Với hai lần chấm công liên tiếp tại Q1, Q2 cách "
           "nhau Δt giây, vận tốc tối thiểu cần có là v = d(Q1, Q2) / Δt, với d là khoảng cách trắc "
           "địa. Nếu v vượt ngưỡng (150 km/h) thì ít nhất một trong hai vị trí là giả. Đây là ví dụ "
           "dùng chiều thời gian kết hợp chiều không gian.")

    # ------------------------------------------------------------------ 2.1.8
    b.heading("2.1.8. Công nghệ nền: PostGIS và ArcGIS Maps SDK", 3)
    b.para("PostGIS là phần mở rộng không gian của PostgreSQL, cài đặt chuẩn OGC Simple Features: "
           "các kiểu Point, LineString, Polygon, các kiểu Multi, PolyhedralSurface, TIN, đều có thể "
           "kèm toạ độ Z. Mỗi hình học gắn một mã hệ toạ độ SRID. PostGIS có hai họ kiểu: geometry "
           "(tính toán trên mặt phẳng, nhanh) và geography (tính trên elipxoit, kết quả bằng mét). "
           "Chỉ mục GiST cài đặt cây R-tree trên hộp bao, giúp lọc nhanh các đối tượng gần nhau.")
    b.table(
        ["Hàm PostGIS", "Chức năng", "Dùng ở đâu trong đề tài"],
        [
            ["ST_DWithin(geography)", "Hai hình học cách nhau không quá d mét", "Điều kiện ngang có dung sai δxy"],
            ["ST_Distance(geography)", "Khoảng cách trắc địa (mét)", "Khoảng cách ngang tới khối, vận tốc R2"],
            ["ST_Intersects", "Hai hình học có giao nhau", "Kiểm tra khối MAP nằm trên toà nhà"],
            ["ST_GeomFromGeoJSON, ST_MakeValid", "Đọc và sửa hình học do người dùng vẽ", "API quản trị"],
            ["ST_ForcePolygonCCW, ST_PointN", "Chuẩn hoá chiều vòng, lấy đỉnh", "Trải khối theo SSM"],
            ["ST_Area(geography)", "Diện tích (m²)", "Thống kê diện tích nền, thể tích khối"],
        ],
        widths=[1.8, 2.1, 2.2])
    b.para("ArcGIS Maps SDK for JavaScript (bài thực hành Lab 1, Lab 2) tổ chức theo mô hình Map – "
           "View: Map chứa nền bản đồ (basemap), địa hình (ground) và các lớp (layer); View hiển thị "
           "Map — MapView cho 2D và SceneView cho 3D. SceneView điều khiển bằng camera gồm vị trí "
           "(position), góc phương vị (heading, theo chiều kim đồng hồ từ hướng Bắc) và góc nghiêng "
           "(tilt). Đối tượng vẽ là Graphic gồm hình học, ký hiệu và thuộc tính.")
    b.table(
        ["Thành phần", "Ý nghĩa", "Dùng trong đề tài"],
        [
            ["elevationInfo: absolute-height", "Đặt hình học đúng cao độ tuyệt đối của toạ độ Z",
             "Khối MAP, toà nhà, điểm chấm công"],
            ["elevationInfo: on-the-ground", "Bám theo mặt địa hình, bỏ qua Z", "Lớp vẽ đa giác của quản trị"],
            ["ExtrudeSymbol3DLayer", "Đùn đa giác thành khối theo chiều cao", "Khối MAP, khối đế, vách kính, dầm tầng"],
            ["PathSymbol3DLayer", "Biến đường thành ống / hộp 3D", "Khung nhôm đứng, tường chắn mái"],
            ["ObjectSymbol3DLayer", "Đặt vật thể 3D cơ bản (hộp, trụ, cầu) tại một điểm",
             "Cửa, cột sảnh, thiết bị mái, điểm chấm công"],
            ["SketchViewModel", "Công cụ vẽ và sửa hình học trên bản đồ", "Vẽ footprint toà nhà và đa giác khối"],
        ],
        widths=[1.8, 2.2, 2.1])


def ch2_mo_hinh_hoa(b):
    b.para("Từ mô hình SSM ở mục 2.1, nhóm chuyên biệt hoá BODY thành một lăng trụ đứng "
           "gắn với một văn phòng và bổ sung hai tham số dung sai, đặt tên là MAP — Khối "
           "chấm công phân tầng (Multi-floor Attendance Prism).")
    b.table(
        ["SSM gốc", "MAP"],
        [
            ["BODY bất kỳ, bao bởi FACE bất kỳ",
             "BODY luôn là lăng trụ đứng: 1 FACE đáy, 1 FACE nắp, n FACE bên"],
            ["FACE phẳng, lồi", "FACE đáy, nắp được phép lõm (giữ nguyên footprint thật)"],
            ["Lưu đầy đủ NODE, FACE, NODE ON FACE",
             "Lưu gọn (P, z_min, z_max); trải ra SSM bằng ssm_cua_khoi() khi cần"],
            ["Không có khái niệm sai số", "Thêm δxy, δz để bù sai số định vị"],
            ["Toạ độ Z của NODE nhập trực tiếp", "z_min, z_max suy ra từ dải tầng bằng trigger"],
        ],
        widths=[2.6, 3.5])
    b.para()
    b.para("a) Định nghĩa", bold=True)
    b.code("MAP = ( P, z_min, z_max, δxy, δz )")
    b.table(
        ["Thành phần", "Ý nghĩa"],
        [
            ["P", "Đa giác nền (footprint) phần sàn mà văn phòng thuê, hệ toạ độ WGS84"],
            ["z_min", "Cao độ tuyệt đối của sàn tầng thấp nhất văn phòng chiếm dụng"],
            ["z_max", "Cao độ tuyệt đối của trần tầng cao nhất"],
            ["δxy", "Biên dung sai ngang, bù cho sai số GPS đô thị"],
            ["δz", "Biên dung sai đứng, bù cho sai số đo cao độ"],
        ],
        widths=[1.1, 5.0])
    b.para("Cao độ được suy ra từ thông tin toà nhà và dải tầng văn phòng thuê:")
    b.code("z_min = z_nen + (tang_bat_dau - 1) x h_tang\n"
           "z_max = z_nen +  tang_ket_thuc      x h_tang")
    b.para("Khối dùng để kiểm tra là khối MAP đã nới biên dung sai:")
    b.code("MAP+ = ( buffer(P, δxy),  z_min - δz,  z_max + δz )")
    b.para()
    b.para("b) Phép kiểm tra bao hàm", bold=True)
    b.para("Với bản ghi chấm công tại điểm Q = (kinh độ, vĩ độ, cao độ):")
    b.code("trong_khoi(Q, MAP+)  <=>  pointInPolygon(Q.xy, buffer(P, δxy))\n"
           "                      AND  (z_min - δz) <= Q.alt <= (z_max + δz)")
    b.para("Kết quả được phân thành ba trạng thái thay vì nhị phân đúng/sai:")
    b.table(
        ["Trạng thái", "Điều kiện", "Ý nghĩa nghiệp vụ"],
        [
            ["HỢP LỆ", "Thoả cả điều kiện ngang và điều kiện đứng, độ chính xác thiết bị đạt ngưỡng",
             "Ghi nhận công bình thường"],
            ["NGHI NGỜ", "Thoả điều kiện ngang nhưng sai điều kiện đứng",
             "Đúng toà nhà, sai tầng — cần xác minh"],
            ["NGOÀI VÙNG", "Không thoả điều kiện ngang",
             "Từ chối, đề nghị gửi đơn giải trình"],
        ],
        widths=[1.0, 3.0, 2.1])
    b.para("Trạng thái NGHI NGỜ chính là giá trị mà mô hình 2D không thể sinh ra. Đây "
           "là đóng góp cốt lõi của mô hình MAP.", italic=True)
    b.para()
    b.para("c) Bốn quy tắc phát hiện bất thường", bold=True)
    b.table(
        ["Mã", "Quy tắc", "Cơ sở phát hiện"],
        [
            ["R1", "Sai tầng", "Thoả điều kiện ngang nhưng lệch cao độ vượt δz"],
            ["R2", "Dịch chuyển bất khả thi",
             "Vận tốc suy ra giữa hai bản ghi liên tiếp vượt ngưỡng (ví dụ 150 km/h)"],
            ["R3", "Độ chính xác bất thường",
             "Giá trị accuracy quá nhỏ so với thực tế đô thị (dấu hiệu giả lập GPS) hoặc quá lớn"],
            ["R4", "Trùng thiết bị",
             "Nhiều nhân viên chấm công từ cùng một định danh thiết bị trong thời gian ngắn"],
        ],
        widths=[0.5, 1.6, 4.0])
    b.para()
    b.para("d) Các đối tượng trong mô hình", bold=True)
    b.table(
        ["Đối tượng", "Vai trò trong mô hình không gian"],
        [
            ["Toà nhà", "Khối bao ngoài, có footprint và cao độ nền — đóng vai trò nền cảnh 3D"],
            ["Văn phòng", "Đơn vị thuê, chiếm dải tầng từ tầng bắt đầu đến tầng kết thúc"],
            ["Khu vực chấm công", "Hiện thực của khối MAP: P, z_min, z_max, δxy, δz"],
            ["Bản ghi chấm công", "Điểm ba chiều kèm độ chính xác và thời điểm"],
            ["Cảnh báo bất thường", "Kết quả áp bốn quy tắc R1–R4 lên bản ghi"],
        ],
        widths=[1.5, 4.6])


def ch2_erd(b):
    b.para("Mô hình ERD gồm 15 thực thể, chia thành bốn nhóm: tổ chức (công ty, phòng "
           "ban), không gian (toà nhà, văn phòng, khu vực chấm công), nhân sự (nhân "
           "viên, người dùng, vai trò, thiết bị) và nghiệp vụ chấm công (ca làm việc, "
           "phân ca, bản ghi chấm công, cảnh báo, đơn giải trình).")
    b.image("01-erd.png", "Hình 2.2 — Sơ đồ quan hệ thực thể (ERD)")
    b.para("Ba thực thể mang tính không gian, là phần khác biệt so với một hệ thống "
           "chấm công thông thường:")
    b.table(
        ["Thực thể", "Thuộc tính không gian", "Giải thích"],
        [
            ["TOA_NHA", "footprint (Polygon), cao_do_nen, so_tang, chieu_cao_tang",
             "Khối bao của công trình; là gốc để suy ra cao độ của mọi tầng"],
            ["KHU_VUC_CHAM_CONG", "da_giac_nen (Polygon), z_min, z_max, dung_sai_ngang, dung_sai_dung",
             "Hiện thực trực tiếp của khối MAP; quan hệ 1–1 với văn phòng"],
            ["BAN_GHI_CHAM_CONG", "vi_tri (PointZ), do_chinh_xac_ngang, do_chinh_xac_dung",
             "Điểm 3D thiết bị báo về; là đầu vào của phép kiểm tra bao hàm"],
        ],
        widths=[1.4, 2.2, 2.5])
    b.para("Các quan hệ chính:")
    b.bullets([
        "TOA_NHA 1–n VAN_PHONG: một toà nhà chứa nhiều văn phòng của nhiều công ty khác nhau.",
        "VAN_PHONG 1–1 KHU_VUC_CHAM_CONG: mỗi văn phòng tương ứng đúng một khối MAP.",
        "KHU_VUC_CHAM_CONG 1–n BAN_GHI_CHAM_CONG: một khối xác thực nhiều lần chấm công.",
        "BAN_GHI_CHAM_CONG 1–n CANH_BAO_BAT_THUONG: một bản ghi có thể vi phạm nhiều quy tắc.",
        "BAN_GHI_CHAM_CONG 1–0..1 DON_GIAI_TRINH: mỗi bản ghi có tối đa một đơn giải trình.",
    ])


def ch2_quan_he(b):
    b.para("Chuyển mô hình ERD sang mô hình quan hệ (gạch chân là khoá chính, dấu ↑ "
           "là khoá ngoại):")
    b.code(
        "CONG_TY(ma_cong_ty, ten_cong_ty, ma_so_thue)\n\n"
        "PHONG_BAN(ma_phong_ban, ma_cong_ty↑, ten_phong_ban)\n\n"
        "TOA_NHA(ma_toa_nha, ten, dia_chi, footprint, cao_do_nen, so_tang,\n"
        "        chieu_cao_tang, so_tang_de, nguon_du_lieu)\n\n"
        "VAN_PHONG(ma_van_phong, ma_cong_ty↑, ma_toa_nha↑, ten,\n"
        "          tang_bat_dau, tang_ket_thuc)\n\n"
        "KHU_VUC_CHAM_CONG(ma_khu_vuc, ma_van_phong↑, da_giac_nen, z_min, z_max,\n"
        "                  dung_sai_ngang, dung_sai_dung, dang_hieu_luc)\n\n"
        "NHAN_VIEN(ma_nhan_vien, ma_cong_ty↑, ma_phong_ban↑, ho_ten, email,\n"
        "          ngay_vao_lam, dang_lam_viec)\n\n"
        "THIET_BI(ma_thiet_bi, ma_nhan_vien↑, dinh_danh_thiet_bi, he_dieu_hanh,\n"
        "         duoc_tin_cay)\n\n"
        "CA_LAM_VIEC(ma_ca, ten_ca, gio_vao, gio_ra, tre_toi_da_phut)\n\n"
        "PHAN_CA(ma_phan_ca, ma_nhan_vien↑, ma_ca↑, ngay_lam_viec)\n\n"
        "BAN_GHI_CHAM_CONG(ma_ban_ghi, ma_nhan_vien↑, ma_khu_vuc↑, ma_thiet_bi↑,\n"
        "                  thoi_diem, loai, vi_tri, do_chinh_xac_ngang,\n"
        "                  do_chinh_xac_dung, nguon_cao_do, tang_khai_bao, trang_thai)\n\n"
        "CANH_BAO_BAT_THUONG(ma_canh_bao, ma_ban_ghi↑, ma_quy_tac, muc_do, mo_ta,\n"
        "                    da_xu_ly)\n\n"
        "DON_GIAI_TRINH(ma_don, ma_nhan_vien↑, ma_ban_ghi↑, ly_do, trang_thai,\n"
        "               nguoi_duyet↑, thoi_diem_gui)\n\n"
        "VAI_TRO(ma_vai_tro, ten_vai_tro)\n\n"
        "NGUOI_DUNG(ma_nguoi_dung, ma_nhan_vien↑, ma_vai_tro↑, ten_dang_nhap,\n"
        "           mat_khau_bam)")
    b.para("Mô tả chi tiết các thuộc tính đáng lưu ý:", bold=True)
    b.table(
        ["Thuộc tính", "Kiểu", "Mô tả"],
        [
            ["TOA_NHA.footprint", "GEOMETRY(Polygon, 4326)",
             "Hình chiếu bằng của công trình, hệ WGS84"],
            ["TOA_NHA.cao_do_nen", "NUMERIC(7,2)", "Cao độ mặt nền so với mực nước biển, đơn vị mét"],
            ["KHU_VUC.z_min / z_max", "NUMERIC(7,2)",
             "Thuộc tính dẫn xuất từ cao độ nền và dải tầng; lưu phi chuẩn hoá có chủ đích để tránh tính lại khi truy vấn nóng"],
            ["BAN_GHI.vi_tri", "GEOMETRY(PointZ, 4326)", "Toạ độ ba chiều thiết bị báo về"],
            ["BAN_GHI.nguon_cao_do", "VARCHAR(12)",
             "THIET_BI nếu cao độ do GPS đo được, KHAI_BAO nếu lấy theo tầng người dùng chọn"],
            ["BAN_GHI.trang_thai", "VARCHAR(12)", "HOP_LE | NGHI_NGO | NGOAI_VUNG"],
        ],
        widths=[1.5, 1.5, 3.1])
    b.para("Ràng buộc toàn vẹn:", bold=True)
    b.bullets([
        "VAN_PHONG.tang_bat_dau ≤ VAN_PHONG.tang_ket_thuc ≤ TOA_NHA.so_tang.",
        "KHU_VUC_CHAM_CONG.z_min < z_max; hai giá trị này được trigger tự suy ra khi để trống.",
        "Mỗi nhân viên chỉ có tối đa một bản ghi loại VAO chưa có bản ghi RA tương ứng trong ngày.",
        "PHAN_CA(ma_nhan_vien, ngay_lam_viec) là khoá dự tuyển — một người chỉ được xếp một ca mỗi ngày.",
    ])


def ch2_usecase(b):
    b.para("Hệ thống có ba tác nhân người dùng (nhân viên, quản lý, quản trị viên) và "
           "một tác nhân hệ thống ngoài là dịch vụ định vị của thiết bị.")
    b.image("02-usecase.png", "Hình 2.3 — Sơ đồ trường hợp sử dụng")
    b.para("Đặc tả UC2 — Chấm công vào/ra", bold=True)
    b.table(
        ["Mục", "Nội dung"],
        [
            ["Tác nhân", "Nhân viên"],
            ["Tiền điều kiện",
             "Đã đăng nhập; thiết bị đã cấp quyền định vị; nhân viên có ca làm việc trong ngày"],
            ["Luồng chính",
             "1. Nhân viên mở màn hình chấm công.\n"
             "2. Hệ thống yêu cầu vị trí từ thiết bị.\n"
             "3. Thiết bị trả về kinh độ, vĩ độ, cao độ và độ chính xác.\n"
             "4. Nhân viên xác nhận tầng đang làm việc.\n"
             "5. Hệ thống thực hiện UC12 — kiểm tra bao hàm khối.\n"
             "6. Hệ thống thực hiện UC13 — áp bốn quy tắc R1–R4.\n"
             "7. Hệ thống lưu bản ghi kèm trạng thái và hiển thị kết quả."],
            ["Luồng thay thế 3a",
             "Thiết bị không trả được cao độ → dùng tầng khai báo ở bước 4, "
             "đánh dấu nguồn cao độ là KHAI_BAO"],
            ["Luồng ngoại lệ 5a",
             "Ngoài vùng ngang → từ chối, hiển thị khoảng cách tới khối gần nhất, "
             "gợi ý gửi đơn giải trình (UC5)"],
            ["Luồng ngoại lệ 5b",
             "Trong vùng ngang nhưng lệch tầng → lưu trạng thái NGHI NGỜ, sinh cảnh "
             "báo R1, thông báo cho quản lý"],
            ["Hậu điều kiện", "Có một bản ghi chấm công mới với trạng thái được xác định"],
        ],
        widths=[1.3, 4.8])
    b.para("Đặc tả UC10 — Dựng khối vùng chấm công 3D", bold=True)
    b.table(
        ["Mục", "Nội dung"],
        [
            ["Tác nhân", "Quản trị viên"],
            ["Tiền điều kiện", "Toà nhà đã tồn tại trong hệ thống"],
            ["Luồng chính",
             "1. Chọn toà nhà trên SceneView.\n"
             "2. Vẽ đa giác nền bằng công cụ phác thảo, hoặc kế thừa footprint của toà nhà.\n"
             "3. Nhập dải tầng văn phòng thuê.\n"
             "4. Hệ thống tự tính z_min và z_max từ cao độ nền và chiều cao tầng.\n"
             "5. Nhập dung sai ngang và dung sai đứng.\n"
             "6. Hệ thống dựng khối xem trước bằng ExtrudeSymbol3DLayer.\n"
             "7. Lưu khối."],
            ["Hậu điều kiện", "Khối MAP có hiệu lực, dùng để xác thực các lần chấm công sau"],
        ],
        widths=[1.3, 4.8])


def ch2_dfd(b):
    b.para("Sơ đồ mức 0 (sơ đồ ngữ cảnh)", bold=True)
    b.image("03-dfd0.png", "Hình 2.4 — DFD mức 0")
    b.para("Sơ đồ mức 1", bold=True)
    b.image("04-dfd1.png", "Hình 2.5 — DFD mức 1")
    b.para("Đặc tả các tiến trình:", bold=True)
    b.table(
        ["Tiến trình", "Đầu vào", "Xử lý", "Đầu ra"],
        [
            ["1.0 Xác thực người dùng", "Thông tin đăng nhập",
             "Đối chiếu kho D1, sinh token kèm vai trò", "Phiên làm việc"],
            ["2.0 Thu nhận vị trí 3D", "Yêu cầu chấm công, dữ liệu định vị thiết bị",
             "Chuẩn hoá toạ độ, xác định nguồn cao độ", "Điểm 3D kèm độ chính xác"],
            ["3.0 Kiểm tra bao hàm khối", "Điểm 3D, khối MAP từ kho D2",
             "Ray casting trên mặt phẳng và so sánh dải cao độ", "Bản ghi kèm trạng thái, ghi vào D3"],
            ["4.0 Phát hiện bất thường", "Bản ghi mới, lịch sử gần nhất từ D3",
             "Áp bốn quy tắc R1–R4", "Cảnh báo ghi vào D4"],
            ["5.0 Xử lý giải trình", "Đơn của nhân viên, quyết định của quản lý",
             "Cập nhật trạng thái đơn và bản ghi liên quan", "Đơn đã duyệt, bản ghi được hiệu chỉnh"],
            ["6.0 Tổng hợp báo cáo", "Bản ghi từ D3, ca làm việc từ D6",
             "Tính giờ công, số lần đi muộn, số lần bất thường", "Báo cáo tháng"],
            ["7.0 Quản trị khối MAP", "Footprint, dải tầng, dung sai",
             "Suy ra z_min/z_max, kiểm tra ràng buộc", "Khối MAP ghi vào D2"],
        ],
        widths=[1.3, 1.5, 1.9, 1.4])


def ch2_sequence(b):
    b.para("SD1 — Chấm công vào (gồm cả nhánh lệch tầng)", bold=True)
    b.image("05-sd1-cham-cong.png", "Hình 2.6 — Sơ đồ trình tự chấm công vào")
    b.para("Điểm cần chú ý: nhánh thứ hai của khối alt mô tả đúng tình huống mà hàng "
           "rào 2D bỏ sót — toạ độ ngang nằm trong vùng nhưng cao độ lệch khỏi dải "
           "tầng, hệ thống trả về NGHI NGỜ và sinh cảnh báo R1 thay vì chấp nhận.",
           italic=True)
    b.para()
    b.para("SD2 — Quản trị viên dựng khối vùng chấm công", bold=True)
    b.image("06-sd2-dung-khoi.png", "Hình 2.7 — Sơ đồ trình tự dựng khối MAP")
    b.para()
    b.para("SD3 — Duyệt đơn giải trình", bold=True)
    b.image("07-sd3-giai-trinh.png", "Hình 2.8 — Sơ đồ trình tự duyệt đơn giải trình")


def ch3_cong_nghe(b):
    b.table(
        ["Lớp", "Công nghệ", "Lý do lựa chọn"],
        [
            ["Bản đồ 3D", "ArcGIS Maps SDK for JavaScript 4.29 (SceneView, GraphicsLayer, "
                          "PolygonSymbol3D + ExtrudeSymbol3DLayer, LineSymbol3D + "
                          "PathSymbol3DLayer, ObjectSymbol3DLayer, SketchViewModel)",
             "Đúng công nghệ môn học (Lab 1, Lab 2); dựng được khối đùn, đường 3D và vật "
             "thể 3D cho mô hình LOD3; có sẵn công cụ phác thảo đa giác"],
            ["Giao diện", "HTML, CSS, JavaScript thuần (không framework)",
             "Không cần bước build — máy chủ phục vụ thẳng thư mục web"],
            ["Định vị", "HTML5 Geolocation API",
             "Chạy trực tiếp trên trình duyệt di động, không cần cài ứng dụng"],
            ["Máy chủ", "Node.js + Express 5",
             "Tự chuyển lỗi của hàm async sang bộ bắt lỗi — một yêu cầu sai không làm sập máy chủ"],
            ["Cơ sở dữ liệu", "PostgreSQL 17 + PostGIS 3.5",
             "Hình học có toạ độ Z; ST_DWithin, ST_Distance trên geography cho kết quả bằng "
             "mét; logic không gian và ràng buộc viết bằng PL/pgSQL đặt cạnh dữ liệu"],
            ["Xác thực", "JWT + bcrypt", "Phân quyền ba vai trò nhân viên / quản lý / quản trị"],
            ["Dữ liệu nền", "OpenStreetMap qua Overpass API",
             "Nguồn footprint toà nhà miễn phí, giấy phép ODbL"],
            ["Chạy demo", "Windows: PostgreSQL portable + tệp .bat; Linux/macOS: Docker + chay-demo.sh",
             "Clone về là chạy được, không phụ thuộc dịch vụ đám mây"],
        ],
        widths=[1.0, 2.3, 2.8])
    b.para("Lưu ý kỹ thuật bắt buộc: Geolocation API chỉ hoạt động trên kết nối HTTPS "
           "hoặc localhost. Khi trình diễn trên điện thoại phải dùng tên miền có chứng "
           "chỉ hoặc công cụ tạo đường hầm như ngrok; mở bằng địa chỉ IP nội bộ sẽ bị "
           "trình duyệt từ chối cấp quyền định vị.", bold=True)


def ch3_giao_dien(b):
    b.para("Ứng dụng là một trang web duy nhất, chia tab theo vai trò: nhân viên thấy Chấm công và "
           "Lịch sử; quản lý thấy thêm tab Quản lý; quản trị viên thấy thêm tab Quản trị. Tất cả "
           "màn hình dưới đây đã được cài đặt và chụp từ ứng dụng đang chạy với dữ liệu mẫu.")
    b.table(
        ["STT", "Màn hình", "Vai trò", "Thành phần chính"],
        [
            ["1", "Đăng nhập", "mọi người", "Biểu mẫu, gợi ý tài khoản thử nghiệm"],
            ["2", "Chấm công", "mọi người",
             "Thông tin văn phòng và khối MAP, chọn tầng, nguồn vị trí GPS / mô phỏng, nút VÀO / RA"],
            ["3", "Bản đồ 3D", "mọi người",
             "Toà nhà LOD3 / LOD1, khối MAP, tấm sàn tầng đang chọn, điểm chấm công"],
            ["4", "Lịch sử chấm công", "mọi người", "Màu theo trạng thái, gửi giải trình, xuất CSV"],
            ["5", "Bảng điều khiển quản lý", "quản lý",
             "Số liệu tổng hợp, cảnh báo R1–R4, duyệt đơn, báo cáo công, xuất CSV"],
            ["6", "Quản trị — Thống kê", "quản trị", "Số liệu dữ liệu nền, chấm công theo khối"],
            ["7", "Quản trị — Toà nhà", "quản trị", "Thêm / sửa / xoá; vẽ footprint, xem trước LOD3"],
            ["8", "Quản trị — Văn phòng & khối MAP", "quản trị",
             "Thêm / sửa / xoá; dải tầng, dung sai, đa giác riêng; xem trước khối"],
            ["9", "Quản trị — Nhân viên, ca, công ty, phòng ban", "quản trị",
             "Thêm / sửa / xoá kèm tài khoản; phân ca theo khoảng ngày"],
        ],
        widths=[0.4, 1.8, 0.8, 3.1])

    b.heading("3.2.1. Màn hình đăng nhập", 3)
    b.image(os.path.join(SHOT, "08-dang-nhap.png"), "Hình 3.1 — Màn hình đăng nhập", max_w=3.6)
    b.bullets([
        "Hai ô tên đăng nhập và mật khẩu; máy chủ kiểm tra bằng bcrypt và trả về JWT có hạn 8 giờ.",
        "Bảng tài khoản thử nghiệm bên dưới: bấm vào tên đăng nhập là điền sẵn để trình diễn nhanh.",
        "Tài khoản bị chuyển sang “nghỉ việc” không đăng nhập được; JWT lưu ở trình duyệt nên tải lại "
        "trang không phải đăng nhập lại.",
    ])

    b.heading("3.2.2. Màn hình chấm công", 3)
    b.image(os.path.join(SHOT, "03-app-cham-cong.png"),
            "Hình 3.2 — Màn hình chấm công: chấm công đúng tầng 6, kết quả HỢP LỆ")
    b.bullets([
        ("Thông tin làm việc: ", "công ty, văn phòng, toà nhà, dải tầng, dải cao độ khối (z_min – z_max) "
         "và dung sai δxy, δz — đọc từ CSDL theo nhân viên đang đăng nhập."),
        ("Thanh chọn tầng: ", "kéo tới tầng đang làm việc; dòng dưới hiện cao độ suy ra từ tầng, và "
         "tấm sàn tầng đó sáng lên trên bản đồ (xanh lá nếu trong dải được phép, hổ phách nếu ngoài)."),
        ("Nguồn vị trí: ", "GPS thiết bị (Geolocation API) hoặc Mô phỏng — bấm lên bản đồ để chọn "
         "vị trí, dùng khi trình diễn trong phòng."),
        ("Kết quả: ", "khung màu theo trạng thái, kèm khoảng cách ngang tới khối, cao độ, độ lệch cao độ "
         "và danh sách cảnh báo R1–R4 nếu có."),
    ])

    b.heading("3.2.3. Bản đồ 3D: toà nhà LOD3 và khối MAP", 3)
    b.para("Bản đồ dùng SceneView với nền bản đồ và địa hình thế giới. Toà nhà được dựng ở hai mức "
           "chi tiết, chuyển qua lại bằng nút LOD1 / LOD3 ở góc trái; ô “Khối MAP” bật tắt các khối "
           "văn phòng bán trong suốt (cam: Alpha Tech, xanh: Beta Finance, tím: Gamma Media).")
    b.image(os.path.join(SHOT, "06-lod3.png"),
            "Hình 3.3 — Toà nhà IFC One Saigon và toà nhà thêm bằng tab Quản trị, dựng ở LOD3")
    b.image(os.path.join(SHOT, "07-lod1.png"),
            "Hình 3.4 — Cùng góc nhìn ở LOD1 (khối đùn trơn) — mức dùng cho phép kiểm tra bao hàm")
    b.para("Mỗi thành phần LOD3 đều có popup cho biết lớp CityGML. Hai hình sau là cận cảnh lối "
           "vào chính (cửa xoay được chọn, lớp Door) và phần mái (sân đỗ trực thăng, lớp RoofSurface; "
           "thiết bị kỹ thuật và cột thu lôi thuộc BuildingInstallation):")
    b.image(os.path.join(SHOT, "11-lod3-loi-vao.png"),
            "Hình 3.5 — Lối vào chính LOD3: mái sảnh, cột, cửa xoay, băng kính và băng tường khối đế")
    b.image(os.path.join(SHOT, "12-lod3-mai.png"),
            "Hình 3.6 — Mái LOD3: tum kỹ thuật, thiết bị, sân đỗ trực thăng, cột thu lôi, tường chắn mái")

    b.heading("3.2.4. Lịch sử chấm công và giải trình", 3)
    b.image(os.path.join(SHOT, "10-lich-su.png"), "Hình 3.7 — Lịch sử chấm công của nhân viên")
    b.bullets([
        "Mỗi dòng là một bản ghi: thời điểm, loại VÀO / RA, tầng khai báo, cao độ, trạng thái tô màu, số cảnh báo.",
        "Bản ghi chưa hợp lệ có nút “Gửi giải trình”; sau khi gửi, cột cuối hiện trạng thái đơn (CHỜ DUYỆT, ĐÃ DUYỆT, TỪ CHỐI).",
        "Nút “Xuất CSV” tải lịch sử ra tệp mở đúng tiếng Việt trong Excel (BOM UTF-8, phân cách bằng dấu chấm phẩy).",
    ])

    b.heading("3.2.5. Bảng điều khiển của quản lý", 3)
    b.image(os.path.join(SHOT, "04-app-quan-ly.png"),
            "Hình 3.8 — Bảng điều khiển quản lý: một đơn giải trình đang chờ duyệt")
    b.bullets([
        ("Bảng điều khiển: ", "số bản ghi theo trạng thái, tổng cảnh báo và số đơn chờ duyệt."),
        ("Cảnh báo bất thường: ", "sắp theo mức độ (CAO trước) rồi theo thời gian, có cột đã xử lý."),
        ("Đơn giải trình: ", "duyệt hoặc từ chối. Duyệt thì bản ghi tự chuyển sang HỢP LỆ và cảnh "
         "báo liên quan được đóng, trong cùng một giao dịch."),
        ("Báo cáo công tháng: ", "lượt vào, số bản ghi theo trạng thái, số ngày công của từng nhân viên; xuất CSV."),
    ])
    b.image(os.path.join(SHOT, "13-quan-ly-sau-duyet.png"),
            "Hình 3.9 — Sau khi duyệt: bản ghi NGHI NGỜ thành HỢP LỆ, cảnh báo R1 đã xử lý")

    b.heading("3.2.6. Quản trị: thống kê dữ liệu nền", 3)
    b.image(os.path.join(SHOT, "14-quan-tri-thong-ke.png"),
            "Hình 3.10 — Tab Quản trị, mục Thống kê, bản đồ ảnh vệ tinh với hai toà nhà LOD3")
    b.para("Mục Thống kê cho số toà nhà, văn phòng, khối MAP đang hiệu lực, nhân viên, công ty, "
           "ca làm việc và tổng thể tích các khối (tính bằng diện tích nền trắc địa nhân chiều cao "
           "khối). Bảng “Chấm công theo khối MAP” đếm số bản ghi của từng khối theo ba trạng thái; "
           "bấm một dòng thì bản đồ bay tới khối đó.")

    b.heading("3.2.7. Quản trị: toà nhà", 3)
    b.image(os.path.join(SHOT, "15-quan-tri-toa-nha.png"),
            "Hình 3.11 — Sửa toà nhà: biểu mẫu bên trái, mô hình LOD3 xem trước bên phải")
    b.bullets([
        "Danh sách toà nhà kèm số tầng, chiều cao tầng, diện tích nền và số văn phòng.",
        "Biểu mẫu nhập tên, địa chỉ, cao độ nền, số tầng, chiều cao tầng, số tầng khối đế và nguồn dữ liệu.",
        "Footprint được vẽ trực tiếp trên bản đồ (bấm từng đỉnh, bấm đúp để kết thúc) hoặc sửa từng "
        "đỉnh; mô hình LOD3 dựng lại ngay mỗi khi đổi thông số.",
        "Sửa chiều cao tầng hay cao độ nền thì mọi khối MAP trong toà nhà được trigger tính lại; không "
        "xoá được toà nhà còn văn phòng.",
    ])

    b.heading("3.2.8. Quản trị: văn phòng và khối MAP", 3)
    b.image(os.path.join(SHOT, "05-quan-tri-khoi-map.png"),
            "Hình 3.12 — Sửa văn phòng: khối MAP tầng 9–12 xem trước (viền vàng), z = 35,40 → 50,60 m")
    b.para("Chọn công ty, toà nhà, dải tầng và dung sai. Nếu văn phòng chỉ thuê một phần mặt sàn, "
           "quản trị viên vẽ đa giác riêng; để trống thì dùng toàn bộ footprint. Cao độ khối không "
           "nhập tay: giao diện tính trước để xem, còn giá trị lưu do trigger trong CSDL suy ra. "
           "Khi nhập sai, cả giao diện lẫn CSDL đều chặn:")
    b.image(os.path.join(SHOT, "16-quan-tri-vuot-tang.png"),
            "Hình 3.13 — Nhập đến tầng 20 trong toà 18 tầng: khối báo đỏ, CSDL từ chối kèm thông báo")

    b.heading("3.2.9. Quản trị: nhân viên, ca làm việc và phân ca", 3)
    b.image(os.path.join(SHOT, "17-quan-tri-nhan-vien-ca.png"),
            "Hình 3.14 — Trái: sửa nhân viên và tài khoản. Phải: ca làm việc và lịch phân ca 7 ngày",
            max_w=5.2)
    b.bullets([
        "Nhân viên được tạo kèm tài khoản và vai trò; phòng ban lọc theo công ty đã chọn; để trống "
        "mật khẩu khi sửa nghĩa là giữ nguyên.",
        "Nhân viên đã có bản ghi chấm công không xoá cứng được (giữ lịch sử công) — chuyển sang "
        "“nghỉ việc” để khoá đăng nhập.",
        "Ca làm việc có giờ vào, giờ ra, số phút trễ cho phép; phân ca gán một ca cho một nhân viên "
        "trên một khoảng ngày, tuỳ chọn gồm cả cuối tuần.",
    ])

    b.para()
    b.para("Kiến trúc hệ thống", bold=True)
    b.para("Máy chủ Node.js với Express nói chuyện trực tiếp với PostgreSQL/PostGIS và phục vụ luôn "
           "giao diện web tĩnh, nên hệ thống chạy trên một cổng duy nhất — quan trọng vì Geolocation "
           "API chỉ cấp quyền định vị trên HTTPS hoặc localhost.")
    b.para("Phép kiểm tra bao hàm khối không viết lại ở tầng ứng dụng mà gọi thẳng hàm "
           "kiem_tra_bao_ham() và kiem_tra_r2() trong CSDL. Ràng buộc dữ liệu cũng nằm ở CSDL: "
           "trigger chặn văn phòng vượt số tầng toà nhà và tự tính lại z_min, z_max mỗi khi sửa dải "
           "tầng hoặc chiều cao tầng — dù sửa bằng giao diện hay bằng SQL đều được kiểm tra.")
    b.table(
        ["Phương thức", "Đường dẫn", "Quyền", "Chức năng"],
        [
            ["POST", "/api/dang-nhap", "—", "Đăng nhập, trả về JWT"],
            ["GET", "/api/toi, /api/khu-vuc, /api/toa-nha", "đã đăng nhập",
             "Thông tin nhân viên, khối MAP, toà nhà để dựng bản đồ"],
            ["GET", "/api/khu-vuc/:id/ssm", "đã đăng nhập", "Khối MAP trải theo mô hình SSM"],
            ["POST", "/api/cham-cong", "đã đăng nhập",
             "Kiểm tra bao hàm khối, áp R1–R4, ghi bản ghi và cảnh báo"],
            ["GET / POST", "/api/cham-cong/lich-su, /api/giai-trinh", "đã đăng nhập",
             "Lịch sử của chính mình, gửi đơn giải trình"],
            ["GET / PUT", "/api/giai-trinh, /api/canh-bao, /api/dashboard, /api/bao-cao/cong",
             "quản lý", "Duyệt đơn, cảnh báo, số liệu tổng hợp, báo cáo công"],
            ["GET / POST / PUT / DELETE",
             "/api/quan-tri/{toa-nha, van-phong, nhan-vien, ca-lam-viec, cong-ty, phong-ban, phan-ca}",
             "quản trị", "Thêm / sửa / xoá dữ liệu nền"],
            ["GET", "/api/quan-tri/thong-ke", "quản trị", "Thống kê dữ liệu nền và theo khối"],
        ],
        widths=[1.0, 2.3, 0.9, 1.9])


def ch4_ket_qua(b):
    b.para("Bản dựng thử nghiệm sử dụng dữ liệu thật: footprint toà nhà IFC One Saigon "
           "lấy từ OpenStreetMap (way/306578560), 42 tầng, chiều cao 195,3 m; cao độ nền "
           "giả định 5 m nên chiều cao tầng trung bình là 4,65 m. Ba văn phòng ở ba dải "
           "tầng khác nhau dùng chung một footprint — tức là có cùng toạ độ kinh độ, vĩ độ.")
    b.para()
    b.para("Kết quả ba tình huống kiểm thử", bold=True)
    b.table(
        ["Tình huống", "Cao độ điểm", "Kết quả hệ thống 3D", "Kết quả hàng rào 2D"],
        [
            ["Nhân viên Alpha Tech chấm công tại tầng 6", "30,58 m", "HỢP LỆ", "Hợp lệ"],
            ["Cùng toạ độ, khai báo tầng 22", "104,98 m",
             "NGHI NGỜ + R1 (lệch 62,78 m ≈ 13,5 tầng)", "Hợp lệ — bỏ sót"],
            ["Cách toà nhà khoảng 300 m", "30,58 m", "NGOÀI VÙNG", "Ngoài vùng"],
        ],
        widths=[2.2, 0.9, 1.8, 1.2])
    b.para("Cao độ khai báo tính ở giữa tầng: z_nền + (tầng − 0,5) × h_tầng.", italic=True)
    b.para("Tình huống thứ hai là kết quả quan trọng nhất của đồ án: cùng một toạ độ "
           "ngang, hàng rào 2D kết luận hợp lệ trong khi mô hình MAP phát hiện được "
           "sai lệch 13,5 tầng và chuyển bản ghi sang trạng thái cần xác minh.", bold=True)
    b.image(os.path.join(SHOT, "02-ket-qua-nghi-ngo.png"),
            "Hình 4.1 — Tình huống 2 (sai tầng): tấm sàn tầng 22 nằm trong dải của Beta "
            "Finance; kết quả NGHI NGỜ kèm cảnh báo R1")
    b.image(os.path.join(SHOT, "09-ngoai-vung.png"),
            "Hình 4.2 — Tình huống 3 (ngoài vùng): cách khối 213 m, vượt xa δxy = 25 m; vì di "
            "chuyển quá nhanh so với lần trước nên có thêm cảnh báo R2")
    b.para()
    b.para("Kiểm thử tự động (npm test) — 34/34 đạt", bold=True)
    b.para("Lược đồ chạy trên PostgreSQL 17 + PostGIS: 14 bảng, 8 hàm, 4 trigger. Kịch bản "
           "kiểm thử gọi API thật trên CSDL thật rồi tự dọn dữ liệu thử nghiệm.")
    b.image(os.path.join(SHOT, "18-kiem-thu.png"), "Hình 4.3 — Kết quả chạy npm test: 34/34 ca đạt")
    b.table(
        ["Nhóm", "Nội dung kiểm thử"],
        [
            ["Mô hình MAP", "Ba tình huống trên và sinh cảnh báo R1"],
            ["Phân quyền", "Nhân viên và quản lý bị chặn (HTTP 403) khỏi API quản trị"],
            ["Thêm / sửa / xoá", "Công ty, phòng ban, toà nhà (từ đa giác), văn phòng, nhân viên, ca"],
            ["Ràng buộc CSDL",
             "Chặn văn phòng vượt số tầng; chặn khối vẽ ra ngoài toà nhà; chặn trùng tên đăng "
             "nhập; không xoá toà nhà còn văn phòng; không xoá cứng nhân viên đã có công"],
            ["Tự tính lại khối",
             "Sửa dải tầng 3–5 → 6–7: khối 11–23 m → 23–31 m; sửa chiều cao tầng 4 → 5 m: "
             "khối bên trong → 28–38 m"],
            ["Mô hình SSM", "Khối hình hộp trải ra đúng 8 NODE, 6 FACE, 24 NODE ON FACE"],
            ["Luồng đầu–cuối",
             "Nhân viên mới đăng nhập, chấm công trong khối vừa dựng → HỢP LỆ; chuyển nghỉ "
             "việc → không đăng nhập được"],
        ],
        widths=[1.4, 4.7])
    b.para()
    b.para("Đáp ứng yêu cầu môn học", bold=True)
    b.table(
        ["Yêu cầu (Danh sách đồ án 2026)", "Đáp ứng"],
        [
            ["Thêm, xoá, sửa dữ liệu", "Tab Quản trị: sáu loại dữ liệu và phân ca"],
            ["Thống kê dữ liệu",
             "Bảng điều khiển quản lý, báo cáo công tháng, thống kê theo khối, xuất CSV"],
            ["Hiển thị thực thể không gian trên bản đồ",
             "Toà nhà, khối MAP, tấm sàn, điểm chấm công trên SceneView"],
            ["Bản đồ 3D mức độ chi tiết 3", "Toà nhà LOD3 sinh tự động, gắn lớp ngữ nghĩa CityGML"],
        ],
        widths=[2.4, 3.7])

    b.para("Hạn chế", bold=True)
    b.numbers([
        "Độ cao GPS trong nhà rất kém. Tín hiệu vệ tinh gần như không thu được trong "
        "lòng nhà cao tầng; thuộc tính altitude mà Geolocation API trả về thường là "
        "null hoặc có sai số hàng chục mét, lớn hơn cả chiều cao vài tầng. Hệ thống "
        "vì vậy phải chấp nhận nguồn cao độ hỗn hợp: ưu tiên cao độ đo được, khi "
        "không có thì dùng tầng người dùng khai báo, và mô hình chỉ đóng vai trò đối "
        "chiếu chứ không tự quyết định.",
        "Chưa sử dụng cảm biến bổ trợ. Giải pháp công nghiệp cho định vị trong nhà là "
        "Wi-Fi RSSI, BLE beacon hoặc khí áp kế; trong phạm vi đồ án chỉ nêu hướng, "
        "chưa cài đặt.",
        "Dữ liệu chiều cao công trình từ OpenStreetMap rất thiếu. Khảo sát trên phạm "
        "vi TP. Hồ Chí Minh cho thấy trong 105.609 công trình có footprint, chỉ 3.944 "
        "công trình (khoảng 3,7 %) có thuộc tính height hoặc building:levels; phần "
        "còn lại phải nhập thủ công.",
        "Không thể chặn hoàn toàn việc giả lập GPS ở mức hệ điều hành từ phía ứng "
        "dụng web. Các quy tắc R2–R4 chỉ làm tăng chi phí gian lận chứ không loại bỏ "
        "được hoàn toàn.",
    ])


def ch4_dinh_huong(b):
    b.bullets([
        "Bổ sung định vị trong nhà bằng BLE beacon đặt theo tầng, hợp nhất kết quả với "
        "mô hình MAP để xác định tầng độc lập với GPS.",
        "Nâng lên LOD4 (nội thất: từng phòng, hành lang, lõi thang) để chấm công theo "
        "khu vực làm việc thay vì theo cả dải tầng; khi đó mỗi phòng là một BODY của SSM.",
        "Phân tích vùng che khuất tín hiệu GPS dựa trên mô hình khối của các toà nhà "
        "lân cận, từ đó tự động hiệu chỉnh dung sai ngang theo từng vị trí thay vì "
        "dùng một giá trị cố định.",
        "Mở rộng cho công trường xây dựng: khối MAP có cao độ thay đổi theo tiến độ "
        "thi công, tức bổ sung chiều thứ tư là thời gian.",
        "Tích hợp với hệ thống tính lương và hệ thống quản lý nhân sự sẵn có của doanh nghiệp.",
    ])


# ---------------------------------------------------------------------------
def main():
    nguon_mau = TEMPLATE
    if not os.path.exists(TEMPLATE):
        # thử lấy mẫu trong zip tài liệu môn học
        import glob, io, zipfile
        for z in glob.glob(os.path.join(ZIP_TAI_LIEU, "*.zip")):
            with zipfile.ZipFile(z) as f:
                ten = [n for n in f.namelist() if n.endswith("Mau_do_an_IE402.docx")]
                if ten:
                    nguon_mau = io.BytesIO(f.read(ten[0]))
                    break
    if nguon_mau is TEMPLATE and not os.path.exists(TEMPLATE):
        raise SystemExit(
            "Không tìm thấy tệp mẫu: " + TEMPLATE
            + "\nScript này điền nội dung vào các chỗ giữ chỗ <...> của mẫu đồ án do"
            + " lớp phát, nên bắt buộc phải có tệp đó."
            + "\nBản .docx đã sinh trước đây vẫn nằm ở thư mục gốc dự án và dùng được"
            + " bình thường; chỉ là không sinh lại được cho tới khi chép lại tệp mẫu."
            + "\nBáo cáo Checkpoint 1 (tools/build_checkpoint1.py) không bị ảnh hưởng.")

    doc = Document(nguon_mau)

    # Tên đồ án trên trang bìa
    for p in doc.paragraphs:
        if "<Tên đồ án>" in p.text:
            for r in p.runs:
                r.text = ""
            p.runs[0].text = TIEU_DE
            break

    # --- điền tên nhóm và bảng thành viên trên trang bìa
    for p2 in doc.paragraphs:
        if p2.text.strip().startswith("Tên nhóm:"):
            for r in p2.runs:
                r.text = ""
            if p2.runs:
                p2.runs[0].text = "Tên nhóm: " + TEN_NHOM
            break

    if doc.tables:
        bang = doc.tables[0]
        for k, (mssv, ho_ten) in enumerate(THANH_VIEN, start=1):
            if k < len(bang.rows):
                o = bang.rows[k].cells
                o[0].text = str(k)
                o[1].text = mssv
                o[2].text = ho_ten

    fill(doc, "<Viết giới thiệu về đề tài", ch1_tong_quan)
    fill(doc, "<Vấn đề hiện đang tồn tại", ch1_dat_van_de)
    fill(doc, "<Trình bày ý nghĩa và mục tiêu", ch1_y_nghia)
    fill(doc, "<trình bày mô hình 2D, 3D", ch2_co_so_ly_thuyet)
    fill(doc, "<trình bày cách mà bạn biến đổi", ch2_mo_hinh_hoa)
    fill(doc, "<vẽ mô hình ERD", ch2_erd)
    fill(doc, "<chuyển mô hình ERD thành mô hình quan hệ", ch2_quan_he)
    fill(doc, "<Trình bày các use case", ch2_usecase)
    fill(doc, "<trình bày các DFD", ch2_dfd)
    fill(doc, "<Vẽ một số sơ đồ trình tự", ch2_sequence)
    fill(doc, "<Trình bày các công nghệ sử dụng>", ch3_cong_nghe)
    fill(doc, "<Chụp hình giao diện ứng dụng", ch3_giao_dien)
    fill(doc, "<Hình ảnh thực tế từ ứng dụng", ch4_ket_qua)
    fill(doc, "<Định hướng phát triển mở rộng", ch4_dinh_huong)

    danh_lai_so_hinh(doc)
    dien_danh_muc(doc)
    dien_tai_lieu(doc)
    bat_cap_nhat_truong(doc)
    doc.save(OUT)
    print("DONE ->", OUT)


def danh_lai_so_hinh(doc):
    """Đánh lại số hình theo thứ tự xuất hiện trong từng chương (Hình <chương>.<thứ tự>)."""
    import re
    chuong, dem = 0, 0
    for p in doc.paragraphs:
        m = re.match(r"^Chương (\d+)", p.text.strip())
        if m and p.style.name.startswith("Heading 1"):
            chuong, dem = int(m.group(1)), 0
            continue
        if re.match(r"^Hình \d+\.\d+ — ", p.text.strip()) and p.runs:
            dem += 1
            r = p.runs[0]
            r.text = re.sub(r"^Hình \d+\.\d+", "Hình %d.%d" % (chuong, dem), r.text)


def dien_danh_muc(doc):
    """Thay các dòng giữ chỗ 1.1, 1.2, ... của mẫu bằng danh mục hình thật.

    Bảng trong báo cáo không đánh số nên bỏ mục "Bảng biểu" của mẫu."""
    import re
    hinh = [p.text.strip() for p in doc.paragraphs if re.match(r"^Hình \d+\.\d+ — ", p.text.strip())]
    ps = doc.paragraphs
    i_hinh = next(i for i, p in enumerate(ps) if p.text.strip() == "Hình ảnh")
    i_bang = next(i for i, p in enumerate(ps) if p.text.strip() == "Bảng biểu")
    giu_cho = ps[i_hinh + 1:i_bang]
    mau = giu_cho[0]
    for t in hinh:
        moi = copy.deepcopy(mau._element)
        mau._element.addprevious(moi)
        from docx.text.paragraph import Paragraph
        pg = Paragraph(moi, mau._parent)
        for r in pg.runs[1:]:
            r._element.getparent().remove(r._element)
        if pg.runs:
            pg.runs[0].text = t
        else:
            pg.add_run(t)
    xoa = list(giu_cho)
    ps = doc.paragraphs
    i_bang = next(i for i, p in enumerate(ps) if p.text.strip() == "Bảng biểu")
    i_tl = next(i for i, p in enumerate(ps) if p.text.strip() == "Tài liệu tham khảo")
    xoa += [p for p in ps[i_bang:i_tl] if p.text.strip() in ("Bảng biểu", "1.1", "1.2", "...")]
    for p in xoa:
        p._element.getparent().remove(p._element)


TAI_LIEU = [
    "Nguyễn Gia Tuấn Anh, Dương Thúy Nga (2017). Cơ sở dữ liệu GIS và ứng dụng "
    "(tài liệu chính của môn học)",
    "Abdul-Rahman, Alias; Pilouk, Morakot (2008). Spatial Data Modelling for 3D GIS, "
    "Springer-Verlag, Berlin Heidelberg",
    "Molenaar, Martien (1990). “A formal data structure for three dimensional vector maps”, "
    "Proceedings of the 4th International Symposium on Spatial Data Handling, Zürich",
    "Zlatanova, Sisi (2000). 3D GIS for Urban Development, luận án tiến sĩ, ITC Dissertation "
    "Series No. 69, Enschede",
    "Coors, Volker (2003). “3D-GIS in networking environments”, Computers, Environment and "
    "Urban Systems, 27(4), 345–357",
    "Gröger, Gerhard; Kolbe, Thomas H.; Nagel, Claus; Häfele, Karl-Heinz (2012). "
    "“OGC City Geography Markup Language (CityGML) Encoding Standard, Version 2.0.0”, "
    "Open Geospatial Consortium, OGC 12-019",
    "Phan Thanh Vũ (2026). “Hệ thống thông tin địa lý 3 chiều” (bài giảng) và “ArcGIS JS — "
    "Lab 1, Lab 2”, Trường Đại học Công nghệ Thông tin — ĐHQG TP. HCM",
    "Esri (2024). “ArcGIS Maps SDK for JavaScript 4.29 — API Reference”, "
    "<https://developers.arcgis.com/javascript/latest/api-reference/>, truy cập ngày 14/10/2026",
    "PostGIS Project Steering Committee (2024). “PostGIS 3.5 Manual”, "
    "<https://postgis.net/docs/manual-3.5/>, truy cập ngày 14/10/2026",
    "OpenStreetMap contributors (2026). “Way 306578560 — IFC One Saigon”, "
    "<https://www.openstreetmap.org/way/306578560>, truy cập ngày 14/10/2026",
    "W3C (2022). “Geolocation API”, W3C Recommendation, "
    "<https://www.w3.org/TR/geolocation/>, truy cập ngày 14/10/2026",
]


def dien_tai_lieu(doc):
    """Thay phần hướng dẫn cách trích dẫn của mẫu bằng danh sách tài liệu thật."""
    ps = doc.paragraphs
    i = next(k for k, p in enumerate(ps) if p.text.strip() == "Tài liệu tham khảo")
    sau = [p for p in ps[i + 1:]]
    mau = next((p for p in sau if p.text.strip()), None)
    for p in sau:
        p._element.getparent().remove(p._element)
    neo = ps[i]._element
    for k, t in enumerate(TAI_LIEU, start=1):
        pg = doc.add_paragraph()
        pg.paragraph_format.left_indent = Inches(0.35)
        pg.paragraph_format.first_line_indent = Inches(-0.35)
        pg.paragraph_format.space_after = Pt(4)
        pg.add_run("[%d]  " % k)
        pg.add_run(t + ".")
        neo.addnext(pg._element)
        neo = pg._element


def bat_cap_nhat_truong(doc):
    """Đặt cờ để Word cập nhật mục lục (số trang) ngay khi mở tệp."""
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    st = doc.settings.element
    if st.find(qn("w:updateFields")) is None:
        e = OxmlElement("w:updateFields")
        e.set(qn("w:val"), "true")
        st.append(e)


if __name__ == "__main__":
    main()
