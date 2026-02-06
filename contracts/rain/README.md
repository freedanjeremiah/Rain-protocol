# Rain Move Package

Non-custodial P2P orderbook lending protocol on Sui. See repo root [readme.md](../../readme.md).

## Prerequisites (Step 0.1)

- **Sui CLI**: Install and use the same version as `deepbookv3` (see `deepbookv3/README.md` or `deepbookv3/packages/deepbook/Move.toml`).
- **Move 2024**: This package uses `edition = "2024.beta"` in `Move.toml`.
- **Patterns**: Follow the conventions in `deepbookv3/.claude/rules/move.md` (error constants `EPascalCase`, module label style, composable functions, etc.).

## Layout & spec recap

| Spec step | Status | Implementation |
|-----------|--------|----------------|
| **Step 0.2** Rain Move package | Done | `contracts/rain/` with `edition = "2024.beta"`, path deps to `deepbookv3` (deepbook, token), Pyth (git, mainnet), `rain = "0x0"`. |
| **Step 0.3** Mainnet | Done | Pyth `rev = "sui-contract-mainnet"`; scripts/RPC target mainnet. |
| **Step 1.1** OracleAdapter | Done | `sources/oracle_adapter.move`: wraps Pyth, `get_price(feed_id, PriceInfoObject, Clock, max_age_secs)` → (price, expo). No custody. |
| **Step 1.2** Adjudicator | Done | `sources/adjudicator.move`: RepaymentAuth, LiquidationAuth, VaultState; `authorize_repayment`, `authorize_liquidation`, `authorize_liquidation_returning`, `create_vault_state`. No assets. |
| **Step 1.3** Custody | Done | `sources/custody.move`: CustodyVault, `deposit`, `release_to_owner(RepaymentAuth)`, `release_to_liquidator(LiquidationAuth, liquidator)`, `withdraw_healthy(RepaymentProof)`. No LTV logic. |
| **Step 1.4** UserVault | Done | `sources/user_vault.move`: UserVault (owner, custody_id, collateral_balance, debt, liquidation_threshold_bps); `create_vault`, `deposit_collateral`; debt updated by LendingMarketplace. |
| **Step 1.5** LoanOrder + LoanPosition | Done | `sources/marketplace.move`: BorrowOrder, LendOrder, LoanPosition (data only); getters and package mutators for partial fills. No matching logic yet. |
| **Step 2.1** RiskEngine | Done | `sources/risk_engine.move`: `compute_ltv(vault, price, expo)`, `is_liquidatable(vault, price, expo)`. Read-only, no asset movement. |
| **Step 2.2** LiquidationEngine | Done | `sources/liquidation.move`: `liquidate(...)` – RiskEngine check → Adjudicator auth → Custody release to liquidator. |
| **Step 3.1** DeepBook API (Phase 3) | Done | Pool IDs and SUI/USDC for liquidations: see `scripts/config/README.md` and [DeepBook SDK](https://docs.sui.io/standards/deepbookv3-sdk/pools). |
| **Step 3.2** DeepBookAdapter (Move) | Done | `sources/deepbook_adapter.move`: (1) **Swap**: `swap_exact_base_for_quote` and `sell_collateral_for_quote` – take Pool + Coin&lt;Base&gt; + Coin&lt;DEEP&gt;, return (leftover_base, quote_out, deep_change), emit `SwapExecuted`. (2) **Orders**: `place_limit_order` and `place_market_order` – take Pool, BalanceManager, TradeProof, order params; return `OrderInfo`. No lending logic. |
| **Step 3.3** Wire LiquidationEngine to DeepBook | Done | Custody releases collateral to liquidator; liquidator calls `sell_collateral_and_settle` (same PTB): sells collateral on DeepBook via adapter, repays vault debt (min(debt, quote_out)), sends liquidator bonus (liquidator_bonus_bps of quote) to sender, remainder to vault owner; leftover base and DEEP to sender. `user_vault::zero_collateral_after_liquidation` called in `liquidate()` after release. |

- `Move.toml` – deps: local `deepbookv3` (deepbook, token); git Pyth (mainnet), Wormhole. Named address `rain = "0x0"`.
- `sources/rain.move` – placeholder.
- `sources/oracle_adapter.move`, `adjudicator.move`, `custody.move`, `user_vault.move`, `marketplace.move`, `risk_engine.move`, `liquidation.move`, `deepbook_adapter.move` – as above.
- `tests/*_tests.move` – unit tests for each module.
- **Phase 3 flow (Step 3.3)**: In one PTB: (1) `rain::liquidation::liquidate` – custody releases `Coin<SUI>` to liquidator, vault collateral zeroed. (2) `rain::liquidation::sell_collateral_and_settle<SUI, USDC>` – liquidator passes that SUI + pool + DEEP; adapter sells for USDC; debt repaid, liquidator bonus to sender, remainder to vault owner; leftover SUI and DEEP to sender.

## Build & test

```bash
cd contracts/rain
sui move build
sui move test
```

If build fails with **"Error parsing ... Move.toml: expected `.`, `=`"** (Pyth and Wormhole use `Move.mainnet.toml`), run the fix script then build again:

```powershell
./scripts/fix_pyth_manifest.ps1
sui move build --allow-dirty
```

Use `--skip-fetch-latest-git-deps` if dependencies haven’t changed.
