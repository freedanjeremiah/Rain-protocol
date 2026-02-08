"use client";

import { useState, useCallback } from "react";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import {
  useLiquidate,
  useSellCollateralAndSettle,
} from "@/hooks/useRainTransactions";
import { useSuiClient } from "@mysten/dapp-kit";
import { RAIN } from "@/lib/rain";
import { toast } from "sonner";

const DEFAULT_PRICE_FEED =
  "50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266";

interface DiscoveredVault {
  objectId: string;
  owner: string;
  custodyId: string;
  collateral: string;
  debt: string;
  thresholdBps: string;
  ltvBps: number;
  isLiquidatable: boolean;
}

function parseId(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "id" in val) return String((val as Record<string, unknown>).id);
  return "";
}

export default function LiquidatePage() {
  const { liquidate, isPending } = useLiquidate();
  const { sellAndSettle, isPending: settling } = useSellCollateralAndSettle();
  const client = useSuiClient();

  // Step 1: Liquidate fields
  const [userVaultId, setUserVaultId] = useState("");
  const [custodyVaultId, setCustodyVaultId] = useState("");
  const [priceFeedId, setPriceFeedId] = useState(DEFAULT_PRICE_FEED);
  const [priceInfoObjectId, setPriceInfoObjectId] = useState("");
  const [maxAgeSecs, setMaxAgeSecs] = useState("60");

  // Step 2: Sell & Settle fields
  const [collateralCoinId, setCollateralCoinId] = useState("");
  const [deepCoinId, setDeepCoinId] = useState("");
  const [minQuoteOut, setMinQuoteOut] = useState("0");
  const [liquidatorBonusBps, setLiquidatorBonusBps] = useState("500");
  const [settleVaultId, setSettleVaultId] = useState("");

  // Discovery
  const [searchAddress, setSearchAddress] = useState("");
  const [discoveredVaults, setDiscoveredVaults] = useState<DiscoveredVault[]>(
    [],
  );
  const [discovering, setDiscovering] = useState(false);

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
      toast.success(
        "Liquidation executed! Collateral sent to your wallet. Proceed to Step 2 to sell & settle.",
      );
      setSettleVaultId(userVaultId);
    } catch (e: unknown) {
      toast.error(
        `Liquidation failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const handleSellAndSettle = async () => {
    if (!settleVaultId || !collateralCoinId || !deepCoinId) {
      toast.error("Fill in vault ID, collateral coin, and DEEP coin.");
      return;
    }
    if (!RAIN.deepbook.suiUsdcPoolId) {
      toast.error(
        "DeepBook pool not configured. Set NEXT_PUBLIC_DEEPBOOK_SUI_USDC_POOL_ID.",
      );
      return;
    }
    try {
      await sellAndSettle(
        settleVaultId,
        collateralCoinId,
        deepCoinId,
        minQuoteOut,
        Number(liquidatorBonusBps),
      );
      toast.success("Collateral sold & settled! Bonus received.");
      setCollateralCoinId("");
      setDeepCoinId("");
    } catch (e: unknown) {
      toast.error(
        `Sell & settle failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  // --- Liquidatable vault discovery ---
  const discoverVaults = useCallback(async () => {
    const addr = searchAddress.trim();
    if (!addr) {
      toast.error("Enter an address to search.");
      return;
    }
    setDiscovering(true);
    setDiscoveredVaults([]);
    try {
      const resp = await client.getOwnedObjects({
        owner: addr,
        filter: { StructType: RAIN.userVault.type },
        options: { showContent: true },
      });
      const vaults: DiscoveredVault[] = [];
      for (const obj of resp.data) {
        const d = obj.data;
        if (!d?.objectId || !d.content || d.content.dataType !== "moveObject")
          continue;
        const fields = d.content.fields as Record<string, unknown>;
        const collateral = String(fields.collateral_balance ?? "0");
        const debt = String(fields.debt ?? "0");
        const thresholdBps = String(
          fields.liquidation_threshold_bps ?? "8000",
        );
        const custodyId = parseId(fields.custody_id);
        const owner = String(fields.owner ?? addr);

        const collNum = Number(collateral);
        const debtNum = Number(debt);
        // Approximate LTV: debt / collateral * 10000 (in bps)
        // This is a raw ratio without oracle price - gives rough idea
        const ltvBps =
          collNum > 0 ? Math.floor((debtNum / collNum) * 10000) : debtNum > 0 ? 99999 : 0;
        const isLiquidatable = ltvBps >= Number(thresholdBps) && debtNum > 0;

        vaults.push({
          objectId: d.objectId,
          owner,
          custodyId,
          collateral,
          debt,
          thresholdBps,
          ltvBps,
          isLiquidatable,
        });
      }
      setDiscoveredVaults(vaults);
      if (vaults.length === 0) {
        toast.info("No vaults found for this address.");
      }
    } catch (e: unknown) {
      toast.error(
        `Discovery failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setDiscovering(false);
    }
  }, [client, searchAddress]);

  return (
    <Layout activePage="liquidate">
      <WalletGate>
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="mb-6 text-2xl uppercase tracking-wider sm:text-3xl">
            Liquidate
          </h1>

          {/* --- Discovery Section --- */}
          <div className="mb-8">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--fg-dim)]">
              Find Liquidatable Vaults
            </h2>
            <p className="mb-3 text-xs text-[var(--fg-dim)]">
              Search by owner address. Vaults with approximate LTV above
              threshold (without oracle) are flagged. Actual liquidatability
              depends on oracle price.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                placeholder="Owner address (0x...)"
                className="pixel-border flex-1 bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
              />
              <button
                type="button"
                className="pixel-btn pixel-btn-accent"
                onClick={discoverVaults}
                disabled={discovering}
              >
                {discovering ? "..." : "Search"}
              </button>
            </div>
            {discoveredVaults.length > 0 && (
              <div className="mt-3 space-y-2">
                {discoveredVaults.map((v) => (
                  <div
                    key={v.objectId}
                    className={`pixel-border p-3 text-xs ${
                      v.isLiquidatable
                        ? "border-red-500/50 bg-red-500/10"
                        : "bg-[var(--panel)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p>
                          <span className="text-[var(--fg-dim)]">Vault:</span>{" "}
                          {v.objectId.slice(0, 14)}...
                        </p>
                        <p>
                          <span className="text-[var(--fg-dim)]">
                            Collateral:
                          </span>{" "}
                          {v.collateral} MIST
                        </p>
                        <p>
                          <span className="text-[var(--fg-dim)]">Debt:</span>{" "}
                          {v.debt}
                        </p>
                        <p>
                          <span className="text-[var(--fg-dim)]">
                            LTV (approx):
                          </span>{" "}
                          {(v.ltvBps / 100).toFixed(1)}% / threshold{" "}
                          {(Number(v.thresholdBps) / 100).toFixed(0)}%
                        </p>
                      </div>
                      {v.isLiquidatable && (
                        <button
                          type="button"
                          className="pixel-btn pixel-btn-accent"
                          onClick={() => {
                            setUserVaultId(v.objectId);
                            setCustodyVaultId(v.custodyId);
                          }}
                        >
                          Select
                        </button>
                      )}
                    </div>
                    {v.isLiquidatable && (
                      <p className="mt-1 text-red-400">
                        Potentially liquidatable
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* --- Step 1: Liquidate --- */}
          <div className="mb-8">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--fg-dim)]">
              Step 1: Liquidate Vault
            </h2>
            <p className="mb-3 text-xs text-[var(--fg-dim)]">
              Seize collateral from an under-collateralised vault. The
              collateral (Coin&lt;SUI&gt;) is sent to your wallet.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
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
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
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
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
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
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
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
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
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

          {/* --- Step 2: Sell & Settle --- */}
          <div>
            <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--fg-dim)]">
              Step 2: Sell Collateral &amp; Settle
            </h2>
            <p className="mb-3 text-xs text-[var(--fg-dim)]">
              Sell the seized collateral on DeepBook (SUI → DBUSDC). Repays
              vault debt and sends you a liquidator bonus.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                  Target UserVault ID (same as step 1)
                </label>
                <input
                  type="text"
                  value={settleVaultId}
                  onChange={(e) => setSettleVaultId(e.target.value)}
                  placeholder="0x..."
                  className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                  Collateral Coin ID (Coin&lt;SUI&gt; from step 1)
                </label>
                <input
                  type="text"
                  value={collateralCoinId}
                  onChange={(e) => setCollateralCoinId(e.target.value)}
                  placeholder="0x..."
                  className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                  DEEP Coin ID (for DeepBook fees)
                </label>
                <input
                  type="text"
                  value={deepCoinId}
                  onChange={(e) => setDeepCoinId(e.target.value)}
                  placeholder="0x..."
                  className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                  Min DBUSDC out (slippage protection)
                </label>
                <input
                  type="text"
                  value={minQuoteOut}
                  onChange={(e) => setMinQuoteOut(e.target.value)}
                  className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                  Liquidator bonus (bps, e.g. 500 = 5%)
                </label>
                <input
                  type="text"
                  value={liquidatorBonusBps}
                  onChange={(e) => setLiquidatorBonusBps(e.target.value)}
                  className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
                />
              </div>
              <button
                type="button"
                className="pixel-btn pixel-btn-accent"
                onClick={handleSellAndSettle}
                disabled={settling}
              >
                {settling ? "Settling..." : "Sell & Settle"}
              </button>
            </div>
          </div>
        </div>
      </WalletGate>
    </Layout>
  );
}
