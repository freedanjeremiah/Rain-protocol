"use client";

import { useState } from "react";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import { useSubmitLendOrder } from "@/hooks/useRainTransactions";
import { isMarketplaceConfigured } from "@/lib/rain";
import { toast } from "sonner";

export default function LendPage() {
  const { submitLendOrder, isPending } = useSubmitLendOrder();
  const [amount, setAmount] = useState("");
  const [minRateBps, setMinRateBps] = useState("300"); // 3%
  const [durationDays, setDurationDays] = useState("30");

  const handleSubmit = async () => {
    if (!amount) {
      toast.error("Enter amount.");
      return;
    }
    if (!isMarketplaceConfigured()) {
      toast.error("LendingMarketplace not configured.");
      return;
    }
    try {
      await submitLendOrder(
        Number(amount),
        Number(minRateBps),
        Number(durationDays),
      );
      toast.success("Lend order submitted!");
      setAmount("");
    } catch (e: unknown) {
      toast.error(`Lend failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <Layout activePage="lend">
      <WalletGate>
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Lend
          </h1>
          <p className="mb-6 text-xs text-[var(--fg-dim)]">
            Submit a lend order. Borrowers can be matched with your offer. You earn interest over time.
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
              disabled={isPending}
            >
              {isPending ? "Submitting..." : "Submit lend order"}
            </button>
          </div>
        </div>
      </WalletGate>
    </Layout>
  );
}
