# -*- coding: utf-8 -*-
"""
Sinh hình minh hoạ mô hình SSM (Zlatanova, 2000) áp vào khối MAP:
  - trái : lược đồ đối tượng SSM (BODY, FACE, NODE + quan hệ NODE ON FACE,
           FACE IN BODY), đánh dấu phần mà khối MAP sử dụng;
  - phải : một khối MAP lăng trụ đứng với NODE và FACE được đánh số đúng như
           hàm ssm_cua_khoi() trong CSDL sinh ra.

    python tools/so_do_ssm.py      -> docs/diagrams/08-ssm-map.png
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "diagrams", "08-ssm-map.png")

XANH = "#1f6feb"
XAM = "#8c959f"
CAM = "#e8622a"

fig = plt.figure(figsize=(13, 6.2), dpi=160)

# ---------------------------------------------------------------- trái
ax = fig.add_axes([0.02, 0.05, 0.46, 0.88])
ax.set_xlim(0, 10)
ax.set_ylim(0, 10)
ax.axis("off")
ax.set_title("a) Lược đồ đối tượng SSM dùng cho khối MAP", fontsize=12, loc="left")


def hop(x, y, w, h, tieu_de, dong, mau):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.15",
                                fc="white", ec=mau, lw=2))
    ax.add_patch(FancyBboxPatch((x, y + h - 0.6), w, 0.6, boxstyle="round,pad=0.02,rounding_size=0.15",
                                fc=mau, ec=mau, lw=2))
    ax.text(x + w / 2, y + h - 0.3, tieu_de, ha="center", va="center", color="white",
            fontsize=11, fontweight="bold")
    for i, d in enumerate(dong):
        ax.text(x + 0.15, y + h - 0.95 - i * 0.42, d, ha="left", va="center", fontsize=9)


def mui_ten(x1, y1, x2, y2, nhan, mau="#333"):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=14,
                                 color=mau, lw=1.4))
    ax.text((x1 + x2) / 2 + 0.1, (y1 + y2) / 2 + 0.15, nhan, fontsize=8.5, color=mau,
            fontstyle="italic")


# đối tượng cơ sở
hop(0.2, 7.3, 2.1, 2.0, "BODY", ["#BID", "= khối MAP", "(1 văn phòng)"], XANH)
hop(2.6, 7.3, 2.1, 2.0, "SURFACE", ["#SID", "(không dùng)"], XAM)
hop(5.0, 7.3, 2.1, 2.0, "LINE", ["#LID", "(không dùng)"], XAM)
hop(7.4, 7.3, 2.1, 2.0, "POINT", ["#PID", "= điểm chấm công"], CAM)
# đối tượng nguyên tố
hop(1.4, 2.6, 3.0, 2.7, "FACE", ["#FID", "BID (FACE IN BODY)", "loại: ĐÁY / NẮP / BÊN",
                                 "phẳng, có hướng"], XANH)
hop(6.0, 2.6, 3.0, 2.7, "NODE", ["#NID", "X, Y, Z", "(Z = z_min hoặc z_max)"], XANH)
hop(3.3, 0.1, 3.4, 1.9, "NODE ON FACE", ["#FID, #NID, thứ tự", "(NODE có thứ tự trên FACE)"], XANH)

mui_ten(1.25, 7.3, 2.4, 5.3, "")
ax.text(1.95, 6.4, "FACE IN BODY", fontsize=8.5, color="#333", fontstyle="italic")
mui_ten(2.9, 2.6, 4.2, 2.0, "")
mui_ten(7.5, 2.6, 5.9, 2.0, "")
mui_ten(8.45, 7.3, 8.0, 5.3, "")
ax.text(8.2, 6.35, "kiểm tra\nbao hàm", fontsize=8.5, color=CAM, fontstyle="italic")
ax.text(9.6, 9.75, "đối tượng cơ sở", fontsize=9, color="#57606a", ha="right")
ax.text(5.2, 5.75, "đối tượng nguyên tố", fontsize=9, color="#57606a", ha="center")

# ---------------------------------------------------------------- phải
ax3 = fig.add_axes([0.50, 0.02, 0.49, 0.92], projection="3d")
ax3.set_title("b) Khối MAP trải theo SSM (n = 5 đỉnh đáy)", fontsize=12, loc="left")

day = [(0, 0), (4, 0), (5, 2.5), (2.5, 4), (-0.5, 2.5)]
n = len(day)
z0, z1 = 0.0, 3.0
canh = []
for i in range(n):
    a, b = day[i], day[(i + 1) % n]
    canh.append([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)])
ax3.add_collection3d(Poly3DCollection(canh, facecolors=(0.12, 0.43, 0.92, 0.10),
                                      edgecolors=XANH, linewidths=1.2))
ax3.add_collection3d(Poly3DCollection([[(x, y, z0) for x, y in day]],
                                      facecolors=(0.9, 0.38, 0.16, 0.15), edgecolors=CAM, linewidths=1.6))
ax3.add_collection3d(Poly3DCollection([[(x, y, z1) for x, y in day]],
                                      facecolors=(0.1, 0.5, 0.2, 0.12), edgecolors="#1a7f37", linewidths=1.6))
for i, (x, y) in enumerate(day):
    ax3.scatter([x], [y], [z0], color=CAM, s=18)
    ax3.scatter([x], [y], [z1], color="#1a7f37", s=18)
    ax3.text(x, y, z0 - 0.35, "N%d" % (i + 1), fontsize=8.5, color=CAM, ha="center")
    ax3.text(x, y, z1 + 0.2, "N%d" % (n + i + 1), fontsize=8.5, color="#1a7f37", ha="center")
tx = sum(p[0] for p in day) / n
ty = sum(p[1] for p in day) / n
for i in range(n):
    a, b = day[i], day[(i + 1) % n]
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    # đẩy nhãn ra ngoài mặt bên để không đè lên NODE
    dx, dy = mx - tx, my - ty
    d = (dx * dx + dy * dy) ** 0.5
    ax3.text(mx + dx / d * 0.7, my + dy / d * 0.7, z0 + 1.1, "F%d" % (i + 2),
             fontsize=9.5, color=XANH, ha="center", fontweight="bold")
ax3.text(2.0, 1.6, z0 + 0.05, "F0 đáy (z_min)", fontsize=8.5, color=CAM)
ax3.text(2.0, 1.6, z1 + 0.05, "F1 nắp (z_max)", fontsize=8.5, color="#1a7f37")
ax3.set_xlim(-1, 5.5)
ax3.set_ylim(-0.5, 4.5)
ax3.set_zlim(-0.5, 3.6)
ax3.view_init(elev=22, azim=-58)
ax3.set_axis_off()
ax3.text2D(0.02, 0.02,
           "2n NODE · n + 2 FACE · 2n + 4n = 6n quan hệ NODE ON FACE\n"
           "Mặt đáy đi theo chiều kim đồng hồ (pháp tuyến hướng xuống),\n"
           "mặt nắp và mặt bên ngược chiều kim đồng hồ (pháp tuyến hướng ra ngoài).",
           transform=ax3.transAxes, fontsize=8.5, color="#57606a")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
fig.savefig(OUT, bbox_inches="tight", facecolor="white")
print("DONE ->", OUT)
