"use client";

import { useState } from "react";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import { useLiquidate } from "@/hooks/useRainTransactions";
import { toast } from "sonner";

export default function LiquidatePage() {
  const { liquidate, isPending } = useLiquidate();

  const [userVaultId, setUserVaultId] = useState("");
  const [custodyVaultId, setCustodyVaultId] = useState("");
  const [priceFeedId, setPriceFeedId] = useState(
    "50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266",
  );
  const [priceInfoObjectId, setPriceInfoObjectId] = useState("");
  const [maxAgeSecs, setMaxAgeSecs] = useState("60");

  const handleLiquidate = async () => {
    if (!userVaultId || !custodyVaultId || !priceInfoObjectId) {
      toast.error("Fill in all required fields.");
      return;
    }
    try {
      await liquidate(
        userVaultId,
        custodyVaultId,
        priceFeedId,
        priceInfoObjectId,
        Number(maxAgeSecs),
      );
      toast.success("Liquidation executed! Collateral released to you.");
      setUserVaultId("");
      setCustodyVaultId("");
    } catch (e: unknown) {
      toast.error(`Liquidation failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <Layout activePage="liquidate">
      <WalletGate>
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Liquidate
          </h1>
          <p className="mb-6 text-xs text-[var(--fg-dim)]">
            Liquidate an under-collateralised vault. When a vault&apos;s LTV exceeds its threshold, anyone can call liquidate. Collateral is released to the liquidator.
          </p>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                Target UserVault ID
              </label>
              <input
                type="text"
                value={userVaultId}
                onChange={(e) => setUserVaultId(e.target.value)}
                placeholder="0x..."
                className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                Target CustodyVault ID
              </label>
              <input
                type="text"
                value={custodyVaultId}
                onChange={(e) => setCustodyVaultId(e.target.value)}
                placeholder="0x..."
                className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                Pyth Price Feed ID (SUI/USD hex)
              </label>
              <input
                type="text"
                value={priceFeedId}
                onChange={(e) => setPriceFeedId(e.target.value)}
                className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                PriceInfoObject ID (Sui object)
              </label>
              <input
                type="text"
                value={priceInfoObjectId}
                onChange={(e) => setPriceInfoObjectId(e.target.value)}
                placeholder="0x..."
                className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase text-[var(--fg-dim)]">
                Max oracle age (seconds)
              </label>
              <input
                type="text"
                value={maxAgeSecs}
                onChange={(e) => setMaxAgeSecs(e.target.value)}
                className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
              />
            </div>
            <button
              type="button"
              className="pixel-btn pixel-btn-accent"
              onClick={handleLiquidate}
              disabled={isPending}
            >
              {isPending ? "Liquidating..." : "Liquidate vault"}
            </button>
          </div>
        </div>
      </WalletGate>
    </Layout>
  );
}
