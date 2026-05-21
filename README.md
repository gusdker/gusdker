# gusdker — 쇼피파이 자동화 툴킷

운영 중인 쇼피파이 스토어를 위한 모듈식 자동화 도구. 트렌드 분석, 상품 관리, 주문 처리, 마케팅을 한 곳에서.

> 상세 계획은 [PLAN.md](./PLAN.md) 참고.

## 실행 환경

- **머신**: NVIDIA DGX Spark (GB10 Grace Blackwell, 128GB 통합 메모리, aarch64)
- **OS**: Ubuntu (DGX OS)
- **Node.js**: 20+ (22 권장)
- **GPU**: 로컬 LLM 추론은 CUDA 가속

> Windows / Intel 데스크탑에서 동작은 하지만 본 문서는 Ubuntu + DGX Spark 기준으로 작성됨.

## Ubuntu 초기 셋업

```bash
# Node.js 22 LTS 설치 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential

# pnpm 설치
sudo npm install -g pnpm

# better-sqlite3 / sharp 네이티브 빌드용 (보통 build-essential 로 충분)
sudo apt install -y python3 g++ make
```

## 빠른 시작

```bash
# 1. 의존성 설치 (aarch64 prebuilt 자동 사용)
pnpm install

# 2. 환경 변수 설정
cp .env.example .env
nano .env  # Shopify 토큰 + AI 공급자 정보 입력

# 3. Shopify 연결 확인
pnpm cli health

# 4. 트렌드 리포트 생성
pnpm cli trends:report --days 7 --keywords "다이어트,홈트,에어프라이어" --geo KR

# 5. 사용 가능한 모든 명령 보기
pnpm cli --help
```

## AI 공급자 (로컬 SGLang 추천 / Anthropic도 가능)

DGX Spark의 128GB 통합 메모리 + Blackwell GPU 환경에서는 **로컬 SGLang**이 1순위. 외부 API 비용·토큰 한도 없음.

### SGLang 셋업 (Ubuntu / CUDA)

```bash
# 별도의 conda/venv 환경 권장
python -m venv ~/sglang-env && source ~/sglang-env/bin/activate
pip install --upgrade pip
pip install "sglang[all]"

# 서버 띄우기 (시스템 부팅 시 자동 시작은 systemd 섹션 참고)
python -m sglang.launch_server \
  --model-path google/gemma-3-27b-it \
  --port 30000 \
  --served-model-name gemma \
  --host 127.0.0.1
```

DGX Spark의 128GB 통합 메모리면 Gemma 3 27B는 FP16로 충분히 들어가고, FP8 양자화 옵션 (`--quantization fp8`) 으로 더 큰 모델도 시도 가능.

`.env` 설정:
```bash
AI_PROVIDER=openai-compat
AI_BASE_URL=http://localhost:30000/v1
AI_MODEL=gemma           # --served-model-name 으로 지정한 이름
AI_API_KEY=not-needed    # SGLang은 보통 인증 없음
```

다른 런타임 사용 시 base URL만 변경:
- Ollama: `http://localhost:11434/v1`, `AI_MODEL=gemma3:27b`
- LM Studio: `http://localhost:1234/v1`
- vLLM: `http://localhost:8000/v1`

## 자동 실행 (스케줄러)

### 방법 1: 그냥 실행 (개발 / 테스트)

```bash
pnpm scheduler
```

각 모듈이 등록한 cron 잡들이 자동 실행된다 (예: 매주 월요일 09:00에 주간 리포트).

### 방법 2: systemd 유닛 (운영 권장, Ubuntu)

DGX Spark가 상시 가동 워크스테이션이므로 systemd로 등록하면 부팅 시 자동 시작 + 크래시 시 자동 재시작.

`/etc/systemd/system/gusdker-scheduler.service`:

```ini
[Unit]
Description=gusdker shopify automation scheduler
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/gusdker
EnvironmentFile=/home/YOUR_USERNAME/gusdker/.env
ExecStart=/usr/bin/pnpm scheduler
Restart=on-failure
RestartSec=10
StandardOutput=append:/home/YOUR_USERNAME/gusdker/logs/scheduler.log
StandardError=append:/home/YOUR_USERNAME/gusdker/logs/scheduler.err

[Install]
WantedBy=multi-user.target
```

등록:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gusdker-scheduler
sudo systemctl status gusdker-scheduler
journalctl -u gusdker-scheduler -f   # 실시간 로그
```

SGLang도 같은 방식으로 `/etc/systemd/system/sglang.service` 만들어 자동 시작 권장.

## 모듈 추가하기

새 폴더만 만들면 끝. 다른 파일을 수정할 필요 없다.

```ts
// src/modules/my-new-feature/index.ts
import type { Module } from '../../core/module.js';

const mod: Module = {
  name: 'my-new-feature',
  description: '내가 추가할 새 기능',
  commands: [
    {
      name: 'mine:hello',
      description: '인사하기',
      handler: async (ctx) => {
        ctx.log.info('hello!');
      },
    },
  ],
};
export default mod;
```

레지스트리가 자동으로 발견해서 `pnpm cli mine:hello` 로 실행 가능해진다.

## 폴더 구조

```
src/
├── core/         공통 인프라 (config, logger, db, shopify, ai, event-bus)
├── modules/      각 기능 모듈 (자동 로드)
│   └── trends/   ← 트렌드 분석 (구현 완료)
├── cli/          commander 기반 CLI 엔트리
├── scheduler/    node-cron 기반 스케줄러 엔트리
└── index.ts
```

## 현재 구현 상태

- [x] Phase 1: 모듈식 인프라
- [x] Phase 2: 트렌드 분석 모듈
- [ ] Phase 3: 상품 모듈 (Korealy 연동)
- [ ] Phase 4: 리뷰 수집 모듈
- [ ] Phase 5: 주문/배송 모듈
- [ ] Phase 6: 마케팅/SEO 모듈
