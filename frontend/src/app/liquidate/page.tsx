"use client";

import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";

export default function LiquidatePage() {
  return (
    <Layout activePage="liquidate">
      <WalletGate>
        <div className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Liquidate
          </h1>
          <p className="mb-6 text-xs text-[var(--fg-dim)]">
            Read-only view. When a vault’s LTV exceeds the threshold, anyone can call liquidate on-chain. Collateral is sold via DeepBook; debt repaid; liquidator rewarded.
          </p>

          <div className="pixel-border bg-[var(--panel)] p-6">
            <h2 className="mb-4 text-xs uppercase tracking-wider text-[var(--fg-dim)]">
              Vaults at risk / Recent liquidations
            </h2>
            <p className="text-xs text-[var(--fg-dim)]">
              No liquidations to display. This view will show vaults eligible for liquidation (or recent liquidation events) when the indexer or on-chain query is connected.
            </p>
          </div>
        </div>
      </WalletGate>
    </Layout>
  );
}
