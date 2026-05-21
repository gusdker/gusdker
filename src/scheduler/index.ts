#!/usr/bin/env node
import cron from 'node-cron';
import { buildContext } from '../core/context.js';
import { loadAllModules, initModules } from '../modules/registry.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('scheduler');

async function main() {
  const ctx = buildContext('scheduler');
  const modules = await loadAllModules();
  const active = await initModules(modules, ctx);

  let scheduled = 0;
  for (const mod of active) {
    if (!mod.jobs?.length) continue;
    for (const job of mod.jobs) {
      if (!cron.validate(job.schedule)) {
        log.error({ module: mod.name, job: job.name, schedule: job.schedule }, 'invalid cron');
        continue;
      }

      cron.schedule(job.schedule, async () => {
        const start = Date.now();
        const jobCtx = buildContext(`${mod.name}:${job.name}`);
        try {
          jobCtx.log.info('job started');
          await job.handler(jobCtx);
          jobCtx.log.info({ durationMs: Date.now() - start }, 'job done');
        } catch (err) {
          jobCtx.log.error({ err }, 'job failed');
        }
      });

      log.info(
        { module: mod.name, job: job.name, schedule: job.schedule },
        'job scheduled',
      );
      scheduled++;

      if (job.runOnStart) {
        const jobCtx = buildContext(`${mod.name}:${job.name}`);
        job.handler(jobCtx).catch((err) => jobCtx.log.error({ err }, 'startup run failed'));
      }
    }
  }

  log.info({ scheduled }, 'scheduler ready');
  // keep alive
}

main().catch((err) => {
  log.error({ err }, 'scheduler crashed');
  process.exit(1);
});
