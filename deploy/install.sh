#!/usr/bin/env bash
# gusdker 셋업 스크립트 — DGX Spark / Ubuntu 기준
#
# 수행 단계:
#   1. 시스템 점검 (Ubuntu, Python, Node, CUDA, pnpm)
#   2. SGLang Python venv 생성 + 패키지 설치
#   3. deploy/sglang.env 생성 (없으면 example 복사)
#   4. logs/ 디렉토리 생성
#   5. systemd 유닛 렌더링 후 /etc/systemd/system/ 에 설치
#   6. enable + start
#
# 사용법:
#   ./deploy/install.sh                  # 전체 실행
#   ./deploy/install.sh --skip-sglang    # SGLang venv 단계 스킵
#   ./deploy/install.sh --skip-services  # systemd 단계 스킵
#   ./deploy/install.sh --no-start       # 설치는 하되 start 안 함
#   ./deploy/install.sh --yes            # 모든 프롬프트 자동 yes

set -euo pipefail

# ────────────────────────────────────────────────────────────────
# 옵션 파싱
# ────────────────────────────────────────────────────────────────
SKIP_SGLANG=0
SKIP_SERVICES=0
NO_START=0
ASSUME_YES=0

for arg in "$@"; do
  case "$arg" in
    --skip-sglang) SKIP_SGLANG=1 ;;
    --skip-services) SKIP_SERVICES=1 ;;
    --no-start) NO_START=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    -h|--help)
      grep -E '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "알 수 없는 옵션: $arg" >&2; exit 1 ;;
  esac
done

# ────────────────────────────────────────────────────────────────
# 경로/사용자
# ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUN_USER="${SUDO_USER:-${USER:-$(id -un)}}"
RUN_HOME="$(getent passwd "${RUN_USER}" 2>/dev/null | cut -d: -f6)"
if [[ -z "${RUN_HOME}" ]]; then RUN_HOME="${HOME:-/home/${RUN_USER}}"; fi
SGLANG_VENV="${RUN_HOME}/sglang-env"

c_blue()  { printf '\033[1;34m%s\033[0m\n' "$*"; }
c_green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
c_yellow(){ printf '\033[1;33m%s\033[0m\n' "$*"; }
c_red()   { printf '\033[1;31m%s\033[0m\n' "$*" >&2; }

confirm() {
  local prompt="${1:-진행할까요?}"
  if [[ "${ASSUME_YES}" -eq 1 ]]; then return 0; fi
  read -rp "${prompt} [y/N] " reply
  [[ "${reply}" =~ ^[Yy]$ ]]
}

# ────────────────────────────────────────────────────────────────
# 1. 시스템 점검
# ────────────────────────────────────────────────────────────────
c_blue "[1/6] 시스템 점검"

if [[ "$(uname -s)" != "Linux" ]]; then
  c_red "Linux 가 아닙니다. 이 스크립트는 Ubuntu 기준입니다."
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  c_red "python3 가 없습니다. 'sudo apt install -y python3 python3-venv python3-pip' 먼저 실행하세요."
  exit 1
fi

if ! command -v node &>/dev/null; then
  c_red "node 가 없습니다. README 의 Ubuntu 초기 셋업을 먼저 진행하세요."
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  c_yellow "pnpm 가 없습니다. 'sudo npm install -g pnpm' 실행하세요."
  exit 1
fi

if ! command -v nvidia-smi &>/dev/null; then
  c_yellow "nvidia-smi 미발견 — GPU 가속 불가. SGLang 동작은 매우 느릴 수 있습니다."
else
  echo "GPU 감지:"
  nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader || true
fi

c_green "  OK — user=${RUN_USER}, home=${RUN_HOME}, project=${PROJECT_DIR}"

# ────────────────────────────────────────────────────────────────
# 2. SGLang venv + 설치
# ────────────────────────────────────────────────────────────────
if [[ "${SKIP_SGLANG}" -eq 1 ]]; then
  c_yellow "[2/6] SGLang 설치 — 스킵 (--skip-sglang)"
else
  c_blue "[2/6] SGLang Python venv 설치"

  if [[ ! -d "${SGLANG_VENV}" ]]; then
    echo "  venv 생성: ${SGLANG_VENV}"
    python3 -m venv "${SGLANG_VENV}"
  else
    echo "  venv 이미 존재: ${SGLANG_VENV}"
  fi

  # shellcheck disable=SC1091
  source "${SGLANG_VENV}/bin/activate"
  pip install --upgrade pip
  echo "  SGLang 설치 중 (시간이 좀 걸립니다)..."
  pip install "sglang[all]"
  deactivate

  c_green "  OK — SGLang 설치 완료"
fi

# ────────────────────────────────────────────────────────────────
# 3. sglang.env 생성
# ────────────────────────────────────────────────────────────────
c_blue "[3/6] deploy/sglang.env 준비"
if [[ ! -f "${SCRIPT_DIR}/sglang.env" ]]; then
  sed "s|__HOME__|${RUN_HOME}|g" "${SCRIPT_DIR}/sglang.env.example" > "${SCRIPT_DIR}/sglang.env"
  c_green "  생성됨: ${SCRIPT_DIR}/sglang.env (필요 시 수정)"
else
  c_yellow "  이미 존재 — 그대로 유지: ${SCRIPT_DIR}/sglang.env"
fi

# ────────────────────────────────────────────────────────────────
# 4. logs/ 디렉토리
# ────────────────────────────────────────────────────────────────
c_blue "[4/6] logs/ 디렉토리"
mkdir -p "${PROJECT_DIR}/logs"
chown -R "${RUN_USER}:${RUN_USER}" "${PROJECT_DIR}/logs" 2>/dev/null || true
c_green "  OK"

# ────────────────────────────────────────────────────────────────
# 5. systemd 유닛 렌더 + 설치
# ────────────────────────────────────────────────────────────────
if [[ "${SKIP_SERVICES}" -eq 1 ]]; then
  c_yellow "[5/6] systemd 유닛 설치 — 스킵 (--skip-services)"
else
  c_blue "[5/6] systemd 유닛 설치 (sudo 필요)"

  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "${TMP_DIR}"' EXIT

  render_unit() {
    local src="$1"
    local dst="$2"
    sed -e "s|__USER__|${RUN_USER}|g" \
        -e "s|__HOME__|${RUN_HOME}|g" \
        -e "s|__PROJECT_DIR__|${PROJECT_DIR}|g" \
        "${src}" > "${dst}"
  }

  render_unit "${SCRIPT_DIR}/sglang.service" "${TMP_DIR}/sglang.service"
  render_unit "${SCRIPT_DIR}/gusdker-scheduler.service" "${TMP_DIR}/gusdker-scheduler.service"

  echo "  렌더된 유닛 파일:"
  echo "    - ${TMP_DIR}/sglang.service"
  echo "    - ${TMP_DIR}/gusdker-scheduler.service"
  echo ""
  echo "  /etc/systemd/system/ 으로 복사하려면 sudo 권한이 필요합니다."

  if ! confirm "  systemd 에 설치할까요?"; then
    c_yellow "  설치 스킵 — 위 임시 파일을 직접 검토/복사 가능"
  else
    sudo cp "${TMP_DIR}/sglang.service" /etc/systemd/system/sglang.service
    sudo cp "${TMP_DIR}/gusdker-scheduler.service" /etc/systemd/system/gusdker-scheduler.service
    sudo systemctl daemon-reload
    sudo systemctl enable sglang.service gusdker-scheduler.service
    c_green "  설치 + enable 완료"
  fi
fi

# ────────────────────────────────────────────────────────────────
# 6. 시작
# ────────────────────────────────────────────────────────────────
if [[ "${SKIP_SERVICES}" -eq 1 || "${NO_START}" -eq 1 ]]; then
  c_yellow "[6/6] 서비스 시작 — 스킵"
else
  c_blue "[6/6] 서비스 시작"
  if confirm "  지금 sglang + gusdker-scheduler 를 시작할까요?"; then
    sudo systemctl restart sglang.service
    sleep 2
    sudo systemctl restart gusdker-scheduler.service
    sleep 1
    sudo systemctl --no-pager status sglang.service | head -15
    echo
    sudo systemctl --no-pager status gusdker-scheduler.service | head -15
  fi
fi

echo
c_green "셋업 끝!"
echo
echo "다음 단계:"
echo "  - .env 와 deploy/sglang.env 값 확인/수정"
echo "  - 모델 첫 로딩은 다운로드 + 컴파일로 수 분 ~ 수십 분 소요 가능:"
echo "      journalctl -u sglang -f"
echo "  - 모델 로딩 완료 후 연결 확인:"
echo "      curl http://localhost:30000/v1/models"
echo "  - 스케줄러 로그:"
echo "      journalctl -u gusdker-scheduler -f"
