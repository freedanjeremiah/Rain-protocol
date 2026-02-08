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

/* ------------------------------------------------------------------ */
/*  Marketplace: fill order (match borrow + lend)                     */
/* ------------------------------------------------------------------ */

export function useFillOrder() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();

  /**
   * Fills a borrow order with a lend order. The caller (lender) provides
   * the coin to fund the loan.
   *
   *   - borrowOrderId: the BorrowOrder ID in the marketplace
   *   - lendOrderId: the LendOrder ID in the marketplace
   *   - borrowerVaultId: the borrower's UserVault object
   *   - fillAmount: amount to fill (in base units)
   *   - priceFeedId: Pyth price feed hex string (no 0x prefix)
   *   - priceInfoObjectId: the Sui object for the Pyth price
   *   - maxAgeSecs: max oracle staleness
   */
  const fillOrder = useCallback(
    async (
      borrowOrderId: string,
      lendOrderId: string,
      borrowerVaultId: string,
      fillAmount: string,
      priceFeedId: string,
      priceInfoObjectId: string,
      maxAgeSecs: number = 60,
    ) => {
      const tx = new Transaction();

      const coin = tx.splitCoins(tx.gas, [tx.pure.u64(fillAmount)]);
      const feedBytes = Array.from(
        Buffer.from(priceFeedId.replace(/^0x/, ""), "hex"),
      );

      tx.moveCall({
        target: RAIN.marketplace.fillOrder,
        typeArguments: ["0x2::sui::SUI"],
        arguments: [
          tx.object(RAIN.marketplaceId),
          tx.pure.id(borrowOrderId),
          tx.pure.id(lendOrderId),
          tx.pure.u64(fillAmount),
          coin,
          tx.object(borrowerVaultId),
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

  return { fillOrder, isPending };
}

/* ------------------------------------------------------------------ */
/*  Withdraw: Step 1 - request repayment auth (debt must be 0)        */
/* ------------------------------------------------------------------ */

export function useRequestRepaymentAuth() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();

  const requestAuth = useCallback(
    async (userVaultId: string) => {
      const tx = new Transaction();
      tx.moveCall({
        target: RAIN.userVault.requestRepaymentAuth,
        arguments: [tx.object(userVaultId)],
      });
      return signAndExecute({ transaction: tx });
    },
    [signAndExecute],
  );

  return { requestAuth, isPending };
}

/* ------------------------------------------------------------------ */
/*  Withdraw: Step 2 - release collateral to owner                    */
/* ------------------------------------------------------------------ */

export function useReleaseToOwner() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();

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
      return signAndExecute({ transaction: tx });
    },
    [signAndExecute],
  );

  return { releaseToOwner, isPending };
}

/* ------------------------------------------------------------------ */
/*  Liquidation: liquidate an under-collateralised vault              */
/* ------------------------------------------------------------------ */

/**
 * Step 2 of liquidation: sell collateral on DeepBook and settle.
 * Call after liquidate() returns the collateral Coin<SUI> to the liquidator.
 *
 * The liquidator passes:
 *   - userVaultId: the target borrower's UserVault (to reduce debt)
 *   - collateralCoinId: the Coin<SUI> received from step 1
 *   - deepCoinId: a Coin<DEEP> for DeepBook taker fees
 *   - minQuoteOut: minimum DBUSDC to receive from the swap
 *   - liquidatorBonusBps: bonus for the liquidator (e.g. 500 = 5%)
 */
export function useSellCollateralAndSettle() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();

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

      return signAndExecute({ transaction: tx });
    },
    [signAndExecute],
  );

  return { sellAndSettle, isPending };
}

/* ------------------------------------------------------------------ */
/*  Transfer a LoanPosition (lender → borrower for repayment)         */
/* ------------------------------------------------------------------ */

export function useTransferPosition() {
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();

  const transferPosition = useCallback(
    async (loanPositionId: string, recipientAddress: string) => {
      const tx = new Transaction();
      tx.transferObjects(
        [tx.object(loanPositionId)],
        tx.pure.address(recipientAddress),
      );
      return signAndExecute({ transaction: tx });
    },
    [signAndExecute],
  );

  return { transferPosition, isPending };
}

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
