"use client";

import { useCallback } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { RAIN, SUI_CLOCK } from "@/lib/rain";

const DEFAULT_LIQUIDATION_THRESHOLD_BPS = 8000; // 80%
const DAYS_TO_SECS = 86_400;

/* ------------------------------------------------------------------ */
/*  Vault helpers (existing)                                          */
/* ------------------------------------------------------------------ */

export function useCreateVault() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();

  const createVault = useCallback(
    async (
      liquidationThresholdBps: number = DEFAULT_LIQUIDATION_THRESHOLD_BPS,
    ) => {
      const tx = new Transaction();
      tx.moveCall({
        target: RAIN.userVault.createVault,
        arguments: [tx.pure.u64(liquidationThresholdBps)],
      });
      return signAndExecute({ transaction: tx });
    },
    [signAndExecute],
  );

  return { createVault, isPending };
}

export function useDeposit() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();

  const deposit = useCallback(
    async (
      userVaultId: string,
      custodyVaultId: string,
      amountMist: string,
    ) => {
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
      return signAndExecute({ transaction: tx });
    },
    [signAndExecute],
  );

  return { deposit, isPending };
}

/* ------------------------------------------------------------------ */
/*  Marketplace: submit borrow order                                  */
/* ------------------------------------------------------------------ */

export function useSubmitBorrowOrder() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();

  /**
   * Creates a BorrowOrder then submits it to the shared LendingMarketplace.
   * Two Move calls in one PTB:
   *   1. marketplace::create_borrow_order  -> BorrowOrder
   *   2. marketplace::submit_borrow_order(marketplace, vault, order)
   */
  const submitBorrowOrder = useCallback(
    async (
      userVaultId: string,
      amountUsdc: number,
      maxInterestBps: number,
      durationDays: number,
    ) => {
      const tx = new Transaction();

      // 1. create the order object
      const order = tx.moveCall({
        target: RAIN.marketplace.createBorrowOrder,
        arguments: [
          tx.pure.id(userVaultId),
          tx.pure.u64(amountUsdc),
          tx.pure.u64(maxInterestBps),
          tx.pure.u64(durationDays * DAYS_TO_SECS),
        ],
      });

      // 2. submit it to the shared marketplace
      tx.moveCall({
        target: RAIN.marketplace.submitBorrowOrder,
        arguments: [
          tx.object(RAIN.marketplaceId),
          tx.object(userVaultId),
          order,
        ],
      });

      return signAndExecute({ transaction: tx });
    },
    [signAndExecute],
  );

  return { submitBorrowOrder, isPending };
}

/* ------------------------------------------------------------------ */
/*  Marketplace: submit lend order                                    */
/* ------------------------------------------------------------------ */

export function useSubmitLendOrder() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();

  /**
   * Creates a LendOrder then submits it to the shared LendingMarketplace.
   */
  const submitLendOrder = useCallback(
    async (
      amountUsdc: number,
      minInterestBps: number,
      durationDays: number,
    ) => {
      const tx = new Transaction();

      const order = tx.moveCall({
        target: RAIN.marketplace.createLendOrder,
        arguments: [
          tx.pure.u64(amountUsdc),
          tx.pure.u64(minInterestBps),
          tx.pure.u64(durationDays * DAYS_TO_SECS),
        ],
      });

      tx.moveCall({
        target: RAIN.marketplace.submitLendOrder,
        arguments: [tx.object(RAIN.marketplaceId), order],
      });

      return signAndExecute({ transaction: tx });
    },
    [signAndExecute],
  );

  return { submitLendOrder, isPending };
}

/* ------------------------------------------------------------------ */
/*  Marketplace: repay a loan position                                */
/* ------------------------------------------------------------------ */

export function useRepayPosition() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();

  /**
   * Repays a LoanPosition. The coin type T must match the loan's asset.
   * For SUI-collateralised USDC loans, T is SUI (0x2::sui::SUI).
   *
   * The caller passes:
   *   - userVaultId: the borrower's UserVault
   *   - loanPositionId: the LoanPosition object (owned by borrower)
   *   - repayAmountMist: amount of SUI (in MIST) to repay
   */
  const repayPosition = useCallback(
    async (
      userVaultId: string,
      loanPositionId: string,
      repayAmountMist: string,
    ) => {
      const tx = new Transaction();

      const coin = tx.splitCoins(tx.gas, [tx.pure.u64(repayAmountMist)]);

      tx.moveCall({
        target: RAIN.marketplace.repayPosition,
        typeArguments: ["0x2::sui::SUI"],
        arguments: [
          tx.object(userVaultId),
          tx.object(loanPositionId),
          coin,
        ],
      });

      return signAndExecute({ transaction: tx });
    },
    [signAndExecute],
  );

  return { repayPosition, isPending };
}

/* ------------------------------------------------------------------ */
/*  Liquidation: liquidate an under-collateralised vault              */
/* ------------------------------------------------------------------ */

export function useLiquidate() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();

  /**
   * Liquidates a vault whose LTV exceeds the threshold.
   * Requires Pyth price feed objects.
   *
   *   - userVaultId + custodyVaultId: the target vault
   *   - priceFeedId: Pyth price feed ID bytes (hex string without 0x)
   *   - priceInfoObjectId: the Sui object holding the Pyth price
   *   - maxAgeSecs: max staleness for the oracle price (e.g. 60)
   */
  const liquidate = useCallback(
    async (
      userVaultId: string,
      custodyVaultId: string,
      priceFeedId: string,
      priceInfoObjectId: string,
      maxAgeSecs: number = 60,
    ) => {
      const tx = new Transaction();

      // Convert hex price feed id to bytes
      const feedBytes = Array.from(
        Buffer.from(priceFeedId.replace(/^0x/, ""), "hex"),
      );

      tx.moveCall({
        target: RAIN.liquidation.liquidate,
        arguments: [
          tx.object(userVaultId),
          tx.object(custodyVaultId),
          tx.pure.vector("u8", feedBytes),
          tx.object(priceInfoObjectId),
          tx.object(SUI_CLOCK),
          tx.pure.u64(maxAgeSecs),
        ],
      });

      return signAndExecute({ transaction: tx });
    },
    [signAndExecute],
  );

  return { liquidate, isPending };
}
