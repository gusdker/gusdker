import pino from 'pino';
import { loadConfig } from './config.js';

export type Logger = pino.Logger;

let rootLogger: Logger | null = null;

function buildRootLogger(): Logger {
  const cfg = loadConfig();
  return pino({
    level: cfg.logLevel,
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
          },
  });
}

export function getLogger(scope?: string): Logger {
  if (!rootLogger) rootLogger = buildRootLogger();
  return scope ? rootLogger.child({ scope }) : rootLogger;
}
