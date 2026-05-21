import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const AiProviderSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('anthropic'),
    apiKey: z.string().min(1, 'ANTHROPIC_API_KEY required for anthropic provider'),
    model: z.string().default('claude-opus-4-7'),
  }),
  z.object({
    provider: z.literal('openai-compat'),
    baseUrl: z.string().url('AI_BASE_URL must be a valid URL (e.g. http://localhost:30000/v1)'),
    model: z.string().min(1, 'AI_MODEL required (e.g. "gemma" or the served model name)'),
    apiKey: z.string().default('not-needed'),
  }),
  z.object({
    provider: z.literal('none'),
  }),
]);

const ConfigSchema = z.object({
  shopify: z.object({
    storeDomain: z.string().min(1, 'SHOPIFY_STORE_DOMAIN required'),
    adminToken: z.string().min(1, 'SHOPIFY_ADMIN_TOKEN required'),
    apiVersion: z.string().default('2025-01'),
  }),
  ai: AiProviderSchema,
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
export type AiConfig = AppConfig['ai'];

let cached: AppConfig | null = null;

function buildAiConfig(): Record<string, unknown> {
  const explicit = process.env.AI_PROVIDER?.trim();
  if (explicit === 'openai-compat') {
    return {
      provider: 'openai-compat',
      baseUrl: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL,
      apiKey: process.env.AI_API_KEY,
    };
  }
  if (explicit === 'anthropic') {
    return {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL,
    };
  }
  if (explicit === 'none') {
    return { provider: 'none' };
  }
  // auto-detect: openai-compat URL > anthropic key > none
  if (process.env.AI_BASE_URL) {
    return {
      provider: 'openai-compat',
      baseUrl: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL,
      apiKey: process.env.AI_API_KEY,
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL,
    };
  }
  return { provider: 'none' };
}

export function loadConfig(): AppConfig {
  if (cached) return cached;

  const parsed = ConfigSchema.safeParse({
    shopify: {
      storeDomain: process.env.SHOPIFY_STORE_DOMAIN,
      adminToken: process.env.SHOPIFY_ADMIN_TOKEN,
      apiVersion: process.env.SHOPIFY_API_VERSION,
    },
    ai: buildAiConfig(),
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
