#!/usr/bin/env node
import { Command } from 'commander';
import { buildContext } from '../core/context.js';
import { loadAllModules, initModules } from '../modules/registry.js';
import { getLogger } from '../core/logger.js';
import { closeDb } from '../core/db.js';

const log = getLogger('cli');

async function main() {
  const program = new Command();
  program
    .name('gusdker')
    .description('Shopify automation toolkit')
    .version('0.1.0');

  // 기본 명령: health (Shopify 연결 확인)
  program
    .command('health')
    .description('Shopify 연결 확인')
    .action(async () => {
      const ctx = buildContext('health');
      try {
        const shop = await ctx.shopify.ping();
        console.log('✅ Shopify connected');
        console.log(`   Shop: ${shop.name}`);
        console.log(`   Domain: ${shop.myshopifyDomain}`);
        console.log(`   Email: ${shop.email}`);
      } catch (err) {
        console.error('❌ Shopify connection failed:', (err as Error).message);
        process.exitCode = 1;
      }
    });

  // 모듈 로드 → 각 모듈의 commands를 commander에 등록
  const modules = await loadAllModules();
  const ctx = buildContext('cli');
  const active = await initModules(modules, ctx);

  for (const mod of active) {
    if (!mod.commands?.length) continue;
    for (const cmd of mod.commands) {
      const c = program
        .command(cmd.name)
        .description(`[${mod.name}] ${cmd.description}`);
      if (cmd.configure) cmd.configure(c);
      c.action(async (...args) => {
        // commander: 마지막 인자가 Command 객체 — opts/args 추출
        const command = args[args.length - 1] as Command;
        const opts = command.opts();
        try {
          await cmd.handler(buildContext(mod.name), opts);
        } catch (err) {
          log.error({ command: cmd.name, err }, 'command failed');
          process.exitCode = 1;
        }
      });
    }
  }

  await program.parseAsync(process.argv);
  closeDb();
}

main().catch((err) => {
  log.error({ err }, 'cli crashed');
  process.exit(1);
});
