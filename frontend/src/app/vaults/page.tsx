"use client";

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

export default function VaultsPage() {
  const { vaults, isPending, refetch, isConfigured } = useOwnedVaults();
  const { createVault, isPending: isCreating } = useCreateVault();

  const handleCreate = async () => {
    if (!isConfigured) {
      toast.error("Set NEXT_PUBLIC_RAIN_PACKAGE_ID to create vaults.");
      return;
    }
    try {
      await createVault();
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
            Create a custody vault to hold collateral. Then deposit SUI and use
            it to borrow.
          </p>

          {!isConfigured && (
            <div className="pixel-border mb-6 bg-[var(--panel)] p-4 text-xs text-[var(--accent)]">
              Set NEXT_PUBLIC_RAIN_PACKAGE_ID in .env to connect to deployed
              contracts.
            </div>
          )}

          <div className="mb-8 flex flex-wrap gap-4">
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
