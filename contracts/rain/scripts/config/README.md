# Rain scripts config

## Deployed package (testnet / mainnet)

After publishing the Rain package, IDs are stored in **`published.json`**:

- **`packageId`** – Set this as `NEXT_PUBLIC_RAIN_PACKAGE_ID` in the frontend `.env` so the app stops showing “Set NEXT_PUBLIC_RAIN_PACKAGE_ID”.
- **`lendingMarketplaceId`** – Shared `LendingMarketplace` object (order book). Needed for submit/fill/repay flows.

To publish (from repo root or `contracts/rain`):

```powershell
# Testnet (default; no mainnet funds needed — Pyth testnet used via Move.toml)
cd contracts/rain/scripts
.\publish.ps1

# Mainnet (when you have mainnet funds)
.\publish.ps1 -Env mainnet
```

Or one-off with Sui CLI (from `contracts/rain`):

```bash
sui client publish . --gas-budget 800000000 --allow-dirty -e testnet
```

Then copy the printed **Package ID** (and any shared object IDs) into `scripts/config/published.json` and set `NEXT_PUBLIC_RAIN_PACKAGE_ID` in the frontend `.env`.

### If publish fails with "Failed to fetch package Pyth"

Rain uses **Pyth testnet** when publishing to testnet. The publish script sets the Pyth cache to use the testnet manifest (testnet package ID) before publishing. If it still fails:

1. **Testnet (default)** – Run `.\publish.ps1`; ensure `sui client active-env` is testnet and you have testnet SUI (e.g. from Sui faucet).
2. **Fix Pyth cache once** – From `contracts/rain/scripts` run `.\fix_pyth_manifest.ps1 -Testnet`, then `.\publish.ps1` again.
3. **Refresh deps** – From `contracts/rain`: `sui move update-deps --environment testnet --allow-dirty`, then `.\scripts\publish.ps1`.
4. **Mainnet** – When you have mainnet funds, use `.\publish.ps1 -Env mainnet`.

### If publish fails with "PublishUpgradeMissingDependency"

The script removes `Move.lock` and strips `published-at` from Pyth/Wormhole so they are bundled with `--with-unpublished-dependencies`. If it still fails:

1. **Upgrade Sui CLI** – Match server version (e.g. 1.65.0). On Windows, `sui upgrade` is not available; download the latest from https://github.com/MystenLabs/sui/releases and replace your `sui` binary.
2. **Re-run** – `.\publish.ps1` (lock is recreated; ensure testnet SUI for higher gas).
3. **Mainnet** – `.\publish.ps1 -Env mainnet` when you have mainnet funds.

Other projects: **PismoProtocol** uses Pyth/Wormhole testnet revs directly and `sui client publish --skip-dependency-verification` (see `contracts/Move.toml`). **deepbookv3** uses `[dep-replacements.testnet]` for Pyth (see `packages/deepbook_margin/Move.toml`).

---

## DeepBook pool IDs (mainnet)

Rain uses **DeepBook v3** for Phase 3 liquidations: selling collateral (SUI) for quote (e.g. USDC).

- **Liquidation pool**: **SUI/USDC** – base = SUI, quote = USDC. Used by `rain::deepbook_adapter::swap_exact_base_for_quote` to sell seized SUI for USDC.
- **Pool object ID** (mainnet): Resolve at runtime via [DeepBook SDK `getPoolIdByAssets`](https://docs.sui.io/standards/deepbookv3-sdk/pools#getpoolidbyassets) with base type `0x2::sui::SUI` and quote type (e.g. USDC full type). Alternatively use the pool key `"SUI_USDC"` if your SDK exposes it (see [deepbookv3 scripts config](../../../deepbookv3/scripts/config/constants.ts) for related caps and [Sui DeepBook docs](https://docs.sui.io/standards/deepbookv3-sdk)).
- **Asset types**: Base = `sui::sui::SUI`, Quote = mainnet USDC type (from token package or chain), DEEP = `token::deep::DEEP` for taker fees.

## TradeProof and BalanceManager

- **Direct swap (no BalanceManager)**: `deepbook::pool::swap_exact_base_for_quote` (and Rain’s `rain::deepbook_adapter::swap_exact_base_for_quote`) take `Coin<BaseAsset>`, `Coin<DEEP>`, and the pool; no `TradeProof` or `BalanceManager` needed. Best for liquidations.
- **Orders**: For `place_limit_order` / `place_market_order`, the caller needs a `BalanceManager` and a `TradeProof`. Owner gets proof via `balance_manager::generate_proof_as_owner`; traders can use `generate_proof_as_trader` with a `TradeCap`. See `deepbookv3/packages/deepbook/sources/balance_manager.move` and `pool.move`.

## Pool IDs reference (verify on mainnet)

| Pool       | Use case   | Note |
|-----------|------------|------|
| SUI/USDC  | Liquidations | Resolve via SDK or registry; whitelisted pools have 0% trading fees. |
