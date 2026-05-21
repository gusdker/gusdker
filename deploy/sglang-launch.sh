#!/usr/bin/env bash
# SGLang OpenAI 호환 서버 시작 스크립트
# systemd sglang.service 가 이 파일을 호출
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/sglang.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} 가 없습니다. install.sh 를 먼저 실행하세요." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

: "${SGLANG_VENV:?SGLANG_VENV 미설정}"
: "${SGLANG_MODEL_PATH:?SGLANG_MODEL_PATH 미설정}"
: "${SGLANG_SERVED_NAME:?SGLANG_SERVED_NAME 미설정}"
: "${SGLANG_PORT:=30000}"
: "${SGLANG_HOST:=127.0.0.1}"

PY="${SGLANG_VENV}/bin/python"
if [[ ! -x "${PY}" ]]; then
  echo "ERROR: ${PY} 가 없습니다. install.sh 로 venv 를 만드세요." >&2
  exit 1
fi

# HF 토큰 (Gemma 등 게이트 모델용)
if [[ -n "${HUGGING_FACE_HUB_TOKEN:-}" ]]; then
  export HUGGING_FACE_HUB_TOKEN
fi

# shellcheck disable=SC2086
exec "${PY}" -m sglang.launch_server \
  --model-path "${SGLANG_MODEL_PATH}" \
  --served-model-name "${SGLANG_SERVED_NAME}" \
  --port "${SGLANG_PORT}" \
  --host "${SGLANG_HOST}" \
  ${SGLANG_EXTRA_ARGS:-}
