"use client";

import { useSuiClientQuery, useCurrentAccount } from "@mysten/dapp-kit";
import { RAIN } from "@/lib/rain";

export interface OwnedCustodyVault {
  objectId: string;
  owner: string;
  balance: string;
}

function parseCustodyFields(content: unknown): Omit<OwnedCustodyVault, "objectId"> {
  const defaults = { owner: "", balance: "0" };
  if (!content || typeof content !== "object") return defaults;
  const c = content as Record<string, unknown>;
  const fields = c.fields as Record<string, unknown> | undefined;
  if (!fields) return defaults;

  // balance is a Balance<SUI> which Sui serialises as string
  let balance = "0";
  if (typeof fields.balance === "string") {
    balance = fields.balance;
  } else if (fields.balance && typeof fields.balance === "object") {
    const b = fields.balance as Record<string, unknown>;
    balance = String(b.value ?? b.fields ?? "0");
    if (typeof b.fields === "object" && b.fields) {
      balance = String((b.fields as Record<string, unknown>).value ?? "0");
    }
  }

  return {
    owner: String(fields.owner ?? ""),
    balance,
  };
}

export function useOwnedCustodyVaults() {
  const account = useCurrentAccount();
  const { data, isPending, error, refetch } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      filter: { StructType: RAIN.custody.type },
      options: { showContent: true },
    },
    { enabled: !!account && RAIN.packageId !== "0x0" },
  );

  const custodyVaults: OwnedCustodyVault[] = [];
  if (data?.data) {
    for (const obj of data.data) {
      const d = obj.data;
      if (d?.objectId && d.content) {
        custodyVaults.push({
          objectId: d.objectId,
          ...parseCustodyFields(d.content),
        });
      }
    }
  }

  return { custodyVaults, isPending, error, refetch };
}
