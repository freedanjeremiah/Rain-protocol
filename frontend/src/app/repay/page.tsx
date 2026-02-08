"use client";

import { useState } from "react";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import { useOwnedLoanPositions } from "@/hooks/useOwnedLoanPositions";
import { useRepayPosition } from "@/hooks/useRainTransactions";
import { toast } from "sonner";

const MIST_PER_SUI = 1_000_000_000;

export default function RepayPage() {
  const { vaults } = useOwnedVaults();
  const { positions, isPending: loadingPositions } = useOwnedLoanPositions();
  const { repayPosition, isPending } = useRepayPosition();

  const [positionId, setPositionId] = useState("");
  const [amount, setAmount] = useState("");

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
    } catch (e: unknown) {
      toast.error(`Repay failed: ${e instanceof Error ? e.message : String(e)}`);
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
            Repay principal + interest to clear vault debt. Then you can withdraw collateral.
          </p>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                Loan Position
              </label>
              {loadingPositions ? (
                <p className="text-xs text-[var(--fg-dim)]">Loading...</p>
              ) : positions.length === 0 ? (
                <p className="text-xs text-[var(--fg-dim)]">
                  No active loan positions found.
                </p>
              ) : (
                <select
                  value={positionId}
                  onChange={(e) => setPositionId(e.target.value)}
                  className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
                >
                  <option value="">Select loan</option>
                  {positions.map((p) => (
                    <option key={p.objectId} value={p.objectId}>
                      {p.objectId.slice(0, 8)}... (principal: {p.principal}, rate: {p.rateBps}bps)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedPosition && (
              <div className="pixel-border bg-[var(--panel)] p-4 text-xs space-y-1">
                <p>Principal: {selectedPosition.principal}</p>
                <p>Rate: {selectedPosition.rateBps} bps</p>
                <p>Term: {Math.floor(Number(selectedPosition.termSecs) / 86400)} days</p>
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
              disabled={isPending || !positionId}
            >
              {isPending ? "Repaying..." : "Repay"}
            </button>
          </div>
        </div>
      </WalletGate>
    </Layout>
  );
}
