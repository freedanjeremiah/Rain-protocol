"use client";

import { useState } from "react";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import { toast } from "sonner";

export default function LendPage() {
  const [amount, setAmount] = useState("");
  const [minRateBps, setMinRateBps] = useState("300"); // 3%
  const [durationDays, setDurationDays] = useState("30");

  const handleSubmit = () => {
    if (!amount) {
      toast.error("Enter amount.");
      return;
    }
    toast.info("Lend order submission will be available when LendingMarketplace is deployed.");
  };

  return (
    <Layout activePage="lend">
      <WalletGate>
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Lend
          </h1>
          <p className="mb-6 text-xs text-[var(--fg-dim)]">
            Submit a lend order. DeepBook matches with borrowers. You earn interest over time.
          </p>

          <div className="space-y-6">
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
                Min interest (bps, e.g. 300 = 3%)
              </label>
              <input
                type="text"
                value={minRateBps}
                onChange={(e) => setMinRateBps(e.target.value)}
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
            >
              Submit lend order
            </button>
          </div>
        </div>
      </WalletGate>
    </Layout>
  );
}
