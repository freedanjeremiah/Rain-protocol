"use client";

import { useSuiClientQuery, useCurrentAccount } from "@mysten/dapp-kit";
import { RAIN } from "@/lib/rain";

export interface OwnedLoanPosition {
  objectId: string;
  borrower: string;
  lender: string;
  principal: string;
  rateBps: string;
  termSecs: string;
  vaultId: string;
}

function parseLoanFields(
  content: unknown,
): Omit<OwnedLoanPosition, "objectId"> {
  const defaults: Omit<OwnedLoanPosition, "objectId"> = {
    borrower: "",
    lender: "",
    principal: "0",
    rateBps: "0",
    termSecs: "0",
    vaultId: "",
  };
  if (!content || typeof content !== "object") return defaults;
  const c = content as Record<string, unknown>;
  const fields = c.fields as Record<string, unknown> | undefined;
  if (!fields) return defaults;

  return {
    borrower: String(fields.borrower ?? ""),
    lender: String(fields.lender ?? ""),
    principal: String(fields.principal ?? "0"),
    rateBps: String(fields.rate_bps ?? "0"),
    termSecs: String(fields.term_secs ?? "0"),
    vaultId:
      typeof fields.vault_id === "string"
        ? fields.vault_id
        : String((fields.vault_id as Record<string, string>)?.id ?? ""),
  };
}

export function useOwnedLoanPositions() {
  const account = useCurrentAccount();
  const { data, isPending, error, refetch } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      filter: { StructType: RAIN.marketplace.loanPositionType },
      options: { showContent: true },
    },
    { enabled: !!account && RAIN.packageId !== "0x0" },
  );

  const positions: OwnedLoanPosition[] = [];
  if (data?.data) {
    for (const obj of data.data) {
      const d = obj.data;
      if (d?.objectId && d.content) {
        positions.push({ objectId: d.objectId, ...parseLoanFields(d.content) });
      }
    }
  }

  return { positions, isPending, error, refetch };
}
