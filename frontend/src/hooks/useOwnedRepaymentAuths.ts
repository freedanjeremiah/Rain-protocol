"use client";

import { useSuiClientQuery, useCurrentAccount } from "@mysten/dapp-kit";
import { RAIN } from "@/lib/rain";

export interface OwnedRepaymentAuth {
  objectId: string;
  vaultId: string;
}

function parseAuthFields(content: unknown): { vaultId: string } {
  if (!content || typeof content !== "object") return { vaultId: "" };
  const c = content as Record<string, unknown>;
  const fields = c.fields as Record<string, unknown> | undefined;
  if (!fields) return { vaultId: "" };
  const vaultId =
    typeof fields.vault_id === "string"
      ? fields.vault_id
      : String(
          (fields.vault_id as Record<string, string>)?.id ?? "",
        );
  return { vaultId };
}

export function useOwnedRepaymentAuths() {
  const account = useCurrentAccount();
  const { data, isPending, error, refetch } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      filter: { StructType: RAIN.adjudicator.repaymentAuthType },
      options: { showContent: true },
    },
    { enabled: !!account && RAIN.packageId !== "0x0" },
  );

  const auths: OwnedRepaymentAuth[] = [];
  if (data?.data) {
    for (const obj of data.data) {
      const d = obj.data;
      if (d?.objectId && d.content) {
        const parsed = parseAuthFields(d.content);
        auths.push({ objectId: d.objectId, ...parsed });
      }
    }
  }

  return { auths, isPending, error, refetch };
}
