import type { ModuleContext } from '../../core/module.js';

/**
 * 내 스토어 판매 데이터를 Shopify에서 가져와 베스트셀러를 집계한다.
 * 우선은 GraphQL `orders` 쿼리로 최근 N일 데이터를 페이지네이션해서 가져오고,
 * 라인 아이템 단위로 수량/매출을 집계.
 */

export interface BestsellerRow {
  productId: string;
  productTitle: string;
  variantTitle: string | null;
  unitsSold: number;
  grossRevenue: number;
  currency: string;
}

interface OrdersPage {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{
      node: {
        id: string;
        createdAt: string;
        lineItems: {
          edges: Array<{
            node: {
              quantity: number;
              originalTotalSet: { shopMoney: { amount: string; currencyCode: string } };
              product: { id: string; title: string } | null;
              variant: { id: string; title: string } | null;
            };
          }>;
        };
      };
    }>;
  };
}

const ORDERS_QUERY = /* GraphQL */ `
  query Orders($cursor: String, $query: String) {
    orders(first: 100, after: $cursor, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          createdAt
          lineItems(first: 100) {
            edges {
              node {
                quantity
                originalTotalSet { shopMoney { amount currencyCode } }
                product { id title }
                variant { id title }
              }
            }
          }
        }
      }
    }
  }
`;

export async function fetchBestsellers(
  ctx: ModuleContext,
  opts: { sinceDays: number; limit?: number },
): Promise<BestsellerRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - opts.sinceDays);
  const sinceStr = since.toISOString().slice(0, 10);
  const queryFilter = `created_at:>=${sinceStr}`;

  const tally = new Map<string, BestsellerRow>();
  let cursor: string | null = null;
  let pages = 0;

  while (true) {
    const data: OrdersPage = await ctx.shopify.gql(ORDERS_QUERY, {
      cursor,
      query: queryFilter,
    });
    pages++;
    for (const orderEdge of data.orders.edges) {
      for (const liEdge of orderEdge.node.lineItems.edges) {
        const li = liEdge.node;
        if (!li.product) continue;
        const key = `${li.product.id}::${li.variant?.id ?? 'default'}`;
        const existing = tally.get(key);
        const revenue = parseFloat(li.originalTotalSet.shopMoney.amount);
        if (existing) {
          existing.unitsSold += li.quantity;
          existing.grossRevenue += revenue;
        } else {
          tally.set(key, {
            productId: li.product.id,
            productTitle: li.product.title,
            variantTitle: li.variant?.title ?? null,
            unitsSold: li.quantity,
            grossRevenue: revenue,
            currency: li.originalTotalSet.shopMoney.currencyCode,
          });
        }
      }
    }
    if (!data.orders.pageInfo.hasNextPage) break;
    cursor = data.orders.pageInfo.endCursor;
    if (pages > 50) {
      ctx.log.warn({ pages }, 'pagination limit reached — stopping');
      break;
    }
  }

  const rows = Array.from(tally.values()).sort((a, b) => b.unitsSold - a.unitsSold);
  return opts.limit ? rows.slice(0, opts.limit) : rows;
}
