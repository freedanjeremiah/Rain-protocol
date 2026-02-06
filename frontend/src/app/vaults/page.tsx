"use client";

import { useState } from "react";
import Link from "next/link";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import { useCreateVault } from "@/hooks/useRainTransactions";
import { toast } from "sonner";

function truncate(id: string) {
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

function formatMist(mist: string) {
  const n = Number(mist);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} SUI`;
  return `${n} MIST`;
}

const DEFAULT_THRESHOLD_BPS = 8000; // 80%

export default function VaultsPage() {
  const { vaults, isPending, refetch, isConfigured } = useOwnedVaults();
  const { createVault, isPending: isCreating } = useCreateVault();
  const [liquidationBps, setLiquidationBps] = useState(String(DEFAULT_THRESHOLD_BPS));

  const handleCreate = async () => {
    if (!isConfigured) {
      toast.error("Set NEXT_PUBLIC_RAIN_PACKAGE_ID to create vaults.");
      return;
    }
    const bps = Math.floor(Number(liquidationBps) || DEFAULT_THRESHOLD_BPS);
    if (bps < 1000 || bps > 10000) {
      toast.error("Liquidation threshold must be 1000–10000 bps (10–100%).");
      return;
    }
    try {
      await createVault(bps);
      toast.success("Vault created.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create vault failed.");
    }
  };

  return (
    <Layout activePage="vaults">
      <WalletGate>
        <div className="mx-auto max-w-2xl px-6 py-10">
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Vaults
          </h1>
          <p className="mb-6 text-xs text-[var(--fg-dim)]">
            Create a user vault (with linked custody) to hold collateral. Set
            the liquidation threshold in basis points (e.g. 8000 = 80%). Then
            deposit SUI and use it to borrow.
          </p>

          {!isConfigured && (
            <div className="pixel-border mb-6 bg-[var(--panel)] p-4 text-xs text-[var(--accent)]">
              Set NEXT_PUBLIC_RAIN_PACKAGE_ID in .env to connect to deployed
              contracts.
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                Liquidation threshold (bps)
              </label>
              <input
                type="number"
                min="1000"
                max="10000"
                value={liquidationBps}
                onChange={(e) => setLiquidationBps(e.target.value)}
                placeholder="8000"
                className="pixel-border w-28 bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
              />
            </div>
            <button
              type="button"
              className="pixel-btn pixel-btn-accent"
              onClick={handleCreate}
              disabled={isCreating || !isConfigured}
            >
              {isCreating ? "Creating…" : "Create vault"}
            </button>
            <Link href="/deposit" className="pixel-btn">
              Deposit
            </Link>
          </div>

          <h2 className="mb-3 text-xs uppercase tracking-wider text-[var(--fg-dim)]">
            Your vaults
          </h2>
          {isPending ? (
            <p className="text-xs text-[var(--fg-dim)]">Loading…</p>
          ) : vaults.length === 0 ? (
            <p className="text-xs text-[var(--fg-dim)]">
              No vaults yet. Create one above.
            </p>
          ) : (
            <ul className="space-y-3">
              {vaults.map((v) => (
                <li
                  key={v.objectId}
                  className="pixel-border flex flex-wrap items-center justify-between gap-3 bg-[var(--panel)] p-4"
                >
                  <span
                    className="font-mono text-xs text-[var(--fg)]"
                    title={v.objectId}
                  >
                    {truncate(v.objectId)}
                  </span>
                  <span className="text-xs text-[var(--fg-dim)]">
                    {formatMist(v.balance)} collateral
                    {Number(v.debt) > 0 && ` · ${formatMist(v.debt)} debt`}
                  </span>
                  <Link
                    href={`/deposit?vault=${v.objectId}`}
                    className="pixel-btn text-[0.6rem]"
                  >
                    Deposit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </WalletGate>
    </Layout>
  );
}
