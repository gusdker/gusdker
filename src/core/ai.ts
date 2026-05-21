import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from './config.js';

export interface AiClient {
  /** 짧은 텍스트 생성 (시스템 + 사용자 메시지) */
  complete(opts: {
    system?: string;
    user: string;
    maxTokens?: number;
  }): Promise<string>;
  /** 원본 SDK 접근 (고급 사용) */
  raw(): Anthropic;
}

class AnthropicClient implements AiClient {
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
    const text = res.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((b) => b.text)
      .join('\n');
    return text;
  }

  raw() {
    return this.sdk;
  }
}

let cached: AiClient | null = null;

export function getAiClient(): AiClient {
  if (cached) return cached;
  const cfg = loadConfig();
  cached = new AnthropicClient(cfg.anthropic.apiKey, cfg.anthropic.model);
  return cached;
}
