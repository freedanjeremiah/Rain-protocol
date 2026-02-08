"use client";

import { useEffect, useState, useCallback } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { RAIN, isMarketplaceConfigured } from "@/lib/rain";

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

/**
 * Query the LendingMarketplace shared object for open borrow and lend orders.
 * Sui Tables store entries as dynamic fields on the Table's internal UID.
 * We first read the marketplace object to get the table IDs, then query dynamic fields on each.
 */
export function useMarketplaceOrders() {
  const client = useSuiClient();
  const [borrowOrders, setBorrowOrders] = useState<MarketBorrowOrder[]>([]);
  const [lendOrders, setLendOrders] = useState<MarketLendOrder[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!isMarketplaceConfigured()) return;
    setIsPending(true);
    setError(null);
    try {
      // 1. Get marketplace object to find table UIDs
      const mpObj = await client.getObject({
        id: RAIN.marketplaceId,
        options: { showContent: true },
      });
      const mpContent = mpObj.data?.content;
      if (!mpContent || mpContent.dataType !== "moveObject") {
        setError("Cannot read marketplace object");
        return;
      }
      const mpFields = mpContent.fields as Record<string, unknown>;
      // Table fields have { type: "...", fields: { id: { id: "0x..." }, size: "..." } }
      const borrowTableId = parseTableId(mpFields.borrow_orders);
      const lendTableId = parseTableId(mpFields.lend_orders);

      // 2. Query dynamic fields on each table
      const [bOrders, lOrders] = await Promise.all([
        borrowTableId ? fetchTableEntries(client, borrowTableId, "borrow") : Promise.resolve([]),
        lendTableId ? fetchTableEntries(client, lendTableId, "lend") : Promise.resolve([]),
      ]);

      setBorrowOrders(bOrders as MarketBorrowOrder[]);
      setLendOrders(lOrders as MarketLendOrder[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsPending(false);
    }
  }, [client]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { borrowOrders, lendOrders, isPending, error, refetch: fetchOrders };
}

function parseTableId(tableField: unknown): string | null {
  if (!tableField || typeof tableField !== "object") return null;
  const f = tableField as Record<string, unknown>;
  // Table field in Sui: { fields: { id: { id: "0x..." }, size: "..." } }
  const fields = f.fields as Record<string, unknown> | undefined;
  if (fields) {
    const idObj = fields.id as Record<string, unknown> | undefined;
    if (idObj && typeof idObj === "object" && "id" in idObj) return String(idObj.id);
    if (typeof fields.id === "string") return fields.id;
  }
  // direct: { id: { id: "0x..." } }
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

    // Fetch each dynamic field object in parallel
    const entries = await Promise.all(
      page.data.map(async (df) => {
        try {
          const obj = await client.getDynamicFieldObject({
            parentId: tableId,
            name: df.name,
          });
          const content = obj.data?.content;
          if (!content || content.dataType !== "moveObject") return null;
          // Dynamic field wraps the value: fields.value contains the order
          const dfFields = content.fields as Record<string, unknown>;
          const value = dfFields.value as Record<string, unknown> | undefined;
          const orderFields = value?.fields ?? value;
          // The order's object ID is in the dynamic field name (the key)
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
