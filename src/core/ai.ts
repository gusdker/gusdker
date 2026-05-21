import Anthropic from '@anthropic-ai/sdk';
import { request as undiciRequest } from 'undici';
import { loadConfig, type AiConfig } from './config.js';
import { getLogger } from './logger.js';

const log = getLogger('ai');

export interface AiClient {
  /** 시스템 + 사용자 메시지로 텍스트 생성 */
  complete(opts: { system?: string; user: string; maxTokens?: number }): Promise<string>;
  /** 공급자 식별자 (디버깅용) */
  readonly provider: string;
}

/** Anthropic Claude */
class AnthropicAiClient implements AiClient {
  readonly provider = 'anthropic';
  private readonly sdk: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.sdk = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(opts: { system?: string; user: string; maxTokens?: number }): Promise<string> {
    const res = await this.sdk.messages.create({
      model: this.model,
      max_tokens: opts.maxTokens ?? 2048,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    });
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }
}

/** OpenAI-compatible: Ollama / LM Studio / SGLang / vLLM 등 */
class OpenAiCompatClient implements AiClient {
  readonly provider = 'openai-compat';
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, model: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
    this.apiKey = apiKey;
  }

  async complete(opts: { system?: string; user: string; maxTokens?: number }): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const messages: Array<{ role: string; content: string }> = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: opts.user });

    const res = await undiciRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: opts.maxTokens ?? 2048,
        temperature: 0.7,
      }),
    });
    if (res.statusCode >= 400) {
      const text = await res.body.text();
      throw new Error(`AI server error ${res.statusCode}: ${text}`);
    }
    const body = (await res.body.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI server returned no content');
    }
    return content;
  }
}

/** AI가 설정되지 않은 경우 — 호출하면 명확히 실패 */
class NoneAiClient implements AiClient {
  readonly provider = 'none';
  async complete(): Promise<string> {
    throw new Error(
      'AI provider not configured. Set AI_PROVIDER=openai-compat with AI_BASE_URL/AI_MODEL, or AI_PROVIDER=anthropic with ANTHROPIC_API_KEY.',
    );
  }
}

function build(aiConfig: AiConfig): AiClient {
  switch (aiConfig.provider) {
    case 'anthropic':
      log.debug({ model: aiConfig.model }, 'ai: anthropic');
      return new AnthropicAiClient(aiConfig.apiKey, aiConfig.model);
    case 'openai-compat':
      log.debug({ baseUrl: aiConfig.baseUrl, model: aiConfig.model }, 'ai: openai-compat');
      return new OpenAiCompatClient(aiConfig.baseUrl, aiConfig.model, aiConfig.apiKey);
    case 'none':
      log.warn('ai: not configured (provider=none)');
      return new NoneAiClient();
  }
}

let cached: AiClient | null = null;

export function getAiClient(): AiClient {
  if (cached) return cached;
  cached = build(loadConfig().ai);
  return cached;
}
