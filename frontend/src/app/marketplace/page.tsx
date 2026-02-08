"use client";

import { useState } from "react";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import {
  useMarketplaceOrders,
  MarketBorrowOrder,
  MarketLendOrder,
} from "@/hooks/useMarketplaceOrders";
import { useFillOrder } from "@/hooks/useRainTransactions";
import { toast } from "sonner";

const DEFAULT_PRICE_FEED =
  "50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266";

export default function MarketplacePage() {
  const { borrowOrders, lendOrders, isPending, error, refetch } =
    useMarketplaceOrders();
  const { fillOrder, isPending: filling } = useFillOrder();

  const [tab, setTab] = useState<"borrow" | "lend">("borrow");
  const [fillModal, setFillModal] = useState<{
    borrowOrder?: MarketBorrowOrder;
    lendOrder?: MarketLendOrder;
  } | null>(null);
  const [fillAmount, setFillAmount] = useState("");
  const [matchOrderId, setMatchOrderId] = useState("");
  const [priceInfoObjectId, setPriceInfoObjectId] = useState("");

  const handleFill = async () => {
    if (!fillModal) return;
    if (!fillAmount || Number(fillAmount) <= 0) {
      toast.error("Enter a fill amount.");
      return;
    }
    if (!matchOrderId) {
      toast.error("Enter the matching order ID.");
      return;
    }
    if (!priceInfoObjectId) {
      toast.error("Enter PriceInfoObject ID for the oracle.");
      return;
    }

    try {
      let borrowOrderId: string;
      let lendOrderId: string;
      let borrowerVaultId: string;

      if (fillModal.borrowOrder) {
        // Filling a borrow order: caller is lender, needs a matching lend order
        borrowOrderId = fillModal.borrowOrder.objectId;
        lendOrderId = matchOrderId;
        borrowerVaultId = fillModal.borrowOrder.vaultId;
      } else if (fillModal.lendOrder) {
        // Filling a lend order: caller is borrower, needs a matching borrow order
        borrowOrderId = matchOrderId;
        lendOrderId = fillModal.lendOrder.objectId;
        borrowerVaultId = ""; // will be provided via matchOrderId's vault
        toast.error(
          "To fill a lend order, select a borrow order to match against.",
        );
        return;
      } else {
        return;
      }

      await fillOrder(
        borrowOrderId,
        lendOrderId,
        borrowerVaultId,
        fillAmount,
        DEFAULT_PRICE_FEED,
        priceInfoObjectId,
      );
      toast.success("Order filled successfully!");
      setFillModal(null);
      setFillAmount("");
      setMatchOrderId("");
      refetch();
    } catch (e: unknown) {
      toast.error(
        `Fill failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <Layout activePage="marketplace">
      <WalletGate>
        <div className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Order Book
          </h1>
          <p className="mb-6 text-xs text-[var(--fg-dim)]">
            View open borrow and lend orders. Fill orders to create loan
            positions.
          </p>

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
              onClick={refetch}
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
                <div className="mb-4 text-xs text-[var(--fg-dim)]">
                  {fillModal.borrowOrder && (
                    <p>
                      Filling borrow order{" "}
                      {fillModal.borrowOrder.objectId.slice(0, 12)}... (max
                      remaining: {fillModal.borrowOrder.remaining})
                    </p>
                  )}
                  {fillModal.lendOrder && (
                    <p>
                      Filling lend order{" "}
                      {fillModal.lendOrder.objectId.slice(0, 12)}... (max
                      remaining: {fillModal.lendOrder.remaining})
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                      {fillModal.borrowOrder
                        ? "Your Lend Order ID (to match)"
                        : "Borrow Order ID (to match)"}
                    </label>
                    <input
                      type="text"
                      value={matchOrderId}
                      onChange={(e) => setMatchOrderId(e.target.value)}
                      placeholder="0x..."
                      className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
                    />
                  </div>
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
                  <div>
                    <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                      PriceInfoObject ID (Pyth oracle)
                    </label>
                    <input
                      type="text"
                      value={priceInfoObjectId}
                      onChange={(e) => setPriceInfoObjectId(e.target.value)}
                      placeholder="0x..."
                      className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="pixel-btn pixel-btn-accent"
                      onClick={handleFill}
                      disabled={filling}
                    >
                      {filling ? "Filling..." : "Confirm Fill"}
                    </button>
                    <button
                      type="button"
                      className="pixel-btn"
                      onClick={() => {
                        setFillModal(null);
                        setFillAmount("");
                        setMatchOrderId("");
                      }}
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
