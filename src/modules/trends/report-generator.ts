import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ModuleContext } from '../../core/module.js';
import type { BestsellerRow } from './store-analytics.js';
import type { KeywordTrend } from './google-trends.js';

export interface TrendReport {
  generatedAt: string;
  periodDays: number;
  bestsellers: BestsellerRow[];
  keywordTrends: KeywordTrend[];
  aiInsight: string;
  filePath: string;
}

export async function generateReport(
  ctx: ModuleContext,
  data: {
    sinceDays: number;
    bestsellers: BestsellerRow[];
    keywordTrends: KeywordTrend[];
  },
): Promise<TrendReport> {
  const generatedAt = new Date().toISOString();

  const aiInsight = await callAiForInsight(ctx, data);

  const md = renderMarkdown({
    generatedAt,
    periodDays: data.sinceDays,
    bestsellers: data.bestsellers,
    keywordTrends: data.keywordTrends,
    aiInsight,
  });

  const reportDir = join(ctx.config.dataDir, 'reports');
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
  const fileName = `trends-${generatedAt.slice(0, 10)}.md`;
  const filePath = join(reportDir, fileName);
  writeFileSync(filePath, md, 'utf8');

  return {
    generatedAt,
    periodDays: data.sinceDays,
    bestsellers: data.bestsellers,
    keywordTrends: data.keywordTrends,
    aiInsight,
    filePath,
  };
}

async function callAiForInsight(
  ctx: ModuleContext,
  data: { sinceDays: number; bestsellers: BestsellerRow[]; keywordTrends: KeywordTrend[] },
): Promise<string> {
  const bestsellerSummary = data.bestsellers
    .slice(0, 10)
    .map(
      (b, i) =>
        `${i + 1}. ${b.productTitle}${b.variantTitle ? ` (${b.variantTitle})` : ''} — ${b.unitsSold}개, ${b.grossRevenue.toFixed(0)} ${b.currency}`,
    )
    .join('\n');

  const trendSummary = data.keywordTrends
    .map(
      (t) =>
        `- ${t.keyword}: 평균 관심도 ${t.averageInterest.toFixed(1)}, 떠오르는 연관어: ${t.relatedRising.slice(0, 5).join(', ') || '없음'}`,
    )
    .join('\n');

  const user = `최근 ${data.sinceDays}일 우리 스토어 판매 데이터와 Google Trends 데이터입니다.

## 베스트셀러 Top 10
${bestsellerSummary || '(데이터 없음)'}

## 키워드 트렌드
${trendSummary || '(데이터 없음)'}

위 데이터를 분석해서 다음을 한국어로 작성해줘:
1. **요약** (3줄): 이번 주 우리 스토어와 시장 동향
2. **주목할 점** (3~5개 bullet): 데이터에서 발견한 인사이트
3. **추천 액션** (3~5개 bullet): 다음 주 우리가 해야 할 구체적인 행동
4. **신상품 아이디어** (3개): 트렌드 데이터를 바탕으로 입고를 고려할 만한 아이템

마크다운 형식으로 답변.`;

  try {
    return await ctx.ai.complete({
      system:
        '당신은 이커머스 데이터 분석가다. 간결하고 실행 가능한 인사이트를 한국어로 제공한다.',
      user,
      maxTokens: 1500,
    });
  } catch (err) {
    ctx.log.warn({ err: (err as Error).message }, 'AI insight failed — using fallback');
    return '_AI 인사이트 생성 실패 — ANTHROPIC_API_KEY 와 네트워크 확인 필요._';
  }
}

function renderMarkdown(input: {
  generatedAt: string;
  periodDays: number;
  bestsellers: BestsellerRow[];
  keywordTrends: KeywordTrend[];
  aiInsight: string;
}): string {
  const lines: string[] = [];
  lines.push(`# 트렌드 리포트`);
  lines.push('');
  lines.push(`- 생성 시각: ${input.generatedAt}`);
  lines.push(`- 분석 기간: 최근 ${input.periodDays}일`);
  lines.push('');

  lines.push(`## 베스트셀러`);
  if (input.bestsellers.length === 0) {
    lines.push('_판매 데이터 없음._');
  } else {
    lines.push('| 순위 | 상품 | 변형 | 판매 수량 | 매출 |');
    lines.push('| --- | --- | --- | ---: | ---: |');
    input.bestsellers.slice(0, 20).forEach((b, i) => {
      lines.push(
        `| ${i + 1} | ${escape(b.productTitle)} | ${escape(b.variantTitle ?? '')} | ${b.unitsSold} | ${b.grossRevenue.toFixed(0)} ${b.currency} |`,
      );
    });
  }
  lines.push('');

  lines.push(`## 키워드 트렌드 (Google Trends)`);
  if (input.keywordTrends.length === 0) {
    lines.push('_조회한 키워드 없음._');
  } else {
    for (const t of input.keywordTrends) {
      lines.push(`### ${t.keyword}`);
      lines.push(`- 평균 관심도: ${t.averageInterest.toFixed(1)}`);
      lines.push(
        `- 떠오르는 연관 검색어: ${t.relatedRising.length ? t.relatedRising.slice(0, 10).join(', ') : '없음'}`,
      );
      lines.push('');
    }
  }

  lines.push(`## AI 인사이트`);
  lines.push(input.aiInsight);
  lines.push('');

  return lines.join('\n');
}

function escape(s: string): string {
  return s.replace(/\|/g, '\\|');
}
