"use client";

import { useState } from "react";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import { useOwnedCustodyVaults } from "@/hooks/useOwnedCustodyVaults";
import { useOwnedRepaymentAuths } from "@/hooks/useOwnedRepaymentAuths";
import {
  useRequestRepaymentAuth,
  useReleaseToOwner,
} from "@/hooks/useRainTransactions";
import BorrowerStepper from "@/components/shared/BorrowerStepper";
import { toast } from "sonner";

export default function WithdrawPage() {
  const { vaults, refetch: refetchVaults } = useOwnedVaults();
  const { custodyVaults, refetch: refetchCustody } = useOwnedCustodyVaults();
  const { auths, refetch: refetchAuths } = useOwnedRepaymentAuths();
  const { requestAuth, isPending: requesting } = useRequestRepaymentAuth();
  const { releaseToOwner, isPending: releasing } = useReleaseToOwner();

  const [selectedVaultId, setSelectedVaultId] = useState("");

  // Vaults with debt = 0 are eligible for withdrawal
  const eligibleVaults = vaults.filter((v) => v.debt === "0" && Number(v.balance) > 0);

  const selectedVault = vaults.find((v) => v.objectId === selectedVaultId);
  const matchingCustody = selectedVault
    ? custodyVaults.find((c) => c.objectId === selectedVault.custodyId)
    : undefined;
  const matchingAuth = selectedVault
    ? auths.find((a) => a.vaultId === selectedVault.custodyId)
    : undefined;

  const handleRequestAuth = async () => {
    if (!selectedVaultId) {
      toast.error("Select a vault.");
      return;
    }
    try {
      await requestAuth(selectedVaultId);
      toast.success(
        "Repayment authorization requested! Refresh and proceed to step 2.",
      );
      refetchAuths();
    } catch (e: unknown) {
      toast.error(
        `Auth request failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const handleRelease = async () => {
    if (!matchingCustody || !matchingAuth) {
      toast.error("Missing custody vault or repayment auth.");
      return;
    }
    try {
      await releaseToOwner(matchingCustody.objectId, matchingAuth.objectId);
      toast.success("Collateral withdrawn successfully!");
      setSelectedVaultId("");
      refetchVaults();
      refetchCustody();
      refetchAuths();
    } catch (e: unknown) {
      toast.error(
        `Release failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <Layout activePage="withdraw">
      <WalletGate>
        <div className="mx-auto max-w-xl px-6 py-10">
          <BorrowerStepper currentStep={6} />
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Withdraw Collateral
          </h1>

          {/* Info box */}
          <div className="pixel-border mb-6 bg-[var(--accent)]/5 p-4 text-xs leading-relaxed text-[var(--fg-dim)]">
            <p className="mb-2 font-medium uppercase text-[var(--fg)]">
              Withdrawal requires zero debt
            </p>
            <p className="mb-1">Repay all loans first, then:</p>
            <ol className="list-inside list-decimal space-y-1">
              <li>Request authorization (the adjudicator verifies debt == 0)</li>
              <li>Release collateral back to your wallet</li>
            </ol>
          </div>

          <div className="space-y-6">
            {/* Step 1: Select vault */}
            <div>
              <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                Select Vault (debt must be 0)
              </label>
              {eligibleVaults.length === 0 ? (
                <p className="text-xs text-[var(--fg-dim)]">
                  No vaults with zero debt and positive collateral found.
                </p>
              ) : (
                <select
                  value={selectedVaultId}
                  onChange={(e) => setSelectedVaultId(e.target.value)}
                  className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
                >
                  <option value="">Select vault</option>
                  {eligibleVaults.map((v) => (
                    <option key={v.objectId} value={v.objectId}>
                      {v.objectId.slice(0, 8)}... (collateral: {v.balance}{" "}
                      MIST)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Vault info */}
            {selectedVault && (
              <div className="pixel-border space-y-1 bg-[var(--panel)] p-4 text-xs">
                <p>Vault: {selectedVault.objectId.slice(0, 16)}...</p>
                <p>Collateral: {selectedVault.balance} MIST</p>
                <p>Debt: {selectedVault.debt}</p>
                <p>
                  Custody:{" "}
                  {matchingCustody
                    ? `${matchingCustody.objectId.slice(0, 16)}... (${matchingCustody.balance} MIST)`
                    : selectedVault.custodyId.slice(0, 16) + "..."}
                </p>
                <p>
                  Auth:{" "}
                  {matchingAuth ? (
                    <span className="text-sky-400">
                      Ready ({matchingAuth.objectId.slice(0, 12)}...)
                    </span>
                  ) : (
                    <span className="text-yellow-400">
                      Not yet requested
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Step 1: Request auth */}
            {selectedVault && !matchingAuth && (
              <div>
                <p className="mb-2 text-xs text-[var(--fg-dim)]">
                  Step 1: Request repayment authorization
                </p>
                <button
                  type="button"
                  className="pixel-btn pixel-btn-accent"
                  onClick={handleRequestAuth}
                  disabled={requesting}
                >
                  {requesting ? "Requesting..." : "Request Auth"}
                </button>
              </div>
            )}

            {/* Step 2: Release collateral */}
            {selectedVault && matchingAuth && (
              <div>
                <p className="mb-2 text-xs text-[var(--fg-dim)]">
                  Step 2: Release collateral to your wallet
                </p>
                <button
                  type="button"
                  className="pixel-btn pixel-btn-accent"
                  onClick={handleRelease}
                  disabled={releasing}
                >
                  {releasing ? "Releasing..." : "Withdraw Collateral"}
                </button>
              </div>
            )}

            {/* Refresh button */}
            <button
              type="button"
              className="pixel-btn"
              onClick={() => {
                refetchVaults();
                refetchCustody();
                refetchAuths();
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </WalletGate>
    </Layout>
  );
}
