#!/usr/bin/env bash
# ============================================================
#  CHẠY DEMO trên Linux / macOS — một lệnh là xong
#    1. Dựng PostgreSQL + PostGIS bằng Docker (lần đầu tự tải image)
#    2. Nạp schema.sql + seed.sql nếu CSDL còn trống
#    3. Cài thư viện Node nếu chưa có
#    4. Bật máy chủ ở http://127.0.0.1:3000
#
#  ./chay-demo.sh             chạy bình thường
#  ./chay-demo.sh --lam-moi   xoá dữ liệu chấm công lúc tập dượt, nạp lại dữ liệu mẫu
#  ./chay-demo.sh --kiem-thu  chạy xong thì chạy luôn kiểm thử tự động (npm test)
#  ./tat-demo.sh              tắt máy chủ và CSDL
#
#  Windows dùng CAI-DAT.bat + BAT-DEMO.bat như cũ.
# ============================================================
set -euo pipefail

DUAN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="chamcong3d-db"
IMAGE="postgis/postgis:17-3.5"
PGPORT="${PGPORT:-55432}"
PORT="${PORT:-3000}"
PID_FILE="$DUAN/.server.pid"
LOG_FILE="$DUAN/server/server.log"

LAM_MOI=0
KIEM_THU=0
for a in "$@"; do
  case "$a" in
    --lam-moi) LAM_MOI=1 ;;
    --kiem-thu) KIEM_THU=1 ;;
    -h|--help) sed -n 2,16p "$0"; exit 0 ;;
    *) echo "Không hiểu tham số: $a (xem ./chay-demo.sh --help)"; exit 1 ;;
  esac
done

xanh() { printf '\033[32m%s\033[0m\n' "$*"; }
vang() { printf '\033[33m%s\033[0m\n' "$*"; }
do_() { printf '\033[31m%s\033[0m\n' "$*"; }

echo "============================================================"
echo " HỆ THỐNG CHẤM CÔNG ĐỊNH VỊ 3D — đồ án IE402"
echo "============================================================"

# ---------- 0. công cụ cần có ----------
echo "[0/4] Kiểm tra Node.js và Docker..."
command -v node >/dev/null || { do_ "Chưa cài Node.js (https://nodejs.org, bản LTS >= 18)"; exit 1; }
command -v docker >/dev/null || { do_ "Chưa cài Docker (https://docs.docker.com/get-docker/)"; exit 1; }
docker info >/dev/null 2>&1 || { do_ "Docker chưa chạy hoặc user chưa có quyền (thử: sudo usermod -aG docker \$USER, rồi đăng nhập lại)"; exit 1; }
echo "      Node $(node -v) · $(docker --version | cut -d, -f1)"

# ---------- 1. CSDL ----------
echo "[1/4] PostgreSQL + PostGIS (container $CONTAINER, cổng $PGPORT)..."
MOI_TAO=0
if ! docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  vang "      Tạo container lần đầu (tải image ~600 MB nếu chưa có)..."
  docker run -d --name "$CONTAINER" \
    -p "127.0.0.1:$PGPORT:5432" \
    -e POSTGRES_HOST_AUTH_METHOD=trust \
    -e POSTGRES_DB=chamcong3d \
    "$IMAGE" >/dev/null
  MOI_TAO=1
elif [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]; then
  docker start "$CONTAINER" >/dev/null
fi

# Lần đầu image chạy một máy chủ tạm để khởi tạo rồi khởi động lại — chờ xong hẳn.
for _ in $(seq 1 90); do
  if [ "$MOI_TAO" = 1 ] && ! docker logs "$CONTAINER" 2>&1 | grep -q "PostgreSQL init process complete"; then
    sleep 1; continue
  fi
  docker exec "$CONTAINER" pg_isready -U postgres -d chamcong3d -q 2>/dev/null && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres -d chamcong3d -q || { do_ "CSDL không lên — xem: docker logs $CONTAINER"; exit 1; }

psql_() { docker exec -i "$CONTAINER" psql -U postgres -d chamcong3d -v ON_ERROR_STOP=1 -q "$@"; }
SO_BANG=$(psql_ -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='toa_nha'")
if [ "$SO_BANG" = "0" ] || [ "$LAM_MOI" = 1 ]; then
  [ "$LAM_MOI" = 1 ] && vang "      --lam-moi: nạp lại toàn bộ dữ liệu mẫu"
  psql_ < "$DUAN/db/schema.sql" 2>&1 | grep -v NOTICE || true
  psql_ < "$DUAN/db/seed.sql" >/dev/null
  echo "      Đã nạp schema.sql + seed.sql"
fi
echo "      $(psql_ -tAc "SELECT 'toà nhà: ' || (SELECT count(*) FROM toa_nha) || ' · khối MAP: ' || (SELECT count(*) FROM khu_vuc_cham_cong) || ' · nhân viên: ' || (SELECT count(*) FROM nhan_vien)")"

# ---------- 2. thư viện Node ----------
echo "[2/4] Thư viện Node..."
if [ ! -d "$DUAN/server/node_modules" ] || [ "$DUAN/server/package.json" -nt "$DUAN/server/node_modules" ]; then
  (cd "$DUAN/server" && npm install --no-audit --no-fund) | tail -2
else
  echo "      Đã có."
fi

# ---------- 3. máy chủ ----------
echo "[3/4] Máy chủ web/API..."
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  vang "      Đang chạy sẵn (PID $(cat "$PID_FILE")) — khởi động lại để nạp mã mới"
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  sleep 1
fi
if curl -s -o /dev/null "http://127.0.0.1:$PORT/healthz" 2>/dev/null; then
  do_ "Cổng $PORT đang bị chương trình khác chiếm. Tắt nó, hoặc chạy: PORT=3001 ./chay-demo.sh"
  exit 1
fi
# Tách hẳn khỏi terminal: đóng terminal không tắt máy chủ, dùng ./tat-demo.sh để tắt.
TACH=""; command -v setsid >/dev/null && TACH="setsid"
# Chạy trực tiếp (không bọc trong subshell) để $! là đúng PID của node.
cd "$DUAN/server"
PGPORT="$PGPORT" PORT="$PORT" $TACH nohup node src/index.js </dev/null >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
cd "$DUAN"
for _ in $(seq 1 30); do
  curl -s "http://127.0.0.1:$PORT/healthz" 2>/dev/null | grep -q '"ok"' && break
  sleep 0.5
done
if ! curl -s "http://127.0.0.1:$PORT/healthz" | grep -q '"ok"'; then
  do_ "Máy chủ không lên — xem $LOG_FILE"; tail -20 "$LOG_FILE"; exit 1
fi
echo "      PID $(cat "$PID_FILE") · nhật ký: server/server.log"

# ---------- 4. xong ----------
echo "[4/4] Sẵn sàng."
if [ "$KIEM_THU" = 1 ]; then
  (cd "$DUAN/server" && PORT="$PORT" PGPORT="$PGPORT" node scripts/kiem-thu.js)
fi
echo
xanh "  Mở trình duyệt:  http://127.0.0.1:$PORT"
echo "  Tài khoản (mật khẩu 123456): khoi.nm (nhân viên) · nhan.vt (quản lý) · tin.nh (quản trị)"
echo "  Tắt:             ./tat-demo.sh"
echo
if [ -z "${KHONG_MO_TRINH_DUYET:-}" ]; then
  if command -v xdg-open >/dev/null; then xdg-open "http://127.0.0.1:$PORT" >/dev/null 2>&1 || true
  elif command -v open >/dev/null; then open "http://127.0.0.1:$PORT" || true
  fi
fi
