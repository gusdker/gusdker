import { request as undiciRequest } from 'undici';
import { loadConfig } from './config.js';
import { getLogger } from './logger.js';

const log = getLogger('shopify');

export interface ShopifyClient {
  /** GraphQL Admin API 호출 */
  gql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T>;
  /** REST Admin API 호출 (드물게 필요한 경우) */
  rest<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T>;
  /** 연결 확인 (shop 정보 조회) */
  ping(): Promise<{ name: string; email: string; myshopifyDomain: string }>;
}

class ShopifyHttpClient implements ShopifyClient {
  private readonly base: string;
  private readonly token: string;

  constructor(domain: string, token: string, version: string) {
    this.base = `https://${domain}/admin/api/${version}`;
    this.token = token;
  }

  async gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const url = `${this.base}/graphql.json`;
    const res = await undiciRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.token,
      },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await res.body.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };
    if (res.statusCode >= 400 || body.errors?.length) {
      const msg = body.errors?.map((e) => e.message).join('; ') ?? `HTTP ${res.statusCode}`;
      log.error({ status: res.statusCode, errors: body.errors }, 'shopify gql failed');
      throw new Error(`Shopify GraphQL error: ${msg}`);
    }
    return body.data as T;
  }

  async rest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await undiciRequest(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.statusCode >= 400) {
      const text = await res.body.text();
      log.error({ status: res.statusCode, body: text }, 'shopify rest failed');
      throw new Error(`Shopify REST error ${res.statusCode}: ${text}`);
    }
    return (await res.body.json()) as T;
  }

  async ping() {
    const data = await this.gql<{ shop: { name: string; email: string; myshopifyDomain: string } }>(
      `query ShopInfo { shop { name email myshopifyDomain } }`,
    );
    return data.shop;
  }
}

let cached: ShopifyClient | null = null;

export function getShopifyClient(): ShopifyClient {
  if (cached) return cached;
  const cfg = loadConfig();
  cached = new ShopifyHttpClient(
    cfg.shopify.storeDomain,
    cfg.shopify.adminToken,
    cfg.shopify.apiVersion,
  );
  return cached;
}
