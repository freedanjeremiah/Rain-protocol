"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import { useDeposit } from "@/hooks/useRainTransactions";
import BorrowerStepper from "@/components/shared/BorrowerStepper";
import { toast } from "sonner";

const MIST_PER_SUI = 1_000_000_000;

function formatMist(mist: string) {
  const n = Number(mist);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} SUI`;
  return `${n} MIST`;
}

function DepositContent() {
  const searchParams = useSearchParams();
  const preselected = searchParams.get("vault") ?? "";
  const { vaults, isPending, refetch, isConfigured } = useOwnedVaults();
  const { deposit, isPending: isDepositing } = useDeposit();
  const [selectedVaultId, setSelectedVaultId] = useState("");
  const [amountSui, setAmountSui] = useState("");
  const defaultVaultId = vaults.find((v) => v.objectId === preselected)?.objectId ?? vaults[0]?.objectId ?? "";
  const effectiveVaultId = selectedVaultId || defaultVaultId;
  const selectedVault = vaults.find((v) => v.objectId === effectiveVaultId);

  const handleDeposit = async () => {
    const amountMist = Math.floor(parseFloat(amountSui || "0") * MIST_PER_SUI);
    if (!effectiveVaultId || !selectedVault?.custodyId || amountMist <= 0) {
      toast.error("Select a vault and enter amount.");
      return;
    }
    if (!isConfigured) {
      toast.error("Set NEXT_PUBLIC_RAIN_PACKAGE_ID.");
      return;
    }
    try {
      await deposit(effectiveVaultId, selectedVault.custodyId, String(amountMist));
      toast.success("Deposit successful.");
      setAmountSui("");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deposit failed.");
    }
  };

  return (
    <Layout activePage="deposit">
      <WalletGate>
        <div className="mx-auto max-w-xl px-6 py-10">
          <BorrowerStepper currentStep={2} />
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Deposit
          </h1>
          <p className="mb-6 text-xs text-[var(--fg-dim)]">
            Add SUI collateral to a user vault. You need at least one vault
            (create one on the Vaults page).
          </p>

          {isPending ? (
            <p className="text-xs text-[var(--fg-dim)]">Loading vaults…</p>
          ) : vaults.length === 0 ? (
            <p className="text-xs text-[var(--fg-dim)]">
              No vaults. <Link href="/vaults" className="text-[var(--accent)] underline">Create one</Link> first.
            </p>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                  Vault
                </label>
                <select
                  value={effectiveVaultId}
                  onChange={(e) => setSelectedVaultId(e.target.value)}
                  className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
                >
                  {vaults.map((v) => (
                    <option key={v.objectId} value={v.objectId}>
                      {v.objectId.slice(0, 8)}... · {formatMist(v.balance)} collateral
                      {Number(v.debt) > 0 ? ` · ${formatMist(v.debt)} debt` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                  Amount (SUI)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amountSui}
                  onChange={(e) => setAmountSui(e.target.value)}
                  placeholder="0"
                  className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
                />
              </div>
              <button
                type="button"
                className="pixel-btn pixel-btn-accent"
                onClick={handleDeposit}
                disabled={isDepositing || !isConfigured || !amountSui}
              >
                {isDepositing ? "Depositing…" : "Deposit"}
              </button>
            </div>
          )}
        </div>
      </WalletGate>
    </Layout>
  );
}

export default function DepositPage() {
  return (
    <Suspense fallback={<Layout activePage="deposit"><div className="flex flex-1 items-center justify-center p-8 text-xs text-[var(--fg-dim)]">Loading…</div></Layout>}>
      <DepositContent />
    </Suspense>
  );
}
