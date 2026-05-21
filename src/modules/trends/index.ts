import type { Module } from '../../core/module.js';
import { eventBus } from '../../core/event-bus.js';
import { fetchBestsellers } from './store-analytics.js';
import { fetchKeywordTrends } from './google-trends.js';
import { generateReport } from './report-generator.js';

const trendsModule: Module = {
  name: 'trends',
  description: '트렌드 분석 — 내 스토어 판매 데이터 + Google Trends + AI 인사이트',

  async init(ctx) {
    // 모듈 자체 테이블 (리포트 이력)
    ctx.db.exec(`
      CREATE TABLE IF NOT EXISTS trends_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        generated_at TEXT NOT NULL,
        period_days INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        bestsellers_json TEXT,
        keyword_trends_json TEXT
      );
    `);
  },

  commands: [
    {
      name: 'trends:bestsellers',
      description: '내 스토어 베스트셀러 조회 (콘솔 출력)',
      configure: (cmd) =>
        cmd
          .option('-d, --days <n>', '분석 기간 (일)', '30')
          .option('-l, --limit <n>', '표시 개수', '20'),
      handler: async (ctx, args) => {
        const days = parseInt(String(args.days ?? '30'), 10);
        const limit = parseInt(String(args.limit ?? '20'), 10);
        ctx.log.info({ days, limit }, 'fetching bestsellers');
        const rows = await fetchBestsellers(ctx, { sinceDays: days, limit });
        if (rows.length === 0) {
          console.log('판매 데이터가 없습니다.');
          return;
        }
        console.log(`\n베스트셀러 — 최근 ${days}일\n`);
        rows.forEach((r, i) => {
          const variant = r.variantTitle ? ` (${r.variantTitle})` : '';
          console.log(
            `${(i + 1).toString().padStart(2)}. ${r.productTitle}${variant} — ${r.unitsSold}개 / ${r.grossRevenue.toFixed(0)} ${r.currency}`,
          );
        });
      },
    },
    {
      name: 'trends:report',
      description: '트렌드 리포트 생성 (마크다운 파일로 저장)',
      configure: (cmd) =>
        cmd
          .option('-d, --days <n>', '분석 기간 (일)', '7')
          .option('-k, --keywords <list>', '쉼표로 구분된 키워드 (Google Trends)', '')
          .option('-g, --geo <code>', '국가 코드 (예: KR, US)', 'KR'),
      handler: async (ctx, args) => {
        const days = parseInt(String(args.days ?? '7'), 10);
        const keywords = String(args.keywords ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const geo = String(args.geo ?? 'KR');

        ctx.log.info({ days, keywords, geo }, 'generating trend report');
        const [bestsellers, keywordTrends] = await Promise.all([
          fetchBestsellers(ctx, { sinceDays: days, limit: 50 }),
          keywords.length ? fetchKeywordTrends(ctx, keywords, { geo, daysBack: 30 }) : Promise.resolve([]),
        ]);

        const report = await generateReport(ctx, {
          sinceDays: days,
          bestsellers,
          keywordTrends,
        });

        ctx.db
          .prepare(
            `INSERT INTO trends_reports (generated_at, period_days, file_path, bestsellers_json, keyword_trends_json)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            report.generatedAt,
            report.periodDays,
            report.filePath,
            JSON.stringify(report.bestsellers),
            JSON.stringify(report.keywordTrends),
          );

        eventBus.emit('trend.report.generated', { filePath: report.filePath });
        console.log(`✅ 리포트 생성 완료: ${report.filePath}`);
      },
    },
  ],

  jobs: [
    {
      name: 'trends:weekly-report',
      // 매주 월요일 09:00
      schedule: '0 9 * * 1',
      description: '주간 트렌드 리포트 자동 생성',
      handler: async (ctx) => {
        const bestsellers = await fetchBestsellers(ctx, { sinceDays: 7, limit: 50 });
        const report = await generateReport(ctx, {
          sinceDays: 7,
          bestsellers,
          keywordTrends: [],
        });
        ctx.log.info({ filePath: report.filePath }, 'weekly report generated');
        eventBus.emit('trend.report.generated', { filePath: report.filePath });
      },
    },
  ],
};

export default trendsModule;
