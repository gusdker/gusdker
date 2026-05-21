import type { Command } from 'commander';
import type { AppConfig } from './config.js';
import type { Logger } from './logger.js';
import type { DB } from './db.js';
import type { ShopifyClient } from './shopify.js';
import type { AiClient } from './ai.js';
import type { EventName } from './event-bus.js';

/**
 * 모든 모듈에 주입되는 공유 자원.
 * 모듈이 새로운 자원을 필요로 하면 여기에 추가.
 */
export interface ModuleContext {
  config: AppConfig;
  log: Logger;
  db: DB;
  shopify: ShopifyClient;
  ai: AiClient;
}

/** CLI 명령 — 모듈이 commander에 등록할 명령 */
export interface CliCommand {
  /** 예: "trends:report" */
  name: string;
  description: string;
  /** commander 명령 구성 콜백 (옵션/인자 추가용) */
  configure?: (cmd: Command) => void;
  /** 명령 실행 핸들러 */
  handler: (ctx: ModuleContext, args: Record<string, unknown>) => Promise<void>;
}

/** cron 스케줄 잡 */
export interface ScheduledJob {
  /** 예: "trends:weekly-report" */
  name: string;
  /** cron 표현식 (예: "0 9 * * 1" = 매주 월요일 09:00) */
  schedule: string;
  description: string;
  /** 실행 핸들러 */
  handler: (ctx: ModuleContext) => Promise<void>;
  /** 시작 시 즉시 1회 실행할지 여부 */
  runOnStart?: boolean;
}

/** 이벤트 핸들러 등록 */
export interface ModuleEventHandler {
  event: EventName;
  handler: (ctx: ModuleContext, payload: unknown) => Promise<void> | void;
}

/** 모듈 정의 — 각 모듈의 index.ts에서 default export */
export interface Module {
  /** 고유 ID (예: "trends") */
  name: string;
  description: string;
  /** 비활성화 시 등록 스킵 */
  enabled?: (config: AppConfig) => boolean;
  /** CLI 명령들 */
  commands?: CliCommand[];
  /** cron 잡들 */
  jobs?: ScheduledJob[];
  /** 이벤트 구독 */
  events?: ModuleEventHandler[];
  /** 초기화 훅 (테이블 생성 등) */
  init?: (ctx: ModuleContext) => Promise<void>;
}
