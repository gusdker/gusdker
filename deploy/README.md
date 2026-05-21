# deploy/ — DGX Spark 셋업

DGX Spark + Ubuntu 환경에서 SGLang(로컬 LLM)과 gusdker scheduler 를 systemd 서비스로 등록한다.

## 구성 파일

| 파일 | 역할 |
| --- | --- |
| `install.sh` | 원샷 셋업 스크립트 (idempotent — 여러 번 실행해도 안전) |
| `sglang.env.example` | SGLang 런타임 설정 템플릿 |
| `sglang-launch.sh` | systemd 가 호출하는 SGLang 시작 스크립트 |
| `sglang.service` | SGLang systemd unit (`__USER__`, `__HOME__`, `__PROJECT_DIR__` placeholder) |
| `gusdker-scheduler.service` | gusdker 스케줄러 systemd unit (동일 placeholder) |

`install.sh` 가 placeholder 를 현재 사용자/경로로 치환해서 `/etc/systemd/system/` 에 설치한다.

## 사전 준비

```bash
# Node.js / pnpm / 빌드 도구
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3 python3-venv python3-pip
sudo npm install -g pnpm

# 프로젝트 clone + 의존성
git clone <repo-url> ~/gusdker
cd ~/gusdker
pnpm install

# Shopify 토큰 / AI 공급자 .env
cp .env.example .env
nano .env
```

## 한 줄 설치

```bash
cd ~/gusdker
./deploy/install.sh
```

스크립트가 하는 일:
1. 시스템 점검 (node / pnpm / python3 / nvidia-smi)
2. `~/sglang-env` 가상환경 생성 후 `pip install "sglang[all]"`
3. `deploy/sglang.env` 생성 (없으면 example 복사)
4. `logs/` 디렉토리 생성
5. systemd 유닛 렌더링 → `/etc/systemd/system/` 에 복사 (sudo 확인)
6. `enable` + `start`

옵션:
- `--skip-sglang` — venv/패키지 설치 스킵 (이미 있을 때)
- `--skip-services` — systemd 단계 스킵 (수동 운영 원할 때)
- `--no-start` — 설치만 하고 start 안 함
- `--yes` / `-y` — 모든 프롬프트 자동 yes

## Gemma 모델 다운로드 권한

Gemma 시리즈는 HuggingFace 의 게이트 모델 — 사용 신청 + 토큰 필요.

1. [huggingface.co/google/gemma-3-27b-it](https://huggingface.co/google/gemma-3-27b-it) 접속해서 라이선스 동의
2. HuggingFace Access Token 발급 (Settings → Access Tokens)
3. `deploy/sglang.env` 의 `HUGGING_FACE_HUB_TOKEN` 에 입력

또는 환경 전체에 적용하려면:
```bash
huggingface-cli login   # 토큰 입력 (~/sglang-env 활성화 후)
```

## 운영 명령

```bash
# 상태 확인
sudo systemctl status sglang
sudo systemctl status gusdker-scheduler

# 재시작
sudo systemctl restart sglang
sudo systemctl restart gusdker-scheduler

# 로그 실시간
journalctl -u sglang -f
journalctl -u gusdker-scheduler -f

# 또는 파일로:
tail -f ~/gusdker/logs/sglang.log
tail -f ~/gusdker/logs/scheduler.log

# 자동 시작 해제
sudo systemctl disable sglang gusdker-scheduler
```

## 연결 확인

SGLang 모델 로딩이 끝났으면 (수 분 ~ 수십 분):

```bash
# 1) SGLang 서버 응답
curl http://localhost:30000/v1/models

# 2) gusdker 가 Shopify + AI 둘 다 연결되는지
pnpm cli health
pnpm cli trends:report --days 7 --keywords "다이어트,홈트" --geo KR
```

## 모델 변경

`deploy/sglang.env` 편집 후:
```bash
sudo systemctl restart sglang
```

DGX Spark 128GB 통합 메모리 활용 옵션 (`SGLANG_EXTRA_ARGS`):
- FP8 양자화: `--quantization fp8` (더 큰 모델 가능)
- 컨텍스트 확장: `--context-length 32768`
- GPU 메모리 분율 조정: `--mem-fraction-static 0.85`

## 트러블슈팅

| 증상 | 확인 |
| --- | --- |
| SGLang 이 안 뜸 | `journalctl -u sglang -n 100` — Python 에러 / OOM / HF 토큰 |
| `Could not access ...gemma-3...` | HuggingFace 모델 라이선스 동의 + 토큰 확인 |
| scheduler 가 AI 에러 | `curl http://localhost:30000/v1/models` 로 SGLang 먼저 확인 |
| aarch64 wheel 없음 | `pip install --no-binary :all:` 로 소스 빌드 시도 |
| `pnpm: command not found` | systemd 환경의 `PATH` 문제 — `which pnpm` 으로 절대경로 확인 후 unit 파일의 `ExecStart` 를 절대경로로 |
