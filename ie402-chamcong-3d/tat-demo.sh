#!/usr/bin/env bash
# Tắt máy chủ web/API và container CSDL đã bật bằng ./chay-demo.sh.
# Dữ liệu vẫn giữ trong container — lần sau ./chay-demo.sh là chạy tiếp.
#   ./tat-demo.sh            tắt
#   ./tat-demo.sh --xoa-csdl tắt và xoá hẳn container CSDL (mất dữ liệu)
DUAN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$DUAN/.server.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  kill "$(cat "$PID_FILE")" && echo "Đã tắt máy chủ (PID $(cat "$PID_FILE"))"
else
  echo "Máy chủ không chạy."
fi
rm -f "$PID_FILE"

if docker ps --format '{{.Names}}' | grep -qx chamcong3d-db; then
  docker stop chamcong3d-db >/dev/null && echo "Đã tắt CSDL (container chamcong3d-db)"
fi
if [ "${1:-}" = "--xoa-csdl" ]; then
  docker rm chamcong3d-db >/dev/null 2>&1 && echo "Đã xoá container chamcong3d-db"
fi
