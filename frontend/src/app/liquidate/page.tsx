"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Layout from "@/components/common/Layout";
import { WalletGate } from "@/components/shared/WalletGate";
import {
  useLiquidate,
  useSellCollateralAndSettle,
} from "@/hooks/useRainTransactions";
import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { RAIN } from "@/lib/rain";
import { toast } from "sonner";

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

interface OwnedCoin {
  objectId: string;
  balance: string;
}

function parseId(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "id" in val)
    return String((val as Record<string, unknown>).id);
  return "";
}

function formatSui(mist: string): string {
  const n = Number(mist);
  if (n >= 1e9) return `${(n / 1e9).toFixed(4)} SUI`;
  return `${n} MIST`;
}

function formatDeep(raw: string): string {
  const n = Number(raw);
  if (n >= 1e6) return `${(n / 1e6).toFixed(4)} DEEP`;
  return `${n} units`;
}

export default function LiquidatePage() {
  const { liquidate, isPending } = useLiquidate();
  const { sellAndSettle, isPending: settling } = useSellCollateralAndSettle();
  const client = useSuiClient();
  const account = useCurrentAccount();

  // Step 1 manual form (fallback)
  const [userVaultId, setUserVaultId] = useState("");
  const [custodyVaultId, setCustodyVaultId] = useState("");
  const [maxAgeSecs, setMaxAgeSecs] = useState("60");
  const [showManualForm, setShowManualForm] = useState(false);
  // Tracks which vault row is actively being liquidated
  const [liquidatingVaultId, setLiquidatingVaultId] = useState<string | null>(
    null,
  );

  // Step 2
  const [settleVaultId, setSettleVaultId] = useState("");
  const [collateralCoinId, setCollateralCoinId] = useState("");
  const [deepCoinId, setDeepCoinId] = useState("");
  const [minQuoteOut, setMinQuoteOut] = useState("0");
  const [liquidatorBonusBps, setLiquidatorBonusBps] = useState("500");
  const [suiCoins, setSuiCoins] = useState<OwnedCoin[]>([]);
  const [deepCoins, setDeepCoins] = useState<OwnedCoin[]>([]);
  const [loadingCoins, setLoadingCoins] = useState(false);

  // Discovery
  const [searchAddress, setSearchAddress] = useState("");
  const [discoveredVaults, setDiscoveredVaults] = useState<DiscoveredVault[]>(
    [],
  );
  const [discovering, setDiscovering] = useState(false);
  const autoRanForRef = useRef<string>("");

  /* ------------------------------------------------------------------ */
  /*  Fetch owned Coin<SUI> and Coin<DEEP> for Step 2                   */
  /* ------------------------------------------------------------------ */

  const fetchCoins = useCallback(async () => {
    if (!account?.address) return;
    setLoadingCoins(true);
    try {
      const [suiResp, deepResp] = await Promise.all([
        client.getOwnedObjects({
          owner: account.address,
          filter: { StructType: "0x2::coin::Coin<0x2::sui::SUI>" },
          options: { showContent: true },
        }),
        client.getOwnedObjects({
          owner: account.address,
          filter: {
            StructType: `0x2::coin::Coin<${RAIN.deepbook.deepCoinType}>`,
          },
          options: { showContent: true },
        }),
      ]);

      const parseCoinList = (data: typeof suiResp.data): OwnedCoin[] => {
        const coins: OwnedCoin[] = [];
        for (const obj of data) {
          const d = obj.data;
          if (
            !d?.objectId ||
            !d.content ||
            d.content.dataType !== "moveObject"
          )
            continue;
          const fields = d.content.fields as Record<string, unknown>;
          const balance = String(fields.balance ?? "0");
          if (Number(balance) > 0) {
            coins.push({ objectId: d.objectId, balance });
          }
        }
        return coins.sort((a, b) => Number(b.balance) - Number(a.balance));
      };

      setSuiCoins(parseCoinList(suiResp.data));
      setDeepCoins(parseCoinList(deepResp.data));
    } catch {
      // silent — coins will just show empty lists
    } finally {
      setLoadingCoins(false);
    }
  }, [client, account?.address]);

  // Fetch coins when wallet connects
  useEffect(() => {
    if (account?.address) fetchCoins();
  }, [account?.address, fetchCoins]);

  /* ------------------------------------------------------------------ */
  /*  Step 1: One-click liquidate from vault row                        */
  /* ------------------------------------------------------------------ */

  const handleLiquidateVault = useCallback(
    async (vault: DiscoveredVault) => {
      setLiquidatingVaultId(vault.objectId);
      try {
        await liquidate(
          vault.objectId,
          vault.custodyId,
          RAIN.pyth.suiUsdFeedId,
          RAIN.pyth.suiUsdPriceObjectId,
          Number(maxAgeSecs),
        );
        toast.success(
          "Liquidation executed! Select coins below to sell & settle.",
        );
        setSettleVaultId(vault.objectId);
        fetchCoins(); // refresh — liquidation delivers a new Coin<SUI>
      } catch (e: unknown) {
        toast.error(
          `Liquidation failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        setLiquidatingVaultId(null);
      }
    },
    [liquidate, maxAgeSecs, fetchCoins],
  );

  /* ------------------------------------------------------------------ */
  /*  Step 1 manual fallback                                            */
  /* ------------------------------------------------------------------ */

  const handleLiquidateManual = async () => {
    if (!userVaultId || !custodyVaultId) {
      toast.error("Fill in UserVault and CustodyVault IDs.");
      return;
    }
    try {
      await liquidate(
        userVaultId,
        custodyVaultId,
        RAIN.pyth.suiUsdFeedId,
        RAIN.pyth.suiUsdPriceObjectId,
        Number(maxAgeSecs),
      );
      toast.success("Liquidation executed! Proceed to Step 2.");
      setSettleVaultId(userVaultId);
      fetchCoins();
    } catch (e: unknown) {
      toast.error(
        `Liquidation failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Step 2: Sell & Settle                                             */
  /* ------------------------------------------------------------------ */

  const handleSellAndSettle = async () => {
    if (!settleVaultId || !collateralCoinId || !deepCoinId) {
      toast.error("Select vault, collateral coin, and DEEP coin.");
      return;
    }
    if (!RAIN.deepbook.suiUsdcPoolId) {
      toast.error("DeepBook pool not configured.");
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
      setSettleVaultId("");
      fetchCoins();
    } catch (e: unknown) {
      toast.error(
        `Sell & settle failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Vault discovery                                                   */
  /* ------------------------------------------------------------------ */

  const discoverVaults = useCallback(
    async (addr: string) => {
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
          if (
            !d?.objectId ||
            !d.content ||
            d.content.dataType !== "moveObject"
          )
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
          const ltvBps =
            collNum > 0
              ? Math.floor((debtNum / collNum) * 10000)
              : debtNum > 0
                ? 99999
                : 0;
          const isLiquidatable =
            ltvBps >= Number(thresholdBps) && debtNum > 0;

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
    },
    [client],
  );

  // Auto-discover on mount / account change
  useEffect(() => {
    const addr = account?.address;
    if (addr && addr !== autoRanForRef.current) {
      autoRanForRef.current = addr;
      setSearchAddress(addr);
      discoverVaults(addr);
    }
  }, [account?.address, discoverVaults]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */

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
                onClick={() => discoverVaults(searchAddress.trim())}
                disabled={discovering}
              >
                {discovering ? "..." : "Search"}
              </button>
            </div>

            {discoveredVaults.length > 0 && (
              <div className="mt-3 space-y-2">
                {discoveredVaults.map((v) => {
                  const isThisLiquidating = liquidatingVaultId === v.objectId;
                  return (
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
                            <span className="text-[var(--fg-dim)]">
                              Vault:
                            </span>{" "}
                            {v.objectId.slice(0, 14)}...
                          </p>
                          <p>
                            <span className="text-[var(--fg-dim)]">
                              Collateral:
                            </span>{" "}
                            {v.collateral} MIST
                          </p>
                          <p>
                            <span className="text-[var(--fg-dim)]">
                              Debt:
                            </span>{" "}
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
                        <button
                          type="button"
                          className="pixel-btn pixel-btn-accent"
                          onClick={() => handleLiquidateVault(v)}
                          disabled={isPending || liquidatingVaultId !== null}
                        >
                          {isThisLiquidating
                            ? "Liquidating..."
                            : "Liquidate"}
                        </button>
                      </div>
                      {v.isLiquidatable && (
                        <p className="mt-1 text-red-400">
                          Potentially liquidatable
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* --- Step 1: Manual fallback (collapsed) --- */}
          <div className="mb-8">
            <button
              type="button"
              className="mb-3 text-xs text-[var(--fg-dim)] underline"
              onClick={() => setShowManualForm((p) => !p)}
            >
              {showManualForm
                ? "Hide manual liquidation form"
                : "Have vault IDs? Enter them manually"}
            </button>

            {showManualForm && (
              <div className="pixel-border space-y-4 bg-[var(--panel)] p-4">
                <p className="text-xs text-[var(--fg-dim)]">
                  Paste vault IDs if you have them from another source.
                </p>
                <div>
                  <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                    Target UserVault ID
                  </label>
                  <input
                    type="text"
                    value={userVaultId}
                    onChange={(e) => setUserVaultId(e.target.value)}
                    placeholder="0x..."
                    className="pixel-border w-full bg-[var(--bg)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
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
                    className="pixel-border w-full bg-[var(--bg)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)]"
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
                    className="pixel-border w-full bg-[var(--bg)] px-3 py-2 text-xs text-[var(--fg)]"
                  />
                </div>
                <button
                  type="button"
                  className="pixel-btn pixel-btn-accent"
                  onClick={handleLiquidateManual}
                  disabled={isPending}
                >
                  {isPending ? "Liquidating..." : "Liquidate vault"}
                </button>
              </div>
            )}
          </div>

          {/* --- Step 2: Sell & Settle --- */}
          <div>
            <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--fg-dim)]">
              Step 2: Sell Collateral &amp; Settle
            </h2>
            <p className="mb-3 text-xs text-[var(--fg-dim)]">
              Sell the seized collateral on DeepBook (SUI &rarr; DBUSDC).
              Repays vault debt and sends you a liquidator bonus.
            </p>
            <div className="space-y-4">
              {/* Vault ID — pre-filled from Step 1 */}
              <div>
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                  Target UserVault ID
                </label>
                <input
                  type="text"
                  value={settleVaultId}
                  onChange={(e) => setSettleVaultId(e.target.value)}
                  placeholder="Set automatically after Step 1"
                  readOnly={!!settleVaultId}
                  className={`pixel-border w-full px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)] ${
                    settleVaultId
                      ? "bg-[var(--accent)]/10"
                      : "bg-[var(--panel)]"
                  }`}
                />
                {settleVaultId && (
                  <button
                    type="button"
                    className="mt-1 text-[0.6rem] text-[var(--fg-dim)] underline"
                    onClick={() => setSettleVaultId("")}
                  >
                    Clear / enter different vault
                  </button>
                )}
              </div>

              {/* Coin<SUI> selector */}
              <div>
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                  Collateral Coin (SUI from liquidation)
                </label>
                {loadingCoins ? (
                  <p className="text-xs text-[var(--fg-dim)]">
                    Loading coins...
                  </p>
                ) : suiCoins.length === 0 ? (
                  <p className="text-xs text-[var(--fg-dim)]">
                    No SUI coins found in wallet.
                  </p>
                ) : (
                  <select
                    value={collateralCoinId}
                    onChange={(e) => setCollateralCoinId(e.target.value)}
                    className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
                  >
                    <option value="">-- select SUI coin --</option>
                    {suiCoins.map((c) => (
                      <option key={c.objectId} value={c.objectId}>
                        {c.objectId.slice(0, 10)}...{c.objectId.slice(-6)} —{" "}
                        {formatSui(c.balance)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Coin<DEEP> selector */}
              <div>
                <label className="mb-1 block text-xs uppercase text-[var(--fg-dim)]">
                  DEEP Coin (for DeepBook fees)
                </label>
                {loadingCoins ? (
                  <p className="text-xs text-[var(--fg-dim)]">
                    Loading coins...
                  </p>
                ) : deepCoins.length === 0 ? (
                  <p className="text-xs text-[var(--fg-dim)]">
                    No DEEP coins found in wallet.
                  </p>
                ) : (
                  <select
                    value={deepCoinId}
                    onChange={(e) => setDeepCoinId(e.target.value)}
                    className="pixel-border w-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--fg)]"
                  >
                    <option value="">-- select DEEP coin --</option>
                    {deepCoins.map((c) => (
                      <option key={c.objectId} value={c.objectId}>
                        {c.objectId.slice(0, 10)}...{c.objectId.slice(-6)} —{" "}
                        {formatDeep(c.balance)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Numeric inputs — small, acceptable */}
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

              <div className="flex gap-2">
                <button
                  type="button"
                  className="pixel-btn pixel-btn-accent"
                  onClick={handleSellAndSettle}
                  disabled={settling}
                >
                  {settling ? "Settling..." : "Sell & Settle"}
                </button>
                <button
                  type="button"
                  className="pixel-btn"
                  onClick={() => fetchCoins()}
                  disabled={loadingCoins}
                >
                  {loadingCoins ? "..." : "Refresh Coins"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </WalletGate>
    </Layout>
  );
}
