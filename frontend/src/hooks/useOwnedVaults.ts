"use client";

import { useSuiClientQuery, useCurrentAccount } from "@mysten/dapp-kit";
import { RAIN } from "@/lib/rain";

export interface OwnedVault {
  objectId: string;
  balance: string;
  owner?: string;
}

function parseBalance(content: unknown): string {
  if (!content || typeof content !== "object") return "0";
  const c = content as Record<string, unknown>;
  const fields = c.fields as Record<string, unknown> | undefined;
  if (!fields) return "0";
  const balance = fields.balance as Record<string, unknown> | undefined;
  const inner = balance?.fields as Record<string, unknown> | undefined;
  if (inner && typeof inner.value === "string") return inner.value;
  return "0";
}

export function useOwnedVaults() {
  const account = useCurrentAccount();
  const { data, isPending, error, refetch } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      filter: { StructType: RAIN.custody.type },
      options: { showContent: true, showOwner: true },
    },
    { enabled: !!account && RAIN.packageId !== "0x0" },
  );

  const vaults: OwnedVault[] = [];
  if (data?.data) {
    for (const obj of data.data) {
      const d = obj.data;
      if (d?.objectId && d.content) {
        vaults.push({
          objectId: d.objectId,
          balance: parseBalance(d.content),
        });
      }
    }
  }

  return {
    vaults,
    isPending,
    error,
    refetch,
    isConfigured: RAIN.packageId !== "0x0",
  };
}
