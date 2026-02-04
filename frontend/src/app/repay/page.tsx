"use client";

import { useState } from "react";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import { toast } from "sonner";

export default function RepayPage() {
  const { vaults } = useOwnedVaults();
  const [vaultId, setVaultId] = useState("");
  const [amount, setAmount] = useState("");

  const handleRepay = () => {
    if (!vaultId || !amount) {
      toast.error("Select vault and enter amount.");
      return;
    }
    toast.info("Repay will be available when UserVault and LendingMarketplace are deployed.");
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
                Vault
              </label>
              <select
                value={vaultId}
                onChange={(e) => setVaultId(e.target.value)}
                className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
              >
                <option value="">Select vault</option>
                {vaults.map((v) => (
                  <option key={v.objectId} value={v.objectId}>
                    {v.objectId.slice(0, 8)}...
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                Amount (USDC)
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
            >
              Repay
            </button>
          </div>
        </div>
      </WalletGate>
    </Layout>
  );
}
