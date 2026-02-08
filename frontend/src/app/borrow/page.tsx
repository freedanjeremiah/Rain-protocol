"use client";

import { useState } from "react";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import { useSubmitBorrowOrder } from "@/hooks/useRainTransactions";
import BorrowerStepper from "@/components/shared/BorrowerStepper";
import { isMarketplaceConfigured } from "@/lib/rain";
import { toast } from "sonner";

export default function BorrowPage() {
  const { vaults, isConfigured } = useOwnedVaults();
  const { submitBorrowOrder, isPending } = useSubmitBorrowOrder();
  const [vaultId, setVaultId] = useState("");
  const [amount, setAmount] = useState("");
  const [maxRateBps, setMaxRateBps] = useState("500"); // 5%
  const [durationDays, setDurationDays] = useState("30");

  const handleSubmit = async () => {
    if (!vaultId || !amount) {
      toast.error("Select vault and enter amount.");
      return;
    }
    if (!isMarketplaceConfigured()) {
      toast.error("LendingMarketplace not configured.");
      return;
    }
    try {
      await submitBorrowOrder(
        vaultId,
        Number(amount),
        Number(maxRateBps),
        Number(durationDays),
      );
      toast.success("Borrow order submitted!");
      setAmount("");
    } catch (e: unknown) {
      toast.error(`Borrow failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <Layout activePage="borrow">
      <WalletGate>
        <div className="mx-auto max-w-xl px-6 py-10">
          <BorrowerStepper currentStep={3} />
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Borrow
          </h1>
          <p className="mb-6 text-xs text-[var(--fg-dim)]">
            Submit a borrow order. Lenders can fill it to create a loan. Requires a vault with collateral.
          </p>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                Vault (collateral)
              </label>
              <select
                value={vaultId}
                onChange={(e) => setVaultId(e.target.value)}
                className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
              >
                <option value="">Select vault</option>
                {vaults.map((v) => (
                  <option key={v.objectId} value={v.objectId}>
                    {v.objectId.slice(0, 8)}... ({v.balance} MIST)
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
            <div>
              <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                Max interest (bps, e.g. 500 = 5%)
              </label>
              <input
                type="text"
                value={maxRateBps}
                onChange={(e) => setMaxRateBps(e.target.value)}
                className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                Duration (days)
              </label>
              <input
                type="text"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
              />
            </div>
            <button
              type="button"
              className="pixel-btn pixel-btn-accent"
              onClick={handleSubmit}
              disabled={!isConfigured || isPending}
            >
              {isPending ? "Submitting..." : "Submit borrow order"}
            </button>
          </div>
        </div>
      </WalletGate>
    </Layout>
  );
}
