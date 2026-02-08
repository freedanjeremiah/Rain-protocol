"use client";

import { useState } from "react";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import {
  useLenderCommitFill,
  useBorrowerCompleteFill,
  useLenderCancelFill,
} from "@/hooks/useRainTransactions";
import {
  useActiveFillRequests,
  FillRequestData,
} from "@/hooks/useActiveFillRequests";
import { useMarketplaceOrders } from "@/hooks/useMarketplaceOrders";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { toast } from "sonner";

type Tab = "commit" | "complete" | "requests";

function statusLabel(status: number): string {
  if (status === 0) return "PENDING";
  if (status === 1) return "COMPLETED";
  if (status === 2) return "CANCELLED";
  return `UNKNOWN(${status})`;
}

function isExpired(req: FillRequestData): boolean {
  return Date.now() >= Number(req.expiryMs);
}

export default function EscrowPage() {
  const [tab, setTab] = useState<Tab>("commit");
  const account = useCurrentAccount();

  return (
    <Layout activePage="escrow">
      <WalletGate>
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Escrow Fill
          </h1>

          {/* Tab selector */}
          <div className="mb-6 flex gap-2">
            {(["commit", "complete", "requests"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`pixel-btn ${tab === t ? "pixel-btn-accent" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "commit"
                  ? "Commit Fill"
                  : t === "complete"
                    ? "Complete Fill"
                    : "My Requests"}
              </button>
            ))}
          </div>

          {tab === "commit" && <CommitTab />}
          {tab === "complete" && (
            <CompleteTab userAddress={account?.address ?? ""} />
          )}
          {tab === "requests" && (
            <RequestsTab userAddress={account?.address ?? ""} />
          )}
        </div>
      </WalletGate>
    </Layout>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 1: Lender Commit Fill                                         */
/* ------------------------------------------------------------------ */

function CommitTab() {
  const { commitFill, isPending } = useLenderCommitFill();
  const {
    borrowOrders,
    lendOrders,
    isPending: loadingOrders,
    refetch,
  } = useMarketplaceOrders();

  const [selectedBorrow, setSelectedBorrow] = useState("");
  const [selectedLend, setSelectedLend] = useState("");
  const [fillAmount, setFillAmount] = useState("");
  const [expirySecs, setExpirySecs] = useState("300");

  const handleCommit = async () => {
    if (!selectedBorrow || !selectedLend || !fillAmount) {
      toast.error("Select both orders and enter fill amount.");
      return;
    }
    try {
      await commitFill(
        selectedBorrow,
        selectedLend,
        fillAmount,
        Number(expirySecs),
      );
      toast.success("Fill committed! Funds locked in escrow.");
      setFillAmount("");
    } catch (e: unknown) {
      toast.error(
        `Commit failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--fg-dim)]">
        As a lender, lock funds in escrow for a borrow order. The borrower can
        then complete the fill at their convenience.
      </p>

      <div>
        <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
          Borrow Order
        </label>
        {loadingOrders ? (
          <p className="text-xs text-[var(--fg-dim)]">Loading orders...</p>
        ) : borrowOrders.length === 0 ? (
          <p className="text-xs text-[var(--fg-dim)]">No open borrow orders</p>
        ) : (
          <select
            value={selectedBorrow}
            onChange={(e) => setSelectedBorrow(e.target.value)}
            className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
          >
            <option value="">-- select --</option>
            {borrowOrders.map((o) => (
              <option key={o.objectId} value={o.objectId}>
                {o.objectId.slice(0, 10)}... | {o.remaining} remaining |{" "}
                {Number(o.maxInterestBps) / 100}% max
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
          Your Lend Order
        </label>
        {lendOrders.length === 0 ? (
          <p className="text-xs text-[var(--fg-dim)]">No open lend orders</p>
        ) : (
          <select
            value={selectedLend}
            onChange={(e) => setSelectedLend(e.target.value)}
            className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
          >
            <option value="">-- select --</option>
            {lendOrders.map((o) => (
              <option key={o.objectId} value={o.objectId}>
                {o.objectId.slice(0, 10)}... | {o.remaining} remaining |{" "}
                {Number(o.minInterestBps) / 100}% min
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
          Fill Amount (MIST)
        </label>
        <input
          type="text"
          value={fillAmount}
          onChange={(e) => setFillAmount(e.target.value)}
          placeholder="e.g. 1000000000"
          className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
          Expiry (seconds)
        </label>
        <input
          type="text"
          value={expirySecs}
          onChange={(e) => setExpirySecs(e.target.value)}
          className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="pixel-btn pixel-btn-accent"
          onClick={handleCommit}
          disabled={isPending}
        >
          {isPending ? "Committing..." : "Commit Fill"}
        </button>
        <button
          type="button"
          className="pixel-btn"
          onClick={refetch}
          disabled={loadingOrders}
        >
          Refresh Orders
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 2: Borrower Complete Fill                                     */
/* ------------------------------------------------------------------ */

function CompleteTab({ userAddress }: { userAddress: string }) {
  const { completeFill, isPending } = useBorrowerCompleteFill();
  const { requests, isPending: loadingReqs, refetch } = useActiveFillRequests();

  const pendingForMe = requests.filter(
    (r) => r.status === 0 && r.borrower === userAddress && !isExpired(r),
  );

  const handleComplete = async (req: FillRequestData) => {
    try {
      await completeFill(req.objectId, req.vaultId);
      toast.success("Fill completed! Loan position created.");
      refetch();
    } catch (e: unknown) {
      toast.error(
        `Complete failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--fg-dim)]">
        As a borrower, complete pending fill requests to receive the loan
        principal. Your vault will be checked against the oracle price.
      </p>

      {loadingReqs ? (
        <p className="text-xs text-[var(--fg-dim)]">Loading fill requests...</p>
      ) : pendingForMe.length === 0 ? (
        <p className="text-xs text-[var(--fg-dim)]">
          No pending fill requests for you.
        </p>
      ) : (
        <div className="space-y-3">
          {pendingForMe.map((r) => (
            <div
              key={r.objectId}
              className="pixel-border bg-[var(--panel)] p-3 text-xs"
            >
              <div className="space-y-0.5">
                <p>
                  <span className="text-[var(--fg-dim)]">Request:</span>{" "}
                  {r.objectId.slice(0, 14)}...
                </p>
                <p>
                  <span className="text-[var(--fg-dim)]">Amount:</span>{" "}
                  {r.fillAmount} MIST
                </p>
                <p>
                  <span className="text-[var(--fg-dim)]">Lender:</span>{" "}
                  {r.lender.slice(0, 10)}...
                </p>
                <p>
                  <span className="text-[var(--fg-dim)]">Vault:</span>{" "}
                  {r.vaultId.slice(0, 14)}...
                </p>
                <p>
                  <span className="text-[var(--fg-dim)]">Expires:</span>{" "}
                  {new Date(Number(r.expiryMs)).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                className="pixel-btn pixel-btn-accent mt-2"
                onClick={() => handleComplete(r)}
                disabled={isPending}
              >
                {isPending ? "Completing..." : "Complete Fill"}
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="pixel-btn"
        onClick={refetch}
        disabled={loadingReqs}
      >
        Refresh
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 3: My Requests (lender view — cancel expired)                 */
/* ------------------------------------------------------------------ */

function RequestsTab({ userAddress }: { userAddress: string }) {
  const { cancelFill, isPending: cancelling } = useLenderCancelFill();
  const { requests, isPending: loadingReqs, refetch } = useActiveFillRequests();

  const myRequests = requests.filter(
    (r) => r.lender === userAddress || r.borrower === userAddress,
  );

  const handleCancel = async (req: FillRequestData) => {
    try {
      await cancelFill(req.objectId);
      toast.success("Fill request cancelled. Funds returned.");
      refetch();
    } catch (e: unknown) {
      toast.error(
        `Cancel failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--fg-dim)]">
        View all fill requests where you are the lender or borrower. Cancel
        expired pending requests to reclaim funds.
      </p>

      {loadingReqs ? (
        <p className="text-xs text-[var(--fg-dim)]">Loading...</p>
      ) : myRequests.length === 0 ? (
        <p className="text-xs text-[var(--fg-dim)]">No fill requests found.</p>
      ) : (
        <div className="space-y-3">
          {myRequests.map((r) => {
            const expired = isExpired(r);
            const canCancel =
              r.status === 0 && expired && r.lender === userAddress;

            return (
              <div
                key={r.objectId}
                className={`pixel-border p-3 text-xs ${
                  r.status === 0
                    ? expired
                      ? "border-yellow-500/50 bg-yellow-500/10"
                      : "bg-[var(--panel)]"
                    : r.status === 1
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-red-500/30 bg-red-500/5"
                }`}
              >
                <div className="space-y-0.5">
                  <p>
                    <span className="text-[var(--fg-dim)]">Request:</span>{" "}
                    {r.objectId.slice(0, 14)}...
                  </p>
                  <p>
                    <span className="text-[var(--fg-dim)]">Status:</span>{" "}
                    {statusLabel(r.status)}
                    {r.status === 0 && expired && " (EXPIRED)"}
                  </p>
                  <p>
                    <span className="text-[var(--fg-dim)]">Amount:</span>{" "}
                    {r.fillAmount} MIST
                  </p>
                  <p>
                    <span className="text-[var(--fg-dim)]">Locked:</span>{" "}
                    {r.lockedAmount} MIST
                  </p>
                  <p>
                    <span className="text-[var(--fg-dim)]">Role:</span>{" "}
                    {r.lender === userAddress ? "Lender" : "Borrower"}
                  </p>
                  <p>
                    <span className="text-[var(--fg-dim)]">Expires:</span>{" "}
                    {new Date(Number(r.expiryMs)).toLocaleString()}
                  </p>
                </div>
                {canCancel && (
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-accent mt-2"
                    onClick={() => handleCancel(r)}
                    disabled={cancelling}
                  >
                    {cancelling ? "Cancelling..." : "Cancel & Reclaim"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="pixel-btn"
        onClick={refetch}
        disabled={loadingReqs}
      >
        Refresh
      </button>
    </div>
  );
}
