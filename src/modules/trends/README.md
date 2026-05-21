# trends 모듈

내 스토어 판매 데이터 + 외부 트렌드(Google Trends) + AI 인사이트로 주간 리포트를 생성한다.

## 명령

```bash
# 최근 30일 베스트셀러 콘솔 출력
pnpm cli trends:bestsellers --days 30 --limit 20

# 트렌드 리포트 생성 (마크다운 파일)
pnpm cli trends:report --days 7 --keywords "다이어트,운동,홈트" --geo KR
```

## 잡 (스케줄러)

| 이름 | 스케줄 | 설명 |
| --- | --- | --- |
| `trends:weekly-report` | `0 9 * * 1` (월요일 09:00) | 주간 리포트 자동 생성 |

## 이벤트

- emit: `trend.report.generated` — 리포트 생성 완료 시 (다른 모듈이 이메일/슬랙 알림 등 후속 처리 가능)

## 출력

리포트는 `data/reports/trends-YYYY-MM-DD.md` 로 저장.

## 확장 포인트

- `store-analytics.ts`: 다른 집계 (카테고리별, 신규 vs 재구매 등) 추가
- `google-trends.ts`: 다른 트렌드 소스 (Naver DataLab, TikTok 등) 어댑터 추가
- `report-generator.ts`: HTML/이메일 형식 출력 추가
