"use client";

import { useCallback } from "react";
import { Buffer } from "buffer";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import {
  SuiPythClient,
  SuiPriceServiceConnection,
} from "@pythnetwork/pyth-sui-js";
import { RAIN, SUI_CLOCK } from "@/lib/rain";
import { useInvalidateAfterTx } from "./useRainMutation";

const DEFAULT_LIQUIDATION_THRESHOLD_BPS = 8000; // 80%
const DAYS_TO_SECS = 86_400;

/* ------------------------------------------------------------------ */
/*  Vault helpers                                                      */
/* ------------------------------------------------------------------ */

export function useCreateVault() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["ownedVaults"]);

  const createVault = useCallback(
    async (
      liquidationThresholdBps: number = DEFAULT_LIQUIDATION_THRESHOLD_BPS,
    ) => {
      const tx = new Transaction();
      tx.moveCall({
        target: RAIN.userVault.createVault,
        arguments: [tx.pure.u64(liquidationThresholdBps)],
      });
      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { createVault, isPending };
}

export function useDeposit() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["ownedVaults", "ownedCustody"]);

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
      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { deposit, isPending };
}

/* ------------------------------------------------------------------ */
/*  Marketplace: submit borrow order                                  */
/* ------------------------------------------------------------------ */

export function useSubmitBorrowOrder() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["marketplaceOrders", "ownedVaults"]);

  const submitBorrowOrder = useCallback(
    async (
      userVaultId: string,
      amountUsdc: number,
      maxInterestBps: number,
      durationDays: number,
    ) => {
      const tx = new Transaction();

      const order = tx.moveCall({
        target: RAIN.marketplace.createBorrowOrder,
        arguments: [
          tx.pure.id(userVaultId),
          tx.pure.u64(amountUsdc),
          tx.pure.u64(maxInterestBps),
          tx.pure.u64(durationDays * DAYS_TO_SECS),
        ],
      });

      tx.moveCall({
        target: RAIN.marketplace.submitBorrowOrder,
        arguments: [
          tx.object(RAIN.marketplaceId),
          tx.object(userVaultId),
          order,
        ],
      });

      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { submitBorrowOrder, isPending };
}

/* ------------------------------------------------------------------ */
/*  Marketplace: submit lend order                                    */
/* ------------------------------------------------------------------ */

export function useSubmitLendOrder() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["marketplaceOrders"]);

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

      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { submitLendOrder, isPending };
}

/* ------------------------------------------------------------------ */
/*  Marketplace: repay a loan position                                */
/* ------------------------------------------------------------------ */

export function useRepayPosition() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["ownedVaults", "ownedPositions"]);

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

      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { repayPosition, isPending };
}

/* ------------------------------------------------------------------ */
/*  Marketplace: fill order (match borrow + lend)                     */
/* ------------------------------------------------------------------ */

export function useFillOrder() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["marketplaceOrders", "ownedVaults", "ownedPositions"]);

  const fillOrder = useCallback(
    async (
      borrowOrderId: string,
      lendOrderId: string,
      borrowerVaultId: string,
      fillAmount: string,
      maxAgeSecs: number = 60,
    ) => {
      const priceObjectId = RAIN.pyth.suiUsdPriceObjectId;
      if (!priceObjectId) {
        throw new Error(
          "Set NEXT_PUBLIC_PYTH_SUI_USD_PRICE_OBJECT_ID in .env",
        );
      }

      const tx = new Transaction();
      const feedBytes = Array.from(
        Buffer.from(RAIN.pyth.suiUsdFeedId, "hex"),
      );

      tx.moveCall({
        target: RAIN.marketplace.fillOrder,
        typeArguments: ["0x2::sui::SUI"],
        arguments: [
          tx.object(RAIN.marketplaceId),
          tx.pure.id(borrowOrderId),
          tx.pure.id(lendOrderId),
          tx.pure.u64(fillAmount),
          tx.gas,
          tx.object(borrowerVaultId),
          tx.pure.vector("u8", feedBytes),
          tx.object(priceObjectId),
          tx.object(SUI_CLOCK),
          tx.pure.u64(maxAgeSecs),
        ],
      });

      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { fillOrder, isPending };
}

/* ------------------------------------------------------------------ */
/*  Withdraw: Step 1 - request repayment auth (debt must be 0)        */
/* ------------------------------------------------------------------ */

export function useRequestRepaymentAuth() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["ownedAuths"]);

  const requestAuth = useCallback(
    async (userVaultId: string) => {
      const tx = new Transaction();
      tx.moveCall({
        target: RAIN.userVault.requestRepaymentAuth,
        arguments: [tx.object(userVaultId)],
      });
      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { requestAuth, isPending };
}

/* ------------------------------------------------------------------ */
/*  Withdraw: Step 2 - release collateral to owner                    */
/* ------------------------------------------------------------------ */

export function useReleaseToOwner() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["ownedVaults", "ownedCustody", "ownedAuths"]);

  const releaseToOwner = useCallback(
    async (custodyVaultId: string, repaymentAuthId: string) => {
      const tx = new Transaction();
      tx.moveCall({
        target: RAIN.custody.releaseToOwner,
        arguments: [
          tx.object(custodyVaultId),
          tx.object(repaymentAuthId),
        ],
      });
      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { releaseToOwner, isPending };
}

/* ------------------------------------------------------------------ */
/*  Liquidation: sell collateral on DeepBook and settle                */
/* ------------------------------------------------------------------ */

export function useSellCollateralAndSettle() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["ownedVaults"]);

  const sellAndSettle = useCallback(
    async (
      userVaultId: string,
      collateralCoinId: string,
      deepCoinId: string,
      minQuoteOut: string = "0",
      liquidatorBonusBps: number = 500,
    ) => {
      const tx = new Transaction();

      tx.moveCall({
        target: RAIN.liquidation.sellCollateralAndSettle,
        typeArguments: [
          "0x2::sui::SUI",
          RAIN.deepbook.dbUsdcCoinType,
        ],
        arguments: [
          tx.object(userVaultId),
          tx.object(RAIN.deepbook.suiUsdcPoolId),
          tx.object(collateralCoinId),
          tx.object(deepCoinId),
          tx.pure.u64(minQuoteOut),
          tx.pure.u64(liquidatorBonusBps),
          tx.object(SUI_CLOCK),
        ],
      });

      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { sellAndSettle, isPending };
}

/* ------------------------------------------------------------------ */
/*  Transfer a LoanPosition (lender -> borrower for repayment)        */
/* ------------------------------------------------------------------ */

export function useTransferPosition() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["ownedPositions"]);

  const transferPosition = useCallback(
    async (loanPositionId: string, recipientAddress: string) => {
      const tx = new Transaction();
      tx.transferObjects(
        [tx.object(loanPositionId)],
        tx.pure.address(recipientAddress),
      );
      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { transferPosition, isPending };
}

/* ------------------------------------------------------------------ */
/*  Liquidation: liquidate an under-collateralised vault              */
/* ------------------------------------------------------------------ */

export function useLiquidate() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["ownedVaults"]);

  const liquidate = useCallback(
    async (
      userVaultId: string,
      custodyVaultId: string,
      priceFeedId: string,
      priceInfoObjectId: string,
      maxAgeSecs: number = 60,
    ) => {
      const tx = new Transaction();

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

      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { liquidate, isPending };
}

/* ------------------------------------------------------------------ */
/*  Escrow: lender commits funds to fill a borrow order               */
/* ------------------------------------------------------------------ */

export function useLenderCommitFill() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["fillRequests", "marketplaceOrders"]);

  const commitFill = useCallback(
    async (
      borrowOrderId: string,
      lendOrderId: string,
      fillAmount: string,
      expirySecs: number = 300,
    ) => {
      const tx = new Transaction();
      tx.moveCall({
        target: RAIN.escrow.lenderCommitFill,
        arguments: [
          tx.object(RAIN.marketplaceId),
          tx.pure.id(borrowOrderId),
          tx.pure.id(lendOrderId),
          tx.pure.u64(fillAmount),
          tx.gas,
          tx.pure.u64(expirySecs),
          tx.object(SUI_CLOCK),
        ],
      });
      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { commitFill, isPending };
}

/* ------------------------------------------------------------------ */
/*  Escrow: borrower completes a fill request                         */
/* ------------------------------------------------------------------ */

export function useBorrowerCompleteFill() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["fillRequests", "ownedVaults", "ownedPositions"]);

  const completeFill = useCallback(
    async (
      fillRequestId: string,
      borrowerVaultId: string,
      maxAgeSecs: number = 60,
    ) => {
      const priceObjectId = RAIN.pyth.suiUsdPriceObjectId;
      if (!priceObjectId) {
        throw new Error(
          "Set NEXT_PUBLIC_PYTH_SUI_USD_PRICE_OBJECT_ID in .env",
        );
      }

      const tx = new Transaction();
      const feedBytes = Array.from(
        Buffer.from(RAIN.pyth.suiUsdFeedId, "hex"),
      );

      tx.moveCall({
        target: RAIN.escrow.borrowerCompleteFill,
        arguments: [
          tx.object(RAIN.marketplaceId),
          tx.object(fillRequestId),
          tx.object(borrowerVaultId),
          tx.pure.vector("u8", feedBytes),
          tx.object(priceObjectId),
          tx.object(SUI_CLOCK),
          tx.pure.u64(maxAgeSecs),
        ],
      });
      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { completeFill, isPending };
}

/* ------------------------------------------------------------------ */
/*  Escrow: lender cancels an expired fill request                    */
/* ------------------------------------------------------------------ */

export function useLenderCancelFill() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const invalidate = useInvalidateAfterTx(["fillRequests"]);

  const cancelFill = useCallback(
    async (fillRequestId: string) => {
      const tx = new Transaction();
      tx.moveCall({
        target: RAIN.escrow.lenderCancelFill,
        arguments: [
          tx.object(fillRequestId),
          tx.object(SUI_CLOCK),
        ],
      });
      const result = await signAndExecute({ transaction: tx });
      invalidate();
      return result;
    },
    [signAndExecute, invalidate],
  );

  return { cancelFill, isPending };
}
