import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const ConfigSchema = z.object({
  shopify: z.object({
    storeDomain: z.string().min(1, 'SHOPIFY_STORE_DOMAIN required'),
    adminToken: z.string().min(1, 'SHOPIFY_ADMIN_TOKEN required'),
    apiVersion: z.string().default('2025-01'),
  }),
  anthropic: z.object({
    apiKey: z.string().min(1, 'ANTHROPIC_API_KEY required'),
    model: z.string().default('claude-opus-4-7'),
  }),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  dataDir: z.string().default('./data'),
  korealy: z.object({
    enabled: z.boolean().default(true),
  }),
  reviews: z.object({
    enabled: z.boolean().default(false),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;

  const parsed = ConfigSchema.safeParse({
    shopify: {
      storeDomain: process.env.SHOPIFY_STORE_DOMAIN,
      adminToken: process.env.SHOPIFY_ADMIN_TOKEN,
      apiVersion: process.env.SHOPIFY_API_VERSION,
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL,
    },
    logLevel: process.env.LOG_LEVEL,
    dataDir: process.env.DATA_DIR,
    korealy: {
      enabled: process.env.KOREALY_ENABLED !== 'false',
    },
    reviews: {
      enabled: process.env.REVIEWS_ENABLED === 'true',
    },
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${issues}\n\n.env 파일을 확인하세요 (.env.example 참고).`);
  }

  cached = parsed.data;
  return cached;
}
