# Rain scripts config

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
