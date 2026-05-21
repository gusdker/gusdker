# gusdker — 쇼피파이 자동화 툴킷

운영 중인 쇼피파이 스토어를 위한 모듈식 자동화 도구. 트렌드 분석, 상품 관리, 주문 처리, 마케팅을 한 곳에서.

> 상세 계획은 [PLAN.md](./PLAN.md) 참고.

## 빠른 시작

```bash
# 1. 의존성 설치
pnpm install

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일에 Shopify 토큰과 Claude API 키 입력

# 3. Shopify 연결 확인
pnpm cli health

# 4. 트렌드 리포트 생성
pnpm cli trends:report --days 7 --keywords "다이어트,홈트,에어프라이어" --geo KR

# 5. 사용 가능한 모든 명령 보기
pnpm cli --help
```

## 자동 실행 (스케줄러)

```bash
pnpm scheduler
```

각 모듈이 등록한 cron 잡들이 자동 실행된다 (예: 매주 월요일 09:00에 주간 리포트).

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
