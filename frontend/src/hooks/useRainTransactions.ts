"use client";

import { useCallback } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { RAIN } from "@/lib/rain";

export function useCreateVault() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const createVault = useCallback(async () => {
    const tx = new Transaction();
    tx.moveCall({
      target: RAIN.custody.createVault,
      arguments: [],
    });
    const result = await signAndExecute({ transaction: tx });
    return result;
  }, [signAndExecute]);

  return { createVault, isPending };
}

export function useDeposit() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const deposit = useCallback(
    async (vaultId: string, amountMist: string) => {
      const tx = new Transaction();
      const coin = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
      tx.moveCall({
        target: RAIN.custody.deposit,
        arguments: [tx.object(vaultId), coin],
      });
      const result = await signAndExecute({ transaction: tx });
      return result;
    },
    [signAndExecute],
  );

  return { deposit, isPending };
}
