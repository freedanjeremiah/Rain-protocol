"use client";

import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { RAIN, isRainConfigured } from "@/lib/rain";
import { QUERY_KEYS } from "./useRainMutation";

export interface FillRequestData {
  objectId: string;
  borrowOrderId: string;
  lendOrderId: string;
  fillAmount: string;
  lender: string;
  borrower: string;
  vaultId: string;
  expiryMs: string;
  lockedAmount: string;
  status: number; // 0=PENDING, 1=COMPLETED, 2=CANCELLED
}

function parseId(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "id" in val)
    return String((val as Record<string, unknown>).id);
  return "";
}

/**
 * Discovers FillRequest objects relevant to the current user via events.
 * Uses TanStack Query for automatic cache management and invalidation.
 */
export function useActiveFillRequests() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const address = account?.address;

  const { data, isPending, error, refetch } = useQuery({
    queryKey: [...QUERY_KEYS.fillRequests, address],
    queryFn: async () => {
      if (!address) return [];

      // Query FillRequestCreated events
      const eventsResp = await client.queryEvents({
        query: { MoveEventType: RAIN.escrow.fillRequestCreatedEvent },
        limit: 50,
        order: "descending",
      });

      // Collect unique fill request IDs where user is lender or borrower
      const relevantIds = new Set<string>();
      for (const ev of eventsResp.data) {
        const parsed = ev.parsedJson as Record<string, unknown> | undefined;
        if (!parsed) continue;
        const lender = String(parsed.lender ?? "");
        const borrower = String(parsed.borrower ?? "");
        if (lender === address || borrower === address) {
          const frid = String(parsed.fill_request_id ?? "");
          if (frid) relevantIds.add(frid);
        }
      }

      if (relevantIds.size === 0) return [];

      // Fetch each object
      const objectIds = Array.from(relevantIds);
      const objects = await client.multiGetObjects({
        ids: objectIds,
        options: { showContent: true },
      });

      const result: FillRequestData[] = [];
      for (const obj of objects) {
        const d = obj.data;
        if (!d?.objectId || !d.content || d.content.dataType !== "moveObject")
          continue;
        const fields = d.content.fields as Record<string, unknown>;
        result.push({
          objectId: d.objectId,
          borrowOrderId: parseId(fields.borrow_order_id),
          lendOrderId: parseId(fields.lend_order_id),
          fillAmount: String(fields.fill_amount ?? "0"),
          lender: String(fields.lender ?? ""),
          borrower: String(fields.borrower ?? ""),
          vaultId: parseId(fields.vault_id),
          expiryMs: String(fields.expiry_ms ?? "0"),
          lockedAmount: String(
            (fields.locked_balance as Record<string, unknown>)?.fields
              ? String(
                  (
                    (fields.locked_balance as Record<string, unknown>)
                      .fields as Record<string, unknown>
                  )?.value ?? "0",
                )
              : "0",
          ),
          status: Number(fields.status ?? 0),
        });
      }

      return result;
    },
    enabled: isRainConfigured() && !!address,
  });

  return {
    requests: data ?? [],
    isPending,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refetch,
  };
}
