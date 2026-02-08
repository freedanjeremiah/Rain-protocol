"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Canonical query keys for Rain protocol data.
 * Used by both data-fetching hooks and mutation invalidation.
 *
 * For useSuiClientQuery("getOwnedObjects", ...) the dapp-kit internally
 * builds a key like ["getOwnedObjects", { filter, ... }]. We match on
 * the prefix so that invalidation catches all variants.
 */
export const QUERY_KEYS = {
  ownedVaults: ["getOwnedObjects", "UserVault"],
  ownedPositions: ["getOwnedObjects", "LoanPosition"],
  ownedCustody: ["getOwnedObjects", "CustodyVault"],
  ownedAuths: ["getOwnedObjects", "RepaymentAuth"],
  marketplaceOrders: ["marketplace-orders"],
  fillRequests: ["fill-requests"],
} as const;

type InvalidationKey = keyof typeof QUERY_KEYS;

/**
 * Returns a callback that invalidates the specified query keys.
 * Call this after a successful transaction to refresh stale data.
 *
 * Usage:
 *   const invalidate = useInvalidateAfterTx(["ownedVaults", "ownedCustody"]);
 *   await signAndExecute({ transaction: tx });
 *   invalidate();
 */
export function useInvalidateAfterTx(keys: InvalidationKey[]) {
  const qc = useQueryClient();
  return useCallback(() => {
    for (const k of keys) {
      const qk = QUERY_KEYS[k];
      // For useSuiClientQuery keys, invalidate anything whose key starts
      // with "getOwnedObjects" (prefix match handles the varying filter args).
      // For custom keys like "marketplace-orders", exact prefix match works.
      if (qk[0] === "getOwnedObjects") {
        qc.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            if (!Array.isArray(key) || key[0] !== "getOwnedObjects") return false;
            // Match on the StructType filter containing the type name
            const json = JSON.stringify(key);
            return json.includes(qk[1]);
          },
        });
      } else {
        qc.invalidateQueries({ queryKey: [...qk] });
      }
    }
  }, [qc, keys]);
}
