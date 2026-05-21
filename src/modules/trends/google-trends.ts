import googleTrends from 'google-trends-api';
import type { ModuleContext } from '../../core/module.js';

/**
 * Google Trends에서 키워드들의 관심도/관련 키워드를 조회.
 * google-trends-api는 비공식 패키지 — 종종 응답이 비거나 차단될 수 있음.
 */

export interface InterestPoint {
  date: string;
  value: number;
}

export interface KeywordTrend {
  keyword: string;
  timeline: InterestPoint[];
  averageInterest: number;
  relatedRising: string[];
}

export async function fetchKeywordTrends(
  ctx: ModuleContext,
  keywords: string[],
  opts: { geo?: string; daysBack?: number } = {},
): Promise<KeywordTrend[]> {
  const results: KeywordTrend[] = [];
  const startTime = new Date();
  startTime.setDate(startTime.getDate() - (opts.daysBack ?? 30));

  for (const keyword of keywords) {
    try {
      const interestRaw = (await googleTrends.interestOverTime({
        keyword,
        startTime,
        geo: opts.geo ?? '',
      })) as string;
      const interestJson = JSON.parse(interestRaw) as {
        default?: { timelineData?: Array<{ formattedTime: string; value: number[] }> };
      };
      const timeline = (interestJson.default?.timelineData ?? []).map((p) => ({
        date: p.formattedTime,
        value: p.value?.[0] ?? 0,
      }));
      const avg =
        timeline.length === 0
          ? 0
          : timeline.reduce((s, t) => s + t.value, 0) / timeline.length;

      let related: string[] = [];
      try {
        const relRaw = (await googleTrends.relatedQueries({
          keyword,
          startTime,
          geo: opts.geo ?? '',
        })) as string;
        const relJson = JSON.parse(relRaw) as {
          default?: {
            rankedList?: Array<{
              rankedKeyword?: Array<{ query: string; value: number }>;
            }>;
          };
        };
        // rankedList[1] = rising queries (rankedList[0] = top)
        const rising = relJson.default?.rankedList?.[1]?.rankedKeyword ?? [];
        related = rising.slice(0, 10).map((r) => r.query);
      } catch (err) {
        ctx.log.warn({ keyword, err: (err as Error).message }, 'related queries failed');
      }

      results.push({
        keyword,
        timeline,
        averageInterest: avg,
        relatedRising: related,
      });
    } catch (err) {
      ctx.log.warn({ keyword, err: (err as Error).message }, 'google trends failed');
      results.push({ keyword, timeline: [], averageInterest: 0, relatedRising: [] });
    }
  }

  return results;
}
