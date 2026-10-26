# -*- coding: utf-8 -*-
"""
Chạy `npm test` (máy chủ phải đang chạy) rồi vẽ kết quả thành ảnh kiểu cửa sổ
terminal để chèn vào báo cáo:  docs/18-kiem-thu.png

    python3 tools/anh_kiem_thu.py
"""
import os
import re
import subprocess

from PIL import Image, ImageDraw, ImageFont

GOC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RA = os.path.join(GOC, "docs", "18-kiem-thu.png")
# Liberation Mono đủ dấu tiếng Việt; ký hiệu ✔ ✘ vẽ bằng DejaVu Sans
FONT = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"
FONT_DAM = "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf"
FONT_KY_HIEU = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

kq = subprocess.run(["npm", "test", "--silent"], cwd=os.path.join(GOC, "server"),
                    capture_output=True, text=True)
dong = [re.sub(r"\x1b\[[0-9;]*m", "", d) for d in kq.stdout.splitlines()]
dong = ["$ npm test"] + [d for d in dong if d.strip() != ""]

# chia hai cột bằng nhau theo số dòng
cat = (len(dong) + 1) // 2
cot = [dong[:cat], dong[cat:]]

co = 17
f = ImageFont.truetype(FONT, co)
fd = ImageFont.truetype(FONT_DAM, co)
fk = ImageFont.truetype(FONT_KY_HIEU, co)
cao_dong = int(co * 1.55)
rong_cot = max(int(f.getlength(d)) for d in dong) + 40
W = rong_cot * 2 + 60
H = cao_dong * max(len(c) for c in cot) + 90
img = Image.new("RGB", (W, H), (30, 34, 42))
ve = ImageDraw.Draw(img)
# thanh tiêu đề cửa sổ
ve.rectangle([0, 0, W, 34], fill=(44, 49, 60))
for k, mau in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
    ve.ellipse([16 + k * 22, 11, 28 + k * 22, 23], fill=mau)
ve.text((W // 2 - 120, 8), "ie402-chamcong-3d/server", font=f, fill=(170, 178, 190))

for c, ds in enumerate(cot):
    x = 30 + c * (rong_cot + 10)
    y = 52
    for d in ds:
        if d.startswith("$"):
            mau, ft = (120, 200, 255), fd
        elif "✔" in d:
            mau, ft = (120, 220, 140), f
        elif "✘" in d:
            mau, ft = (255, 120, 110), fd
        elif d.startswith("["):
            mau, ft = (255, 200, 90), fd
        elif d.startswith("Kết quả"):
            mau, ft = (120, 220, 140), fd
        else:
            mau, ft = (200, 206, 214), f
        m = re.match(r"^(\s*)([\u2714\u2718])(.*)$", d)
        if m:
            x0 = x + f.getlength(m.group(1))
            ve.text((x0, y), m.group(2), font=fk, fill=mau)
            ve.text((x0 + fk.getlength(m.group(2)) + 4, y), m.group(3), font=ft, fill=mau)
        else:
            ve.text((x, y), d, font=ft, fill=mau)
        y += cao_dong

img.save(RA)
print("DONE ->", RA, "|", dong[-1])
