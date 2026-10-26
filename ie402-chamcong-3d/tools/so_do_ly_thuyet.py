# -*- coding: utf-8 -*-
"""
Sinh các hình minh hoạ cơ sở lý thuyết cho báo cáo (docs/diagrams/):
  09-bon-huong-3d.png      bốn hướng biểu diễn đối tượng 3D (B-REP, voxel, CSG, tổ hợp)
  10-lod-citygml.png       các mức chi tiết LOD0–LOD4 theo CityGML
  11-ray-casting.png       kiểm tra điểm thuộc đa giác bằng tia
  12-map-dung-sai.png      khối MAP, vùng dung sai và ba trạng thái
  13-cao-do-gnss.png       cao độ elipxoit, cao độ chuẩn (geoid) và cao độ nền
  14-vector-2d.png         ba mô hình vector 2D: spaghetti, mạng, topology

    python3 tools/so_do_ly_thuyet.py
"""
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyArrowPatch, Polygon as MPoly, Rectangle
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

GOC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RA = os.path.join(GOC, "docs", "diagrams")
os.makedirs(RA, exist_ok=True)

NAVY = "#13294B"
CAM = "#E8622A"
XANH = "#1F6FEB"
TIM = "#8250DF"
LA = "#1A7F37"
VANG = "#C98A0B"
DO = "#C0392B"
XAM = "#57606A"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10})


def luu(fig, ten):
    fig.savefig(os.path.join(RA, ten), dpi=170, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print("DONE ->", ten)


def hop(x0, y0, z0, dx, dy, dz):
    """Sáu mặt của một hình hộp."""
    x1, y1, z1 = x0 + dx, y0 + dy, z0 + dz
    return [
        [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)],
        [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
        [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],
        [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)],
        [(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)],
        [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)],
    ]


def tru(cx, cy, r, z0, z1, n=28):
    t = np.linspace(0, 2 * np.pi, n + 1)
    mat = []
    for i in range(n):
        a, b = t[i], t[i + 1]
        mat.append([(cx + r * np.cos(a), cy + r * np.sin(a), z0), (cx + r * np.cos(b), cy + r * np.sin(b), z0),
                    (cx + r * np.cos(b), cy + r * np.sin(b), z1), (cx + r * np.cos(a), cy + r * np.sin(a), z1)])
    mat.append([(cx + r * np.cos(a), cy + r * np.sin(a), z1) for a in t])
    return mat


def truc3d(ax, gioi=(0, 4)):
    ax.set_xlim(*gioi); ax.set_ylim(*gioi); ax.set_zlim(*gioi)
    ax.set_box_aspect((1, 1, 1))
    ax.set_axis_off()
    ax.view_init(elev=22, azim=-55)


# ---------------------------------------------------------------- 09
def bon_huong():
    fig = plt.figure(figsize=(13, 3.9))
    # B-REP: hộp với đỉnh, cạnh, mặt được đánh dấu
    ax = fig.add_subplot(1, 4, 1, projection="3d")
    mat = hop(0.8, 0.8, 0.5, 2.4, 2.0, 2.4)
    ax.add_collection3d(Poly3DCollection(mat, facecolors=(0.12, 0.43, 0.92, 0.12), edgecolors=XANH, linewidths=1.4))
    for p in set(v for m in mat for v in m):
        ax.scatter(*p, color=CAM, s=18)
    ax.text(1.4, 1.8, 3.25, "FACE", color=XANH, fontsize=9, ha="center")
    ax.text(3.35, 0.7, 0.4, "NODE", color=CAM, fontsize=9)
    truc3d(ax)
    ax.set_title("B-REP\nmô tả bằng biên:\nđiểm – cạnh – mặt", fontsize=10)

    # Voxel: các ô lập phương xấp xỉ một khối tròn
    ax = fig.add_subplot(1, 4, 2, projection="3d")
    n = 8
    x, y, z = np.indices((n, n, n))
    cau = (x - 3.5) ** 2 + (y - 3.5) ** 2 + (z - 3.5) ** 2 <= 3.6 ** 2
    ax.voxels(cau, facecolors="#9EC5FE", edgecolors="#4A7BD0", linewidth=0.3)
    ax.set_xlim(0, n); ax.set_ylim(0, n); ax.set_zlim(0, n)
    ax.set_box_aspect((1, 1, 1)); ax.set_axis_off(); ax.view_init(elev=22, azim=-55)
    ax.set_title("Voxel (3D Array, Octree)\nchia không gian thành ô,\nbiên răng cưa", fontsize=10)

    # CSG: hộp ∪ trụ
    ax = fig.add_subplot(1, 4, 3, projection="3d")
    ax.add_collection3d(Poly3DCollection(hop(0.6, 0.9, 0.5, 2.8, 2.2, 1.4), facecolors=(0.91, 0.38, 0.16, 0.25),
                                         edgecolors=CAM, linewidths=1.0))
    ax.add_collection3d(Poly3DCollection(tru(2.0, 2.0, 0.75, 1.9, 3.6), facecolors=(0.51, 0.31, 0.87, 0.25),
                                         edgecolors=(0.51, 0.31, 0.87, 0.5), linewidths=0.4))
    ax.text(2.0, 2.0, 3.85, "trụ", color=TIM, ha="center", fontsize=9)
    ax.text(3.6, 0.8, 0.4, "hộp", color=CAM, fontsize=9)
    truc3d(ax)
    ax.set_title("CSG\nhộp ∪ trụ:\ntổ hợp khối cơ bản", fontsize=10)

    # Tổ hợp: lưới tam giác bề mặt + khối
    ax = fig.add_subplot(1, 4, 4, projection="3d")
    xs = np.linspace(0.3, 3.7, 7)
    X, Y = np.meshgrid(xs, xs)
    Z = 0.35 + 0.25 * np.sin(X * 1.5) * np.cos(Y * 1.2)
    ax.plot_trisurf(X.ravel(), Y.ravel(), Z.ravel(), color="#C8E6C9", edgecolor="#5A9E61", linewidth=0.4, alpha=0.9)
    ax.add_collection3d(Poly3DCollection(hop(1.4, 1.4, 0.6, 1.2, 1.2, 2.4), facecolors=(0.12, 0.43, 0.92, 0.2),
                                         edgecolors=XANH, linewidths=1.0))
    truc3d(ax)
    ax.set_title("Tổ hợp (V-3D, B-REP + CSG)\nđịa hình dạng mặt +\ncông trình dạng khối", fontsize=10)
    fig.subplots_adjust(wspace=0.02)
    luu(fig, "09-bon-huong-3d.png")


# ---------------------------------------------------------------- 10
def lod():
    fig = plt.figure(figsize=(14, 3.7))
    ten = ["LOD0\nmặt bằng (footprint)", "LOD1\nkhối đùn (block model)", "LOD2\n+ hình dạng mái",
           "LOD3\n+ cửa sổ, cửa đi, chi tiết", "LOD4\n+ nội thất (phòng, tầng)"]
    for k in range(5):
        ax = fig.add_subplot(1, 5, k + 1, projection="3d")
        x0, y0, dx, dy, h = 0.8, 0.9, 2.4, 2.0, 2.2
        if k == 0:
            ax.add_collection3d(Poly3DCollection([[(x0, y0, 0), (x0 + dx, y0, 0), (x0 + dx, y0 + dy, 0), (x0, y0 + dy, 0)]],
                                                 facecolors="#D0D7DE", edgecolors=NAVY, linewidths=1.5))
        else:
            mat = hop(x0, y0, 0, dx, dy, h)
            ax.add_collection3d(Poly3DCollection(mat, facecolors=(0.78, 0.8, 0.83, 0.55 if k < 4 else 0.18),
                                                 edgecolors=NAVY, linewidths=1.0))
        if k >= 2:
            # mái dốc hai mái
            m = [(x0, y0, h), (x0 + dx, y0, h), (x0 + dx, y0 + dy / 2, h + 0.9), (x0, y0 + dy / 2, h + 0.9)]
            m2 = [(x0, y0 + dy, h), (x0 + dx, y0 + dy, h), (x0 + dx, y0 + dy / 2, h + 0.9), (x0, y0 + dy / 2, h + 0.9)]
            ax.add_collection3d(Poly3DCollection([m, m2], facecolors=(0.75, 0.3, 0.2, 0.75), edgecolors="#8A2B1A", linewidths=0.8))
        if k >= 3:
            # cửa sổ trên mặt trước (y = y0) và cửa đi
            for i in range(3):
                for j in range(2):
                    wx, wz = x0 + 0.35 + i * 0.7, 0.9 + j * 0.7
                    ax.add_collection3d(Poly3DCollection([[(wx, y0 - 0.01, wz), (wx + 0.35, y0 - 0.01, wz),
                                                           (wx + 0.35, y0 - 0.01, wz + 0.4), (wx, y0 - 0.01, wz + 0.4)]],
                                                         facecolors="#5DA9E9", edgecolors="#1D5F99", linewidths=0.6))
            dx0 = x0 + dx / 2 - 0.2
            ax.add_collection3d(Poly3DCollection([[(dx0, y0 - 0.01, 0), (dx0 + 0.4, y0 - 0.01, 0),
                                                   (dx0 + 0.4, y0 - 0.01, 0.65), (dx0, y0 - 0.01, 0.65)]],
                                                 facecolors="#7A4E2D", edgecolors="#4B2E19", linewidths=0.6))
        if k == 4:
            # sàn tầng và vách ngăn bên trong
            ax.add_collection3d(Poly3DCollection([[(x0, y0, 1.1), (x0 + dx, y0, 1.1), (x0 + dx, y0 + dy, 1.1), (x0, y0 + dy, 1.1)]],
                                                 facecolors=(0.91, 0.38, 0.16, 0.45), edgecolors=CAM, linewidths=1))
            ax.add_collection3d(Poly3DCollection([[(x0 + dx / 2, y0, 0), (x0 + dx / 2, y0 + dy, 0),
                                                   (x0 + dx / 2, y0 + dy, 1.1), (x0 + dx / 2, y0, 1.1)]],
                                                 facecolors=(0.51, 0.31, 0.87, 0.35), edgecolors=TIM, linewidths=1))
        truc3d(ax, (0, 4))
        ax.set_title(ten[k], fontsize=10, color=CAM if k in (1, 3) else "black")
    fig.text(0.5, 0.0, "Đề tài dùng LOD1 cho phép kiểm tra bao hàm (khối MAP) và LOD3 để hiển thị toà nhà",
             ha="center", fontsize=10.5, color=XAM, style="italic")
    fig.subplots_adjust(wspace=0.0)
    luu(fig, "10-lod-citygml.png")


# ---------------------------------------------------------------- 11
def ray_casting():
    fig, ax = plt.subplots(figsize=(8.4, 4.6))
    P = np.array([(1, 1), (6, 0.6), (8.2, 2.2), (6.2, 3.0), (7.6, 5.2), (3.4, 4.6), (2.2, 3.0), (0.6, 3.6)])
    ax.add_patch(MPoly(P, closed=True, facecolor="#E8F0FE", edgecolor=XANH, linewidth=2))
    ax.text(2.6, 3.9, "đa giác P", color=XANH, fontsize=10)

    def tia(q, mau, nhan):
        ax.plot(*q, "o", color=mau, ms=8, zorder=5)
        ax.annotate("", xy=(10.3, q[1]), xytext=q, arrowprops=dict(arrowstyle="->", color=mau, lw=1.4, ls="--"))
        cat = []
        n = len(P)
        for i in range(n):
            a, b = P[i], P[(i + 1) % n]
            if (a[1] > q[1]) != (b[1] > q[1]):
                x = a[0] + (q[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])
                if x > q[0]:
                    cat.append(x)
        for x in cat:
            ax.plot(x, q[1], "x", color=mau, ms=9, mew=2, zorder=6)
        ax.text(q[0] - 0.1, q[1] + 0.2, nhan + "  (%d giao điểm → %s)" % (len(cat), "lẻ: TRONG" if len(cat) % 2 else "chẵn: NGOÀI"),
                color=mau, fontsize=10, fontweight="bold", ha="left")

    tia((3.2, 1.6), LA, "Q₁")
    tia((0.2, 2.6), DO, "Q₂")
    tia((6.9, 3.4), XAM, "Q₃")
    ax.set_xlim(-0.2, 10.6); ax.set_ylim(0, 5.7)
    ax.set_aspect("equal"); ax.axis("off")
    ax.set_title("Ray casting: bắn tia từ Q sang phải, đếm số lần cắt cạnh của P", fontsize=11)
    luu(fig, "11-ray-casting.png")


# ---------------------------------------------------------------- 12
def map_dung_sai():
    fig, ax = plt.subplots(figsize=(9.6, 5.6))
    # mặt cắt đứng của toà nhà
    xL, xR, zN, h, so = 2.0, 6.0, 0.0, 0.45, 18
    ax.add_patch(Rectangle((xL, zN), xR - xL, so * h, facecolor="#F2F4F7", edgecolor="#8C959F", lw=1.2))
    for t in range(1, so):
        ax.plot([xL, xR], [t * h, t * h], color="#D0D7DE", lw=0.6)
    tang_dau, tang_cuoi = 5, 8
    zmin, zmax = (tang_dau - 1) * h, tang_cuoi * h
    dxy, dz = 0.7, 0.45
    # vùng nới dung sai
    ax.add_patch(Rectangle((xL - dxy, zmin - dz), xR - xL + 2 * dxy, zmax - zmin + 2 * dz, facecolor="none",
                           edgecolor=CAM, lw=1.4, ls="--"))
    ax.add_patch(Rectangle((xL, zmin), xR - xL, zmax - zmin, facecolor=CAM, alpha=0.35, edgecolor=CAM, lw=2))
    ax.text(xR + dxy + 0.12, zmax + dz - 0.1, "MAP⁺ = khối nới biên\n(δxy, δz)", color=CAM, fontsize=9.5, va="top")
    ax.text(xL + 0.75, (zmin + zmax) / 2, "khối MAP\ntầng %d–%d" % (tang_dau, tang_cuoi), color="white",
            fontsize=10, fontweight="bold", ha="center", va="center")
    # kích thước
    ax.annotate("", xy=(xL - 0.05, zmax), xytext=(xL - 0.05, zmin), arrowprops=dict(arrowstyle="<->", color=NAVY))
    ax.text(xL - 0.95, (zmin + zmax) / 2, "z_min\n↕\nz_max", color=NAVY, fontsize=9, ha="center", va="center")
    ax.annotate("", xy=(xR + dxy, zmin - dz - 0.15), xytext=(xR, zmin - dz - 0.15), arrowprops=dict(arrowstyle="<->", color=CAM))
    ax.text(xR + dxy / 2, zmin - dz - 0.45, "δxy", color=CAM, ha="center", fontsize=9)
    ax.annotate("", xy=(xL + 0.3, zmax + dz), xytext=(xL + 0.3, zmax), arrowprops=dict(arrowstyle="<->", color=CAM))
    ax.text(xL + 0.42, zmax + dz / 2, "δz", color=CAM, va="center", fontsize=9)
    # ba điểm
    diem = [((4.25, (6 - 0.5) * h), LA, "HỢP LỆ", "trong cả hai điều kiện"),
            ((4.6, (14 - 0.5) * h), VANG, "NGHI NGỜ", "đúng mặt bằng, sai cao độ"),
            ((8.6, (6 - 0.5) * h), DO, "NGOÀI VÙNG", "ngoài mặt bằng nới biên")]
    for (x, z), mau, ten, mo in diem:
        ax.plot(x, z, "o", color=mau, ms=11, mec="white", mew=1.5, zorder=6)
        ax.text(x + 0.25, z, ten, color=mau, fontweight="bold", fontsize=10.5, va="center")
        ax.text(x + 0.25, z - 0.32, mo, color=XAM, fontsize=8.8, va="center")
    ax.plot([0.3, 10.5], [0, 0], color="#6E7781", lw=2)
    ax.text(0.35, 0.12, "mặt đất (z_nền)", fontsize=8.5, color=XAM)
    ax.set_xlim(0.2, 11.3); ax.set_ylim(-0.9, so * h + 0.4)
    ax.axis("off")
    ax.set_title("Mặt cắt đứng: khối MAP, vùng dung sai và ba trạng thái kết quả", fontsize=11)
    luu(fig, "12-map-dung-sai.png")


# ---------------------------------------------------------------- 13
def cao_do():
    fig, ax = plt.subplots(figsize=(9.6, 4.6))
    x = np.linspace(0, 10, 300)
    elip = 1.0 + 0 * x
    geoid = 1.0 + 0.55 + 0.18 * np.sin(x * 0.8)
    dat = geoid + 0.35 + 0.25 * np.sin(x * 1.7 + 1) + 0.2 * np.exp(-((x - 7) ** 2))
    ax.plot(x, elip, color=XANH, lw=2, label="elipxoit WGS84 (bề mặt toán học)")
    ax.plot(x, geoid, color=LA, lw=2, ls="--", label="geoid ≈ mực nước biển trung bình")
    ax.fill_between(x, dat, 0.6, color="#E6D5B8", alpha=0.6)
    ax.plot(x, dat, color="#8B6B3E", lw=1.8, label="mặt đất")
    # toà nhà
    xb = 4.2
    nen = np.interp(xb + 0.6, x, dat)
    ax.add_patch(Rectangle((xb, nen), 1.2, 2.6, facecolor="#D0D7DE", edgecolor=NAVY, lw=1.2))
    zq = nen + 1.7
    ax.plot(xb + 0.6, zq, "o", color=CAM, ms=9, zorder=6)
    ax.text(xb + 0.75, zq + 0.12, "Q (thiết bị)", color=CAM, fontsize=9.5, fontweight="bold")
    gx = np.interp(xb + 0.6, x, geoid)
    # mũi tên h, H, N
    def mui(x0, y0, y1, nhan, mau, ben=1):
        ax.annotate("", xy=(x0, y1), xytext=(x0, y0), arrowprops=dict(arrowstyle="<->", color=mau, lw=1.4))
        ax.text(x0 + 0.12 * ben, (y0 + y1) / 2, nhan, color=mau, fontsize=10, va="center",
                ha="left" if ben > 0 else "right", fontweight="bold",
                bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="none", alpha=0.9))
    mui(xb - 1.2, 1.0, zq, "h — cao độ elipxoit\n(GPS / Geolocation API trả về)", XANH, ben=-1)
    mui(xb + 2.2, gx, zq, "H — cao độ chuẩn\n(so với mực nước biển)", LA)
    mui(xb + 3.9, 1.0, gx, "N — độ cao geoid", NAVY)
    ax.plot([xb - 1.2, xb + 0.6], [zq, zq], color="#9AA4AF", lw=0.8, ls=":")
    ax.plot([xb + 0.6, xb + 2.2], [zq, zq], color="#9AA4AF", lw=0.8, ls=":")
    ax.text(1.0, 4.55, "h = H + N", fontsize=15, fontweight="bold", color=NAVY, ha="left")
    ax.set_ylim(0.6, 5.0); ax.set_xlim(0, 10)
    ax.axis("off")
    ax.legend(loc="upper right", fontsize=8.5, frameon=True, framealpha=0.95)
    ax.set_title("Ba loại cao độ: phải quy về cùng một mặt chuẩn trước khi so với z_min, z_max", fontsize=11)
    luu(fig, "13-cao-do-gnss.png")


# ---------------------------------------------------------------- 14
def vector_2d():
    fig, axs = plt.subplots(1, 3, figsize=(12.5, 3.9))
    A = [(0.5, 0.5), (3, 0.3), (3.3, 2.4), (0.8, 2.8)]
    B = [(3, 0.3), (5.6, 0.8), (5.2, 2.9), (3.3, 2.4)]
    for k, ax in enumerate(axs):
        ax.set_xlim(0, 6.2); ax.set_ylim(0, 3.6); ax.set_aspect("equal"); ax.axis("off")
    # spaghetti: mỗi đa giác lưu toạ độ riêng, cạnh chung bị lưu hai lần
    ax = axs[0]
    ax.add_patch(MPoly(A, closed=True, facecolor="#FDE2D4", edgecolor=CAM, lw=2))
    ax.add_patch(MPoly(np.array(B) + [0.12, 0], closed=True, facecolor="#DCE8FF", edgecolor=XANH, lw=2))
    ax.text(1.8, 1.5, "P1", fontsize=12, ha="center", color=CAM, fontweight="bold")
    ax.text(4.5, 1.6, "P2", fontsize=12, ha="center", color=XANH, fontweight="bold")
    ax.text(3.2, 3.15, "cạnh chung lưu 2 lần", fontsize=9, ha="center", color=XAM)
    ax.set_title("Spaghetti\nmỗi đối tượng tự giữ toạ độ,\nkhông lưu quan hệ", fontsize=10)
    # mạng: node + cung
    ax = axs[1]
    nodes = {"n1": (0.6, 0.6), "n2": (2.6, 1.6), "n3": (4.6, 0.8), "n4": (5.4, 2.8), "n5": (1.4, 3.0)}
    cung = [("n1", "n2"), ("n2", "n3"), ("n3", "n4"), ("n2", "n4"), ("n5", "n2")]
    for a, b in cung:
        ax.annotate("", xy=nodes[b], xytext=nodes[a], arrowprops=dict(arrowstyle="-|>", color=NAVY, lw=1.6, shrinkA=7, shrinkB=7))
    for t, p in nodes.items():
        ax.plot(*p, "o", color=CAM, ms=12, zorder=5)
        ax.text(p[0], p[1] + 0.28, t, ha="center", fontsize=9)
    ax.set_title("Mạng\nnode – cung có hướng\n(giao thông, điện, nước)", fontsize=10)
    # topology: cạnh chung lưu một lần, cung biết đa giác trái/phải
    ax = axs[2]
    ax.add_patch(MPoly(A, closed=True, facecolor="#FDE2D4", edgecolor=CAM, lw=1.2))
    ax.add_patch(MPoly(B, closed=True, facecolor="#DCE8FF", edgecolor=XANH, lw=1.2))
    ax.plot([3, 3.3], [0.3, 2.4], color=LA, lw=4)
    ax.text(3.2, 0.05, "cung chung: trái = P1, phải = P2", fontsize=9, color=LA, ha="center")
    ax.text(1.8, 1.5, "P1", fontsize=12, ha="center", color=CAM, fontweight="bold")
    ax.text(4.4, 1.6, "P2", fontsize=12, ha="center", color=XANH, fontweight="bold")
    ax.set_title("Topology\ncạnh chung lưu 1 lần,\nbiết kề – chứa – nối", fontsize=10)
    fig.subplots_adjust(wspace=0.05)
    luu(fig, "14-vector-2d.png")


if __name__ == "__main__":
    bon_huong()
    lod()
    ray_casting()
    map_dung_sai()
    cao_do()
    vector_2d()
