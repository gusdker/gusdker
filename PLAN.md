# 쇼피파이 자동화 프로젝트 계획서

## 1. 프로젝트 개요

운영 중인 쇼피파이 스토어를 위한 통합 자동화 도구. 트렌드 분석부터 상품 업로드, 주문 처리, 마케팅까지 한 곳에서 관리한다.

- **언어**: Node.js + TypeScript
- **실행 환경**: 로컬 (필요 시 클라우드 이전 가능)
- **스토어**: 기존 운영 중인 쇼피파이 스토어 1개

## 2. 핵심 모듈

### 2.1 트렌드 분석 모듈 (`trends`)
- **내 스토어 분석**: 기간별 베스트셀러, 카테고리별 매출, 재구매율, 장바구니 이탈 분석
- **외부 트렌드 수집**:
  - Google Trends (google-trends-api 패키지)
  - Shopify 공식 트렌드 리포트 크롤링
  - 알리익스프레스 / 아마존 베스트셀러 스크래핑 (선택)
  - SNS 트렌드 (Reddit, TikTok 해시태그 등)
- **AI 인사이트**: Claude API로 데이터 요약 → "이번 주 떠오르는 카테고리 + 우리 스토어 추천 액션" 형태 리포트
- **출력**: 주간 자동 리포트 (마크다운 + 이메일 또는 로컬 파일)

### 2.2 상품 업로드/관리 모듈 (`products`)
- **일괄 업로드**: CSV/JSON → Shopify Admin API
- **이미지 처리**: sharp로 리사이즈, 워터마크, alt text 자동 생성
- **AI 상품 설명**: Claude API로 SEO 친화적 설명/제목 자동 생성
- **가격/재고 동기화**: 공급처(드랍쉬핑) 가격 변동 추적 및 자동 반영
- **변형(variant) 관리**: 색상/사이즈별 일괄 생성

### 2.3 주문/배송 처리 모듈 (`orders`)
- **신규 주문 폴링**: 일정 주기로 신규 주문 가져와 로컬 DB 저장
- **송장 자동 입력**: 택배사 CSV → Shopify fulfillment API로 일괄 등록
- **배송 추적**: tracking number 업데이트 시 자동 알림
- **이상 주문 감지**: 고액/대량 주문, 사기 의심 패턴 알림
- **CS 템플릿**: 자주 묻는 질문 분류 및 답변 초안 생성

### 2.4 마케팅/SEO 모듈 (`marketing`)
- **메타 데이터 최적화**: 상품별 SEO title/description 자동 생성 및 적용
- **자동 컬렉션**: 트렌드 모듈 결과 기반 동적 컬렉션 생성 (예: "이번 주 인기")
- **할인 코드**: 조건부 자동 생성 (재구매 유도, 장바구니 회수)
- **이메일 캠페인 초안**: 신상품/세일 알림 메일 자동 작성

## 3. 기술 스택

```
런타임      : Node.js 20+
언어        : TypeScript 5+
패키지 매니저: pnpm (또는 npm)
Shopify SDK : @shopify/shopify-api (GraphQL Admin API 기준)
스케줄러    : node-cron
DB          : better-sqlite3 (로컬 캐시/이력)
HTTP        : axios / undici
이미지      : sharp
AI          : @anthropic-ai/sdk (Claude)
로깅        : pino
검증        : zod
환경변수    : dotenv
CLI         : commander + inquirer (수동 실행용)
테스트      : vitest
```

## 4. 폴더 구조

```
gusdker/
├── src/
│   ├── core/                  # 공통 인프라
│   │   ├── shopify.ts         # Admin API 클라이언트
│   │   ├── config.ts          # 환경변수 로드/검증
│   │   ├── logger.ts          # pino 설정
│   │   ├── db.ts              # SQLite 연결
│   │   └── ai.ts              # Claude 클라이언트
│   ├── modules/
│   │   ├── trends/            # 트렌드 분석
│   │   ├── products/          # 상품 관리
│   │   ├── orders/            # 주문 처리
│   │   └── marketing/         # 마케팅/SEO
│   ├── scheduler/
│   │   └── index.ts           # cron 등록
│   ├── cli/
│   │   └── index.ts           # 수동 명령 (예: pnpm cli trends:report)
│   └── index.ts               # 엔트리포인트
├── data/
│   ├── cache.db               # 로컬 DB (gitignore)
│   └── reports/               # 생성된 리포트 보관
├── logs/
├── tests/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

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

### Phase 1: 기초 인프라 (1~2일)
- 프로젝트 초기화 (TypeScript, ESLint, prettier, vitest)
- 폴더 구조 잡기
- Shopify 인증 + 연결 테스트 ("Hello, my shop name is X" 출력)
- 로거/DB/설정 모듈 작성

### Phase 2: 데이터 동기화 (2~3일)
- 주문/상품/고객 데이터 → SQLite 동기화 잡
- 증분 동기화 (updated_at 기준)
- 전체/증분 모드 CLI 명령

### Phase 3: 트렌드 분석 (3~5일)
- 내 스토어 베스트셀러 집계 쿼리
- Google Trends 연동
- Claude로 주간 리포트 생성
- 마크다운 리포트 자동 저장

### Phase 4: 상품 업로드 (3~5일)
- CSV → 상품 생성 파이프라인
- 이미지 처리 + alt text
- AI 상품 설명 생성
- 가격/재고 일괄 업데이트

### Phase 5: 주문/배송 (2~3일)
- 신규 주문 폴링
- 송장 일괄 등록 CLI
- 이상 주문 알림

### Phase 6: 마케팅/SEO (2~3일)
- SEO 메타 자동 최적화
- 트렌드 기반 동적 컬렉션
- 할인 코드 자동 생성

### Phase 7: 통합 & 운영 (1~2일)
- cron 스케줄 등록 (예: 매일 새벽 동기화, 매주 월요일 리포트)
- 통합 CLI 정비
- README / 운영 매뉴얼

## 7. 주의사항

- **Rate Limit**: Shopify Admin API는 분당 호출 제한이 있음. GraphQL 쿼리 비용 관리 필수
- **백업**: 일괄 업데이트 전 반드시 dry-run 모드 지원
- **민감 정보**: `.env`, `data/cache.db`, `logs/` 모두 gitignore
- **테스트**: 운영 스토어에 바로 쓰지 말고, 개발 스토어 따로 만들어서 검증 권장 (개발자 파트너 계정으로 무료 생성 가능)
- **로컬 실행 한계**: PC 꺼지면 cron 안 돌아감 → 나중에 라즈베리파이/소형 VPS로 이전 고려

## 8. 다음 단계

1. 이 계획서 검토 후 우선순위 조정
2. Shopify Custom App 발급 (토큰)
3. Phase 1 착수
