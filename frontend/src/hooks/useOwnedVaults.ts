"use client";

import { useSuiClientQuery, useCurrentAccount } from "@mysten/dapp-kit";
import { RAIN } from "@/lib/rain";

export interface OwnedVault {
  objectId: string;
  custodyId: string;
  balance: string;
  debt: string;
  liquidationThresholdBps: string;
  owner?: string;
}

function parseUserVaultFields(content: unknown): Omit<OwnedVault, "objectId"> {
  const defaultFields = {
    custodyId: "",
    balance: "0",
    debt: "0",
    liquidationThresholdBps: "8000",
  };
  if (!content || typeof content !== "object") return defaultFields;
  const c = content as Record<string, unknown>;
  const fields = c.fields as Record<string, unknown> | undefined;
  if (!fields) return defaultFields;

  const custodyId =
    typeof fields.custody_id === "string"
      ? fields.custody_id
      : (fields.custody_id as Record<string, unknown>)?.id
        ? String((fields.custody_id as Record<string, string>).id)
        : "";
  const balance =
    typeof fields.collateral_balance === "string"
      ? fields.collateral_balance
      : String(fields.collateral_balance ?? "0");
  const debt =
    typeof fields.debt === "string" ? fields.debt : String(fields.debt ?? "0");
  const liquidationThresholdBps =
    typeof fields.liquidation_threshold_bps === "string"
      ? fields.liquidation_threshold_bps
      : String(fields.liquidation_threshold_bps ?? "8000");

  return {
    custodyId,
    balance,
    debt,
    liquidationThresholdBps,
  };
}

export function useOwnedVaults() {
  const account = useCurrentAccount();
  const { data, isPending, error, refetch } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      filter: { StructType: RAIN.userVault.type },
      options: { showContent: true, showOwner: true },
    },
    { enabled: !!account && RAIN.packageId !== "0x0" },
  );

  const vaults: OwnedVault[] = [];
  if (data?.data) {
    for (const obj of data.data) {
      const d = obj.data;
      if (d?.objectId && d.content) {
        const parsed = parseUserVaultFields(d.content);
        vaults.push({
          objectId: d.objectId,
          ...parsed,
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
