import { loadConfig } from './config.js';
import { getLogger } from './logger.js';
import { getDb } from './db.js';
import { getShopifyClient } from './shopify.js';
import { getAiClient } from './ai.js';
import type { ModuleContext } from './module.js';

export function buildContext(scope?: string): ModuleContext {
  return {
    config: loadConfig(),
    log: getLogger(scope),
    db: getDb(),
    shopify: getShopifyClient(),
    ai: getAiClient(),
  };
}
