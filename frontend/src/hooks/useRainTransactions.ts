"use client";

import { useCallback } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { RAIN } from "@/lib/rain";

const DEFAULT_LIQUIDATION_THRESHOLD_BPS = 8000; // 80%

export function useCreateVault() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const createVault = useCallback(
    async (liquidationThresholdBps: number = DEFAULT_LIQUIDATION_THRESHOLD_BPS) => {
      const tx = new Transaction();
      tx.moveCall({
        target: RAIN.userVault.createVault,
        arguments: [tx.pure.u64(liquidationThresholdBps)],
      });
      const result = await signAndExecute({ transaction: tx });
      return result;
    },
    [signAndExecute],
  );

  return { createVault, isPending };
}

export function useDeposit() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const deposit = useCallback(
    async (userVaultId: string, custodyVaultId: string, amountMist: string) => {
      const tx = new Transaction();
      const coin = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
      tx.moveCall({
        target: RAIN.userVault.depositCollateral,
        arguments: [
          tx.object(userVaultId),
          tx.object(custodyVaultId),
          coin,
        ],
      });
      const result = await signAndExecute({ transaction: tx });
      return result;
    },
    [signAndExecute],
  );

  return { deposit, isPending };
}
