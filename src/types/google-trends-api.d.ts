declare module 'google-trends-api' {
  interface TrendsOptions {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
    hl?: string;
    timezone?: number;
    category?: number;
    property?: '' | 'images' | 'news' | 'youtube' | 'froogle';
  }

  export function interestOverTime(opts: TrendsOptions): Promise<string>;
  export function interestByRegion(opts: TrendsOptions): Promise<string>;
  export function relatedQueries(opts: TrendsOptions): Promise<string>;
  export function relatedTopics(opts: TrendsOptions): Promise<string>;
  export function realTimeTrends(opts: TrendsOptions & { trendDate?: Date }): Promise<string>;
  export function dailyTrends(opts: TrendsOptions & { trendDate?: Date }): Promise<string>;
  export function autoComplete(opts: TrendsOptions): Promise<string>;

  const _default: {
    interestOverTime: typeof interestOverTime;
    interestByRegion: typeof interestByRegion;
    relatedQueries: typeof relatedQueries;
    relatedTopics: typeof relatedTopics;
    realTimeTrends: typeof realTimeTrends;
    dailyTrends: typeof dailyTrends;
    autoComplete: typeof autoComplete;
  };
  export default _default;
}
