"use client";

import { useSuiClient } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { RAIN, isMarketplaceConfigured } from "@/lib/rain";
import { QUERY_KEYS } from "./useRainMutation";

export interface MarketBorrowOrder {
  objectId: string;
  borrower: string;
  vaultId: string;
  amount: string;
  filledAmount: string;
  remaining: string;
  maxInterestBps: string;
  durationSecs: string;
}

export interface MarketLendOrder {
  objectId: string;
  lender: string;
  amount: string;
  filledAmount: string;
  remaining: string;
  minInterestBps: string;
  durationSecs: string;
}

function parseId(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "id" in val) return String((val as Record<string, unknown>).id);
  return "";
}

function parseBorrowFields(objectId: string, content: unknown): MarketBorrowOrder | null {
  if (!content || typeof content !== "object") return null;
  const c = content as Record<string, unknown>;
  const fields = (c.fields ?? c) as Record<string, unknown>;
  if (!fields) return null;
  const amount = String(fields.amount ?? "0");
  const filledAmount = String(fields.filled_amount ?? "0");
  return {
    objectId,
    borrower: String(fields.borrower ?? ""),
    vaultId: parseId(fields.vault_id),
    amount,
    filledAmount,
    remaining: String(Number(amount) - Number(filledAmount)),
    maxInterestBps: String(fields.max_interest_bps ?? "0"),
    durationSecs: String(fields.duration_secs ?? "0"),
  };
}

function parseLendFields(objectId: string, content: unknown): MarketLendOrder | null {
  if (!content || typeof content !== "object") return null;
  const c = content as Record<string, unknown>;
  const fields = (c.fields ?? c) as Record<string, unknown>;
  if (!fields) return null;
  const amount = String(fields.amount ?? "0");
  const filledAmount = String(fields.filled_amount ?? "0");
  return {
    objectId,
    lender: String(fields.lender ?? ""),
    amount,
    filledAmount,
    remaining: String(Number(amount) - Number(filledAmount)),
    minInterestBps: String(fields.min_interest_bps ?? "0"),
    durationSecs: String(fields.duration_secs ?? "0"),
  };
}

function parseTableId(tableField: unknown): string | null {
  if (!tableField || typeof tableField !== "object") return null;
  const f = tableField as Record<string, unknown>;
  const fields = f.fields as Record<string, unknown> | undefined;
  if (fields) {
    const idObj = fields.id as Record<string, unknown> | undefined;
    if (idObj && typeof idObj === "object" && "id" in idObj) return String(idObj.id);
    if (typeof fields.id === "string") return fields.id;
  }
  const idObj = f.id as Record<string, unknown> | undefined;
  if (idObj && typeof idObj === "object" && "id" in idObj) return String(idObj.id);
  if (typeof f.id === "string") return f.id;
  return null;
}

type SuiClient = ReturnType<typeof useSuiClient>;

async function fetchTableEntries(
  client: SuiClient,
  tableId: string,
  kind: "borrow" | "lend",
): Promise<(MarketBorrowOrder | MarketLendOrder)[]> {
  const results: (MarketBorrowOrder | MarketLendOrder)[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const page = await client.getDynamicFields({
      parentId: tableId,
      cursor: cursor ?? undefined,
      limit: 50,
    });

    if (page.data.length === 0) break;

    const entries = await Promise.all(
      page.data.map(async (df) => {
        try {
          const obj = await client.getDynamicFieldObject({
            parentId: tableId,
            name: df.name,
          });
          const content = obj.data?.content;
          if (!content || content.dataType !== "moveObject") return null;
          const dfFields = content.fields as Record<string, unknown>;
          const value = dfFields.value as Record<string, unknown> | undefined;
          const orderFields = value?.fields ?? value;
          const orderId = typeof df.name.value === "string" ? df.name.value : df.objectId;
          if (kind === "borrow") {
            return parseBorrowFields(orderId, orderFields ? { fields: orderFields } : null);
          } else {
            return parseLendFields(orderId, orderFields ? { fields: orderFields } : null);
          }
        } catch {
          return null;
        }
      }),
    );

    for (const e of entries) {
      if (e) results.push(e);
    }

    cursor = page.nextCursor ?? null;
    hasMore = page.hasNextPage;
  }

  return results;
}

/**
 * Query the LendingMarketplace shared object for open borrow and lend orders.
 * Uses TanStack Query for automatic cache management and invalidation.
 */
export function useMarketplaceOrders() {
  const client = useSuiClient();

  const { data, isPending, error, refetch } = useQuery({
    queryKey: [...QUERY_KEYS.marketplaceOrders],
    queryFn: async () => {
      const mpObj = await client.getObject({
        id: RAIN.marketplaceId,
        options: { showContent: true },
      });
      const mpContent = mpObj.data?.content;
      if (!mpContent || mpContent.dataType !== "moveObject") {
        throw new Error("Cannot read marketplace object");
      }
      const mpFields = mpContent.fields as Record<string, unknown>;
      const borrowTableId = parseTableId(mpFields.borrow_orders);
      const lendTableId = parseTableId(mpFields.lend_orders);

      const [bOrders, lOrders] = await Promise.all([
        borrowTableId ? fetchTableEntries(client, borrowTableId, "borrow") : Promise.resolve([]),
        lendTableId ? fetchTableEntries(client, lendTableId, "lend") : Promise.resolve([]),
      ]);

      return {
        borrowOrders: bOrders as MarketBorrowOrder[],
        lendOrders: lOrders as MarketLendOrder[],
      };
    },
    enabled: isMarketplaceConfigured(),
  });

  return {
    borrowOrders: data?.borrowOrders ?? [],
    lendOrders: data?.lendOrders ?? [],
    isPending,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refetch,
  };
}
