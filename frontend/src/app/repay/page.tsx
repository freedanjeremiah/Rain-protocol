"use client";

import { useState } from "react";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import {
  useOwnedLoanPositions,
  OwnedLoanPosition,
} from "@/hooks/useOwnedLoanPositions";
import {
  useRepayPosition,
  useTransferPosition,
} from "@/hooks/useRainTransactions";
import { toast } from "sonner";

const MIST_PER_SUI = 1_000_000_000;

export default function RepayPage() {
  const account = useCurrentAccount();
  const { vaults } = useOwnedVaults();
  const { positions, isPending: loadingPositions, refetch } =
    useOwnedLoanPositions();
  const { repayPosition, isPending: repaying } = useRepayPosition();
  const { transferPosition, isPending: transferring } = useTransferPosition();

  const [tab, setTab] = useState<"borrower" | "lender">("borrower");
  const [positionId, setPositionId] = useState("");
  const [amount, setAmount] = useState("");
  const [transferTarget, setTransferTarget] = useState("");

  const myAddress = account?.address ?? "";

  // Positions where I am the borrower (I can repay these)
  const borrowerPositions = positions.filter(
    (p) => p.borrower === myAddress,
  );
  // Positions where I am the lender (I should transfer these to borrower for repayment)
  const lenderPositions = positions.filter(
    (p) => p.lender === myAddress,
  );

  const selectedPosition = positions.find((p) => p.objectId === positionId);
  const matchingVault = selectedPosition
    ? vaults.find((v) => v.objectId === selectedPosition.vaultId)
    : undefined;

  const handleRepay = async () => {
    if (!positionId) {
      toast.error("Select a loan position.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter repay amount.");
      return;
    }
    if (!selectedPosition) {
      toast.error("Loan position not found.");
      return;
    }
    const vaultId = selectedPosition.vaultId;
    if (!vaultId) {
      toast.error("Cannot determine vault for this position.");
      return;
    }

    try {
      const amountMist = String(
        Math.floor(Number(amount) * MIST_PER_SUI),
      );
      await repayPosition(vaultId, positionId, amountMist);
      toast.success("Repayment successful!");
      setAmount("");
      setPositionId("");
      refetch();
    } catch (e: unknown) {
      toast.error(
        `Repay failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const handleTransfer = async (position: OwnedLoanPosition) => {
    const recipient = transferTarget.trim() || position.borrower;
    if (!recipient) {
      toast.error("No borrower address to transfer to.");
      return;
    }
    try {
      await transferPosition(position.objectId, recipient);
      toast.success(
        `Position transferred to ${recipient.slice(0, 8)}...`,
      );
      setTransferTarget("");
      refetch();
    } catch (e: unknown) {
      toast.error(
        `Transfer failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <Layout activePage="repay">
      <WalletGate>
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Repay
          </h1>
          <p className="mb-6 text-xs text-[var(--fg-dim)]">
            Repay principal to clear vault debt. The lender holds the
            LoanPosition after a fill; they must transfer it to the borrower
            first.
          </p>

          {/* Tabs */}
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              className={`pixel-btn ${tab === "borrower" ? "pixel-btn-accent" : ""}`}
              onClick={() => {
                setTab("borrower");
                setPositionId("");
              }}
            >
              My Loans ({borrowerPositions.length})
            </button>
            <button
              type="button"
              className={`pixel-btn ${tab === "lender" ? "pixel-btn-accent" : ""}`}
              onClick={() => {
                setTab("lender");
                setPositionId("");
              }}
            >
              Positions I Hold ({lenderPositions.length})
            </button>
          </div>

          {/* --- Borrower tab: repay --- */}
          {tab === "borrower" && (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                  Loan Position
                </label>
                {loadingPositions ? (
                  <p className="text-xs text-[var(--fg-dim)]">Loading...</p>
                ) : borrowerPositions.length === 0 ? (
                  <p className="text-xs text-[var(--fg-dim)]">
                    No loan positions found. If you have an active loan, the
                    lender must transfer the position to you first.
                  </p>
                ) : (
                  <select
                    value={positionId}
                    onChange={(e) => setPositionId(e.target.value)}
                    className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
                  >
                    <option value="">Select loan</option>
                    {borrowerPositions.map((p) => (
                      <option key={p.objectId} value={p.objectId}>
                        {p.objectId.slice(0, 8)}... (principal:{" "}
                        {p.principal}, rate: {p.rateBps}bps)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedPosition && (
                <div className="pixel-border space-y-1 bg-[var(--panel)] p-4 text-xs">
                  <p>Principal: {selectedPosition.principal}</p>
                  <p>Rate: {selectedPosition.rateBps} bps</p>
                  <p>
                    Term:{" "}
                    {Math.floor(
                      Number(selectedPosition.termSecs) / 86400,
                    )}{" "}
                    days
                  </p>
                  <p>
                    Lender: {selectedPosition.lender.slice(0, 10)}...
                  </p>
                  {matchingVault && (
                    <p>Vault collateral: {matchingVault.balance} MIST</p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                  Amount (SUI)
                </label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
                />
              </div>
              <button
                type="button"
                className="pixel-btn pixel-btn-accent"
                onClick={handleRepay}
                disabled={repaying || !positionId}
              >
                {repaying ? "Repaying..." : "Repay"}
              </button>
            </div>
          )}

          {/* --- Lender tab: transfer positions to borrower --- */}
          {tab === "lender" && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--fg-dim)]">
                As the lender, you hold the LoanPosition after filling an
                order. Transfer it to the borrower so they can repay.
              </p>

              {loadingPositions ? (
                <p className="text-xs text-[var(--fg-dim)]">Loading...</p>
              ) : lenderPositions.length === 0 ? (
                <p className="text-xs text-[var(--fg-dim)]">
                  You don&apos;t hold any loan positions as lender.
                </p>
              ) : (
                lenderPositions.map((p) => (
                  <div
                    key={p.objectId}
                    className="pixel-border bg-[var(--panel)] p-4 text-xs"
                  >
                    <div className="space-y-1">
                      <p>
                        <span className="text-[var(--fg-dim)]">
                          Position:
                        </span>{" "}
                        {p.objectId.slice(0, 12)}...
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">
                          Borrower:
                        </span>{" "}
                        {p.borrower.slice(0, 10)}...
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">
                          Principal:
                        </span>{" "}
                        {p.principal}
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">Rate:</span>{" "}
                        {p.rateBps} bps
                      </p>
                      <p>
                        <span className="text-[var(--fg-dim)]">Term:</span>{" "}
                        {Math.floor(Number(p.termSecs) / 86400)} days
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={transferTarget}
                        onChange={(e) => setTransferTarget(e.target.value)}
                        placeholder={`Default: ${p.borrower.slice(0, 10)}...`}
                        className="pixel-border flex-1 bg-[var(--bg)] px-2 py-1 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
                      />
                      <button
                        type="button"
                        className="pixel-btn pixel-btn-accent"
                        onClick={() => handleTransfer(p)}
                        disabled={transferring}
                      >
                        {transferring ? "..." : "Transfer to Borrower"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </WalletGate>
    </Layout>
  );
}
