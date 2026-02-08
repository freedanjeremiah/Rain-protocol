# Rain scripts config

## Deployed package (testnet / mainnet)

After publishing the Rain package, IDs are stored in **`published.json`**:

- **`packageId`** – Set this as `NEXT_PUBLIC_RAIN_PACKAGE_ID` in the frontend `.env` so the app stops showing “Set NEXT_PUBLIC_RAIN_PACKAGE_ID”.
- **`lendingMarketplaceId`** – Shared `LendingMarketplace` object (order book). Needed for submit/fill/repay flows.

To publish (from `contracts/rain/scripts`):

```powershell
# Testnet (default). Pyth/DeepBook/token revs match on-chain testnet packages.
cd contracts/rain/scripts
.\publish.ps1

# Mainnet (when you have mainnet funds)
.\publish.ps1 -Env mainnet
```

The script builds with `--environment testnet` so Move uses Pyth/DeepBook/token revs that match the packages already on testnet. Then copy the printed **Package ID** into `scripts/config/published.json` and set `NEXT_PUBLIC_RAIN_PACKAGE_ID` in the frontend `.env`.

### If publish fails with "Failed to fetch package Pyth"

1. Ensure `sui client active-env` is testnet and you have testnet SUI.
2. Run `sui move build --environment testnet --allow-dirty` from `contracts/rain`, then `.\publish.ps1` again.
3. Or use mainnet when you have funds: `.\publish.ps1 -Env mainnet`.

### If publish fails with "PublishUpgradeMissingDependency"

Rain pins testnet Pyth to a rev that matches the on-chain testnet Pyth package. If it still fails:

1. **Upgrade Sui CLI** to match the chain (e.g. 1.65.x). On Windows, download from https://github.com/MystenLabs/sui/releases.
2. **Re-run** `.\publish.ps1` (ensure testnet SUI for gas).
3. **Mainnet** – `.\publish.ps1 -Env mainnet`.

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
