"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import {
  useMarketplaceOrders,
  MarketBorrowOrder,
  MarketLendOrder,
} from "@/hooks/useMarketplaceOrders";
import { useFillOrder } from "@/hooks/useRainTransactions";
import { RAIN } from "@/lib/rain";
import { toast } from "sonner";

/** Parse Sui transaction errors into user-friendly messages */
function formatFillError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/not signed by the correct sender|owned by account.*but given owner\/signer/i.test(msg))
    return "Only the borrower can sign this fill. Connect the borrower's wallet and ensure they have the loan amount in their wallet, then try again.";
  const objIdMatch =
    msg.match(/"object_id"\s*:\s*"(0x[a-fA-F0-9]+)"/) ??
    msg.match(/notExists[^\w]*["']?(0x[a-fA-F0-9]+)["']?/);
  const objId = objIdMatch?.[1]?.toLowerCase();
  if (objId) {
    if (objId === RAIN.pyth.suiUsdPriceObjectId?.toLowerCase())
      return "Pyth price feed object not found. The ID in your env is for a different network (testnet vs mainnet). Update NEXT_PUBLIC_PYTH_SUI_USD_PRICE_OBJECT_ID for the network your wallet is connected to.";
    if (objId === RAIN.marketplaceId?.toLowerCase())
      return "Marketplace object not found. Ensure NEXT_PUBLIC_LENDING_MARKETPLACE_ID matches the network your wallet is connected to.";
    return `An object used by this transaction does not exist on this network (${objId}). It may have been deleted or the ID may be for a different network.`;
  }
  return msg;
}

export default function MarketplacePage() {
  const client = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { borrowOrders, lendOrders, isPending, error, refetch } =
    useMarketplaceOrders();
  const { fillOrder, isPending: filling } = useFillOrder();

  const [tab, setTab] = useState<"borrow" | "lend">("borrow");
  const [fillModal, setFillModal] = useState<{
    borrowOrder?: MarketBorrowOrder;
    lendOrder?: MarketLendOrder;
  } | null>(null);
  const [fillAmount, setFillAmount] = useState("");
  const [selectedLendOrderId, setSelectedLendOrderId] = useState("");
  const [selectedBorrowOrderId, setSelectedBorrowOrderId] = useState("");

  // When filling a borrow order, filter lend orders to compatible ones:
  // same durationSecs AND minInterestBps <= borrowOrder.maxInterestBps
  const compatibleLendOrders = useMemo(() => {
    if (!fillModal?.borrowOrder) return [];
    const bo = fillModal.borrowOrder;
    return lendOrders.filter(
      (lo) =>
        lo.durationSecs === bo.durationSecs &&
        Number(lo.minInterestBps) <= Number(bo.maxInterestBps) &&
        Number(lo.remaining) > 0,
    );
  }, [fillModal, lendOrders]);

  // When filling a lend order, filter borrow orders to compatible ones
  const compatibleBorrowOrders = useMemo(() => {
    if (!fillModal?.lendOrder) return [];
    const lo = fillModal.lendOrder;
    return borrowOrders.filter(
      (bo) =>
        bo.durationSecs === lo.durationSecs &&
        Number(bo.maxInterestBps) >= Number(lo.minInterestBps) &&
        Number(bo.remaining) > 0,
    );
  }, [fillModal, borrowOrders]);

  // Clamp fill amount to min(borrowRemaining, lendRemaining)
  const selectedLendOrder = lendOrders.find(
    (o) => o.objectId === selectedLendOrderId,
  );
  const selectedBorrowOrder = borrowOrders.find(
    (o) => o.objectId === selectedBorrowOrderId,
  );

  const handleFill = async () => {
    if (!fillModal) return;
    if (!fillAmount || Number(fillAmount) <= 0) {
      toast.error("Enter a fill amount.");
      return;
    }

    try {
      let borrowOrderId: string;
      let lendOrderId: string;
      let borrowerVaultId: string;
      let borrowerAddress: string;

      if (fillModal.borrowOrder) {
        if (!selectedLendOrderId) {
          toast.error("Select a lend order to match.");
          return;
        }
        borrowOrderId = fillModal.borrowOrder.objectId;
        lendOrderId = selectedLendOrderId;
        borrowerVaultId = fillModal.borrowOrder.vaultId;
        borrowerAddress = fillModal.borrowOrder.borrower;
      } else if (fillModal.lendOrder) {
        if (!selectedBorrowOrderId) {
          toast.error("Select a borrow order to match.");
          return;
        }
        const matchedBorrow = borrowOrders.find(
          (o) => o.objectId === selectedBorrowOrderId,
        );
        if (!matchedBorrow) {
          toast.error("Selected borrow order not found.");
          return;
        }
        borrowOrderId = selectedBorrowOrderId;
        lendOrderId = fillModal.lendOrder.objectId;
        borrowerVaultId = matchedBorrow.vaultId;
        borrowerAddress = matchedBorrow.borrower;
      } else {
        return;
      }

      // fill_order requires the borrower's vault; only the vault owner can pass it, so only the borrower can sign
      const signer = currentAccount?.address?.toLowerCase();
      const borrower = borrowerAddress?.toLowerCase();
      if (!signer || signer !== borrower) {
        toast.error(
          "Only the borrower can sign this fill. Connect the borrower's wallet (they must have the loan amount—e.g. sent by the lender—then click Fill order).",
        );
        return;
      }

      const vaultObj = await client.getObject({ id: borrowerVaultId });
      if (!vaultObj.data || vaultObj.error) {
        toast.error(
          "Borrower vault no longer exists. This order may be stale—try refreshing the order book.",
        );
        return;
      }

      await fillOrder(
        borrowOrderId,
        lendOrderId,
        borrowerVaultId,
        fillAmount,
      );
      toast.success("Order filled successfully!");
      closeModal();
      refetch();
    } catch (e: unknown) {
      toast.error(`Fill failed: ${formatFillError(e)}`);
    }
  };

  const closeModal = () => {
    setFillModal(null);
    setFillAmount("");
    setSelectedLendOrderId("");
    setSelectedBorrowOrderId("");
  };

  return (
    <Layout activePage="marketplace">
      <WalletGate>
        <div className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Order Book
          </h1>
          <p className="mb-4 text-xs text-[var(--fg-dim)]">
            View open borrow and lend orders. Fill orders to create loan
            positions.
          </p>

          {/* Fill path banner */}
          <div className="pixel-border mb-6 bg-[var(--accent)]/5 p-4 text-xs leading-relaxed text-[var(--fg-dim)]">
            <p className="mb-1">
              <span className="font-medium text-[var(--fg)]">Direct Fill:</span>{" "}
              The borrower signs the fill transaction with their vault. They must already hold the loan amount.
            </p>
            <p>
              Need the lender to go first?{" "}
              <Link href="/escrow" className="text-[var(--accent)]">
                Escrow Fill &rarr;
              </Link>{" "}
              the lender locks funds, and the borrower completes when ready.
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              className={`pixel-btn ${tab === "borrow" ? "pixel-btn-accent" : ""}`}
              onClick={() => setTab("borrow")}
            >
              Borrow Orders ({borrowOrders.length})
            </button>
            <button
              type="button"
              className={`pixel-btn ${tab === "lend" ? "pixel-btn-accent" : ""}`}
              onClick={() => setTab("lend")}
            >
              Lend Orders ({lendOrders.length})
            </button>
            <button
              type="button"
              className="pixel-btn ml-auto"
              onClick={() => refetch()}
              disabled={isPending}
            >
              {isPending ? "Loading..." : "Refresh"}
            </button>
          </div>

          {error && (
            <p className="mb-4 text-xs text-red-400">Error: {error}</p>
          )}

          {/* Borrow Orders Table */}
          {tab === "borrow" && (
            <div className="space-y-3">
              {borrowOrders.length === 0 && !isPending && (
                <p className="text-xs text-[var(--fg-dim)]">
                  No open borrow orders.
                </p>
              )}
              {borrowOrders.map((o) => (
                <div
                  key={o.objectId}
                  className="pixel-border bg-[var(--panel)] p-4 text-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p>
                        <span className="text-[var(--fg-dim)]">ID:</span>{" "}
                        {o.objectId.slice(0, 12)}...
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">Borrower:</span>{" "}
                        {o.borrower.slice(0, 8)}...
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">Amount:</span>{" "}
                        {o.amount}{" "}
                        <span className="text-[var(--fg-dim)]">
                          (remaining: {o.remaining})
                        </span>
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">Max Rate:</span>{" "}
                        {o.maxInterestBps} bps (
                        {(Number(o.maxInterestBps) / 100).toFixed(1)}%)
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">Duration:</span>{" "}
                        {Math.floor(Number(o.durationSecs) / 86400)} days
                      </p>
                    </div>
                    <button
                      type="button"
                      className="pixel-btn pixel-btn-accent"
                      onClick={() => {
                        setFillModal({ borrowOrder: o });
                        setFillAmount(o.remaining);
                        setSelectedLendOrderId("");
                      }}
                    >
                      Fill
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lend Orders Table */}
          {tab === "lend" && (
            <div className="space-y-3">
              {lendOrders.length === 0 && !isPending && (
                <p className="text-xs text-[var(--fg-dim)]">
                  No open lend orders.
                </p>
              )}
              {lendOrders.map((o) => (
                <div
                  key={o.objectId}
                  className="pixel-border bg-[var(--panel)] p-4 text-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p>
                        <span className="text-[var(--fg-dim)]">ID:</span>{" "}
                        {o.objectId.slice(0, 12)}...
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">Lender:</span>{" "}
                        {o.lender.slice(0, 8)}...
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">Amount:</span>{" "}
                        {o.amount}{" "}
                        <span className="text-[var(--fg-dim)]">
                          (remaining: {o.remaining})
                        </span>
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">Min Rate:</span>{" "}
                        {o.minInterestBps} bps (
                        {(Number(o.minInterestBps) / 100).toFixed(1)}%)
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">Duration:</span>{" "}
                        {Math.floor(Number(o.durationSecs) / 86400)} days
                      </p>
                    </div>
                    <button
                      type="button"
                      className="pixel-btn pixel-btn-accent"
                      onClick={() => {
                        setFillModal({ lendOrder: o });
                        setFillAmount(o.remaining);
                        setSelectedBorrowOrderId("");
                      }}
                    >
                      Fill
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fill Modal */}
          {fillModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="pixel-border mx-4 w-full max-w-md bg-[var(--bg)] p-6">
                <h2 className="mb-4 text-lg uppercase tracking-wider">
                  Fill Order
                </h2>
                <p className="mb-2 text-xs text-[var(--fg-dim)]">
                  The borrower must sign this transaction (they need the loan amount in their wallet; the lender can send it first).
                </p>
                <div className="mb-4 text-xs text-[var(--fg-dim)]">
                  {fillModal.borrowOrder && (
                    <p>
                      Filling borrow order{" "}
                      {fillModal.borrowOrder.objectId.slice(0, 12)}... (max
                      remaining: {fillModal.borrowOrder.remaining}, max rate:{" "}
                      {fillModal.borrowOrder.maxInterestBps} bps,{" "}
                      {Math.floor(
                        Number(fillModal.borrowOrder.durationSecs) / 86400,
                      )}
                      d)
                    </p>
                  )}
                  {fillModal.lendOrder && (
                    <p>
                      Filling lend order{" "}
                      {fillModal.lendOrder.objectId.slice(0, 12)}... (max
                      remaining: {fillModal.lendOrder.remaining}, min rate:{" "}
                      {fillModal.lendOrder.minInterestBps} bps,{" "}
                      {Math.floor(
                        Number(fillModal.lendOrder.durationSecs) / 86400,
                      )}
                      d)
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  {/* Matching order selector */}
                  {fillModal.borrowOrder && (
                    <div>
                      <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                        Select Lend Order to match
                      </label>
                      {compatibleLendOrders.length === 0 ? (
                        <p className="text-xs text-yellow-400">
                          No compatible lend orders (same duration, rate
                          &le; max).
                        </p>
                      ) : (
                        <select
                          value={selectedLendOrderId}
                          onChange={(e) => {
                            setSelectedLendOrderId(e.target.value);
                            // Clamp fill amount to min of both remaining
                            const lo = lendOrders.find(
                              (o) => o.objectId === e.target.value,
                            );
                            if (lo && fillModal.borrowOrder) {
                              const clamped = Math.min(
                                Number(fillModal.borrowOrder.remaining),
                                Number(lo.remaining),
                              );
                              setFillAmount(String(clamped));
                            }
                          }}
                          className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
                        >
                          <option value="">Choose a lend order</option>
                          {compatibleLendOrders.map((lo) => (
                            <option key={lo.objectId} value={lo.objectId}>
                              {lo.objectId.slice(0, 8)}... | remaining:{" "}
                              {lo.remaining} | rate: {lo.minInterestBps}bps |{" "}
                              {Math.floor(Number(lo.durationSecs) / 86400)}d
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {fillModal.lendOrder && (
                    <div>
                      <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                        Select Borrow Order to match
                      </label>
                      {compatibleBorrowOrders.length === 0 ? (
                        <p className="text-xs text-yellow-400">
                          No compatible borrow orders (same duration, rate
                          &ge; min).
                        </p>
                      ) : (
                        <select
                          value={selectedBorrowOrderId}
                          onChange={(e) => {
                            setSelectedBorrowOrderId(e.target.value);
                            const bo = borrowOrders.find(
                              (o) => o.objectId === e.target.value,
                            );
                            if (bo && fillModal.lendOrder) {
                              const clamped = Math.min(
                                Number(fillModal.lendOrder.remaining),
                                Number(bo.remaining),
                              );
                              setFillAmount(String(clamped));
                            }
                          }}
                          className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
                        >
                          <option value="">Choose a borrow order</option>
                          {compatibleBorrowOrders.map((bo) => (
                            <option key={bo.objectId} value={bo.objectId}>
                              {bo.objectId.slice(0, 8)}... | remaining:{" "}
                              {bo.remaining} | max rate:{" "}
                              {bo.maxInterestBps}bps |{" "}
                              {Math.floor(Number(bo.durationSecs) / 86400)}d
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Selected match details */}
                  {fillModal.borrowOrder && selectedLendOrder && (
                    <div className="pixel-border bg-[var(--panel)] p-3 text-xs space-y-0.5">
                      <p className="text-[var(--fg-dim)]">Matched lend order:</p>
                      <p>Remaining: {selectedLendOrder.remaining}</p>
                      <p>
                        Rate: {selectedLendOrder.minInterestBps} bps (
                        {(Number(selectedLendOrder.minInterestBps) / 100).toFixed(1)}
                        %)
                      </p>
                    </div>
                  )}
                  {fillModal.lendOrder && selectedBorrowOrder && (
                    <div className="pixel-border bg-[var(--panel)] p-3 text-xs space-y-0.5">
                      <p className="text-[var(--fg-dim)]">Matched borrow order:</p>
                      <p>Remaining: {selectedBorrowOrder.remaining}</p>
                      <p>
                        Max rate: {selectedBorrowOrder.maxInterestBps} bps (
                        {(Number(selectedBorrowOrder.maxInterestBps) / 100).toFixed(1)}
                        %)
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                      Fill Amount
                    </label>
                    <input
                      type="text"
                      value={fillAmount}
                      onChange={(e) => setFillAmount(e.target.value)}
                      className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
                    />
                  </div>

                  {!RAIN.pyth.suiUsdPriceObjectId && (
                    <p className="text-xs text-red-400">
                      Set NEXT_PUBLIC_PYTH_SUI_USD_PRICE_OBJECT_ID in .env to
                      enable Fill.
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="pixel-btn pixel-btn-accent"
                      onClick={handleFill}
                      disabled={filling || !RAIN.pyth.suiUsdPriceObjectId}
                    >
                      {filling ? "Filling..." : "Confirm Fill"}
                    </button>
                    <button
                      type="button"
                      className="pixel-btn"
                      onClick={closeModal}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </WalletGate>
    </Layout>
  );
}
