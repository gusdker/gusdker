# 쇼피파이 자동화 프로젝트 계획서

## 1. 프로젝트 개요

운영 중인 쇼피파이 스토어를 위한 통합 자동화 도구. 트렌드 분석부터 상품 업로드, 주문 처리, 마케팅까지 한 곳에서 관리한다.

- **언어**: Node.js + TypeScript
- **실행 환경**: 로컬 워크스테이션 상시 가동 (DGX Spark)
- **스토어**: 기존 운영 중인 쇼피파이 스토어 1개

### 1.1 하드웨어 / OS

| 항목 | 값 |
| --- | --- |
| 머신 | **NVIDIA DGX Spark** |
| 칩 | GB10 Grace Blackwell Superchip (ARM Neoverse + Blackwell GPU) |
| 통합 메모리 | 128GB LPDDR5x (CPU/GPU 공유) |
| 스토리지 | NVMe SSD |
| 아키텍처 | **aarch64 (ARM64)** |
| OS | **Ubuntu** (DGX OS) |
| GPU 가속 | CUDA / cuDNN 사전 설치 |

> **시사점**:
> - 128GB 통합 메모리 → Gemma 3 27B는 FP16에서도 여유, FP8/FP4로는 70B급도 가능
> - aarch64 — 모든 의존성이 ARM64 prebuilt 제공 확인 필요 (better-sqlite3, sharp ✓)
> - 상시 가동 가능한 데스크탑이므로 cron / systemd timer 모두 안정적으로 사용 가능
> - 별도 클라우드 VPS 불필요

## 2. 핵심 모듈

> 모든 모듈은 **공통 `Module` 인터페이스**를 구현. 새 기능은 `src/modules/<name>/index.ts` 하나만 추가하면 레지스트리에 자동 등록 (레고 블록식 확장).

### 2.1 트렌드 분석 모듈 (`trends`) — **최우선**
- **내 스토어 분석**: 기간별 베스트셀러, 카테고리별 매출, 재구매율, 장바구니 이탈 분석
- **외부 트렌드 수집**:
  - Google Trends (google-trends-api 패키지)
  - Shopify 공식 트렌드 리포트 크롤링
  - 알리익스프레스 / 아마존 베스트셀러 스크래핑 (선택)
  - SNS 트렌드 (Reddit, TikTok 해시태그 등)
- **AI 인사이트**: Claude API로 데이터 요약 → "이번 주 떠오르는 카테고리 + 우리 스토어 추천 액션" 형태 리포트
- **출력**: 주간 자동 리포트 (마크다운 + 로컬 파일 저장)

### 2.2 상품 업로드/관리 모듈 (`products`)
- **Korealy 연동 워크플로우**:
  1. 사용자가 [Korealy](https://app.korealy.co/shopifyuser/searchProducts)에서 상품을 내 스토어로 푸시
  2. 자동화가 신규 상품 감지 (Shopify webhook `products/create` 또는 폴링)
  3. 후처리 파이프라인 실행:
     - AI 상품 설명 재작성 (한국어 → 타겟 언어 또는 SEO 강화)
     - 이미지 후처리 (sharp: 리사이즈, alt text)
     - 동일 상품 리뷰 자동 수집 (`reviews` 모듈 호출)
     - SEO 메타 최적화 (`marketing` 모듈 호출)
     - 자동 태깅 / 컬렉션 분류
  4. 후처리 완료 시 상품 publish 또는 검토 큐로 이동
- **수동 업로드**: CSV → 동일 후처리 파이프라인
- **가격/재고 동기화**: 공급처 가격 변동 추적 및 자동 반영

### 2.3 리뷰 수집 모듈 (`reviews`) — **신규**
- **소스**: 알리익스프레스, 아마존, 큐텐, 다른 쇼피파이 스토어 등 동일 제품의 리뷰
- **매칭 방식**: 상품명/이미지/바코드 기반 검색 (Claude vision 활용 가능)
- **수집 항목**: 별점, 본문, 작성일, 이미지, 작성자(익명화)
- **자동 번역**: 외국어 리뷰 → 스토어 언어로 번역
- **품질 필터**: 짧은/스팸 리뷰 제외, 별점 분포 균형 유지
- **저장**: Shopify Product Metafield 또는 외부 리뷰 앱(Judge.me, Loox) API 연동
- **법적 주의**: 출처 표기, 가공 리뷰임을 명시할 수 있는 옵션 유지

### 2.4 주문/배송 처리 모듈 (`orders`)
- **신규 주문 폴링**: 일정 주기로 신규 주문 가져와 로컬 DB 저장
- **송장 자동 입력**: 택배사 CSV → Shopify fulfillment API로 일괄 등록
- **배송 추적**: tracking number 업데이트 시 자동 알림
- **이상 주문 감지**: 고액/대량 주문, 사기 의심 패턴 알림
- **CS 템플릿**: 자주 묻는 질문 분류 및 답변 초안 생성

### 2.5 마케팅/SEO 모듈 (`marketing`)
- **메타 데이터 최적화**: 상품별 SEO title/description 자동 생성 및 적용
- **자동 컬렉션**: 트렌드 모듈 결과 기반 동적 컬렉션 생성 (예: "이번 주 인기")
- **할인 코드**: 조건부 자동 생성 (재구매 유도, 장바구니 회수)
- **이메일 캠페인 초안**: 신상품/세일 알림 메일 자동 작성

## 3. 기술 스택

```
런타임       : Node.js 20+
언어         : TypeScript 5+
패키지 매니저 : pnpm (또는 npm)
Shopify SDK : @shopify/shopify-api (GraphQL Admin API 기준)
스케줄러    : node-cron
DB          : better-sqlite3 (로컬 캐시/이력)
HTTP        : undici
이미지      : sharp
AI          : 공급자 무관 어댑터 — Anthropic SDK 또는 OpenAI 호환 API
              (SGLang / Ollama / LM Studio / vLLM 모두 같은 인터페이스)
로깅        : pino
검증        : zod
환경변수    : dotenv
CLI         : commander
테스트      : vitest
```

## 4. 모듈식 아키텍처 (레고 블록 구조)

### 4.1 핵심 원칙
1. **단일 인터페이스**: 모든 모듈은 `Module` 인터페이스 구현
2. **자동 등록**: `src/modules/`에 폴더 추가 → 자동으로 CLI/스케줄러에 노출
3. **느슨한 결합**: 모듈 간 통신은 **EventBus**로만 (직접 import 금지)
4. **공유 자원은 Core**: Shopify API, DB, Logger, AI는 `Context`로 주입
5. **테스트 가능**: 각 모듈은 Context를 mock하면 독립 테스트 가능

### 4.2 Module 인터페이스 (개념)

```typescript
interface Module {
  name: string;                                  // 고유 ID (예: "trends")
  description: string;
  commands?: CliCommand[];                       // CLI 명령 (예: trends:report)
  jobs?: ScheduledJob[];                         // cron 잡
  eventHandlers?: EventHandler[];                // 다른 모듈 이벤트 구독
  init?(ctx: ModuleContext): Promise<void>;      // 초기화 훅
}
```

### 4.3 폴더 구조

```
gusdker/
├── src/
│   ├── core/                       # 공통 인프라 (모듈이 의존)
│   │   ├── config.ts               # 환경변수 로드/검증 (zod)
│   │   ├── logger.ts               # pino 설정
│   │   ├── db.ts                   # SQLite 연결 + 마이그레이션
│   │   ├── shopify.ts              # Admin GraphQL/REST 클라이언트
│   │   ├── ai.ts                   # Claude 클라이언트
│   │   ├── event-bus.ts            # 모듈 간 통신용 pub/sub
│   │   ├── module.ts               # Module 인터페이스 정의
│   │   └── context.ts              # ModuleContext 빌더
│   ├── modules/                    # ← 여기에 폴더만 추가하면 끝
│   │   ├── registry.ts             # 자동 로드/등록
│   │   ├── trends/
│   │   │   ├── index.ts            # Module 정의 (export default)
│   │   │   ├── store-analytics.ts
│   │   │   ├── google-trends.ts
│   │   │   ├── report-generator.ts
│   │   │   └── README.md
│   │   ├── products/
│   │   ├── reviews/
│   │   ├── orders/
│   │   └── marketing/
│   ├── scheduler/
│   │   └── index.ts                # 모든 모듈 jobs 수집 → node-cron 등록
│   ├── cli/
│   │   └── index.ts                # 모든 모듈 commands 수집 → commander
│   └── index.ts                    # 엔트리포인트
├── data/
│   ├── cache.db                    # 로컬 DB (gitignore)
│   └── reports/                    # 생성된 리포트 보관
├── logs/
├── tests/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### 4.4 새 모듈 추가 흐름 (예시)
1. `src/modules/<name>/index.ts` 생성, `Module` 인터페이스 구현
2. `registry.ts`가 자동 발견 → CLI/스케줄러에 등록
3. 기존 코드 수정 불필요

## 5. Shopify 인증 설정

가장 단순한 **Custom App** 방식으로 시작.

1. Shopify Admin → 설정 → 앱 및 판매 채널 → 앱 개발
2. 앱 만들기 → API 자격 증명 확인
3. Admin API 액세스 토큰 발급
4. 필요한 스코프:
   - `read_products`, `write_products`
   - `read_orders`, `write_orders`
   - `read_customers`
   - `read_inventory`, `write_inventory`
   - `read_analytics`, `read_reports`
   - `read_fulfillments`, `write_fulfillments`
   - `read_discounts`, `write_discounts`
   - `read_content`, `write_content` (블로그/페이지 SEO용)

`.env`에 저장할 값:
```
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxx
SHOPIFY_API_VERSION=2025-01
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

## 6. 단계별 실행 로드맵

### Phase 1: 기초 인프라 & 모듈 시스템 ★ 진행 중
- 프로젝트 초기화 (TypeScript, vitest)
- Core 인프라 (config, logger, db, shopify, ai, event-bus)
- Module 인터페이스 + 자동 레지스트리
- CLI (commander) + 스케줄러 (node-cron) 골격
- Shopify 연결 테스트 명령 (`pnpm cli health`)

### Phase 2: 트렌드 분석 모듈 ★ 다음
- 내 스토어 주문/상품 동기화 (SQLite)
- 베스트셀러 집계 쿼리
- Google Trends 연동
- Claude로 주간 리포트 생성
- 마크다운 리포트 자동 저장

### Phase 3: 상품 모듈 (Korealy 연동)
- Shopify webhook `products/create` 수신 (또는 폴링)
- 후처리 파이프라인 (AI 설명, 이미지, 태깅)
- CSV 일괄 업로드 (선택)

### Phase 4: 리뷰 수집 모듈
- 외부 사이트 리뷰 스크래퍼 (사이트별 어댑터 패턴)
- 상품 매칭 로직
- 번역 + 필터링
- Shopify metafield 저장

### Phase 5: 주문/배송 모듈
- 신규 주문 폴링
- 송장 일괄 등록 CLI
- 이상 주문 알림

### Phase 6: 마케팅/SEO 모듈
- SEO 메타 자동 최적화
- 트렌드 기반 동적 컬렉션
- 할인 코드 자동 생성

### Phase 7: 통합 & 운영
- cron 스케줄 등록
- README / 운영 매뉴얼

## 7. 주의사항

- **Rate Limit**: Shopify Admin API는 분당 호출 제한이 있음. GraphQL 쿼리 비용 관리 필수
- **백업**: 일괄 업데이트 전 반드시 dry-run 모드 지원
- **민감 정보**: `.env`, `data/cache.db`, `logs/` 모두 gitignore
- **테스트**: 운영 스토어에 바로 쓰지 말고, 개발 스토어 따로 만들어서 검증 권장 (개발자 파트너 계정으로 무료 생성 가능)
- **상시 운영**: DGX Spark가 상시 켜져 있는 워크스테이션이므로 `systemd` 유닛으로 스케줄러를 등록해 부팅 시 자동 시작 / 크래시 시 자동 재시작을 권장 (Ubuntu 표준 방식)
- **ARM64 호환성**: aarch64 환경에서 일부 npm 패키지가 native binding을 빌드해야 할 수 있음 → `pnpm.onlyBuiltDependencies` 에 명시 (better-sqlite3, sharp 등)
- **GPU 활용**: AI 인사이트는 로컬 SGLang(CUDA 가속)으로 처리하므로 외부 API 요금 / 토큰 한도 걱정 없음. 향후 이미지 처리 / 임베딩도 로컬 GPU로 확장 가능

## 8. 다음 단계

1. 이 계획서 검토 후 우선순위 조정
2. Shopify Custom App 발급 (토큰)
3. Phase 1 착수
