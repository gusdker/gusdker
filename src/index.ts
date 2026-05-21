/**
 * 라이브러리 진입점 (외부에서 import 할 때).
 * CLI 실행은 src/cli/index.ts, 스케줄러는 src/scheduler/index.ts 를 직접 사용.
 */
export { buildContext } from './core/context.js';
export { loadAllModules, initModules } from './modules/registry.js';
export { eventBus } from './core/event-bus.js';
export type { Module, ModuleContext, CliCommand, ScheduledJob } from './core/module.js';
