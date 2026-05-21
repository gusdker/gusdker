import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Module, ModuleContext } from '../core/module.js';
import { eventBus } from '../core/event-bus.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('registry');
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * src/modules/<name>/index.ts 를 자동으로 발견하여 로드.
 * 새 모듈은 폴더만 추가하면 끝 — 다른 파일을 수정할 필요 없음.
 */
export async function loadAllModules(): Promise<Module[]> {
  const modulesDir = __dirname;
  const entries = readdirSync(modulesDir);
  const modules: Module[] = [];

  for (const entry of entries) {
    const fullPath = join(modulesDir, entry);
    if (!statSync(fullPath).isDirectory()) continue;

    // index.ts (dev: tsx) 또는 index.js (build 후) 모두 지원
    const candidates = ['index.ts', 'index.js'];
    const indexPath = candidates
      .map((f) => join(fullPath, f))
      .find((p) => existsSync(p));
    if (!indexPath) continue;

    try {
      const mod = await import(pathToFileURL(indexPath).href);
      const def = mod.default as Module | undefined;
      if (!def || typeof def !== 'object' || !def.name) {
        log.warn({ entry }, 'module has no default export — skipped');
        continue;
      }
      modules.push(def);
    } catch (err) {
      log.error({ entry, err }, 'failed to load module');
    }
  }

  return modules;
}

/**
 * 모듈들의 init / event handler 등록.
 * CLI/스케줄러 시작 시 호출.
 */
export async function initModules(modules: Module[], ctx: ModuleContext): Promise<Module[]> {
  const active: Module[] = [];

  for (const mod of modules) {
    if (mod.enabled && !mod.enabled(ctx.config)) {
      log.info({ module: mod.name }, 'disabled — skipped');
      continue;
    }

    if (mod.init) {
      try {
        await mod.init(ctx);
        log.debug({ module: mod.name }, 'initialized');
      } catch (err) {
        log.error({ module: mod.name, err }, 'init failed');
        continue;
      }
    }

    if (mod.events?.length) {
      for (const h of mod.events) {
        eventBus.on(h.event, (payload) => h.handler(ctx, payload));
      }
    }

    active.push(mod);
    log.info({ module: mod.name }, 'loaded');
  }

  return active;
}
