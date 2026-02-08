"use client";

import { useEffect, useState, useCallback } from "react";
import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { RAIN, isRainConfigured } from "@/lib/rain";

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
 * Queries FillRequestCreated events, filters by user (lender or borrower),
 * fetches each object and parses its current state.
 */
export function useActiveFillRequests() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const [requests, setRequests] = useState<FillRequestData[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!isRainConfigured() || !account?.address) return;
    setIsPending(true);
    setError(null);
    try {
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
        if (lender === account.address || borrower === account.address) {
          const frid = String(parsed.fill_request_id ?? "");
          if (frid) relevantIds.add(frid);
        }
      }

      if (relevantIds.size === 0) {
        setRequests([]);
        return;
      }

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

      setRequests(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsPending(false);
    }
  }, [client, account?.address]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { requests, isPending, error, refetch: fetchRequests };
}
