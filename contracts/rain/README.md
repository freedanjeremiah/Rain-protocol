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
| **Step 1.5** LoanOrder + LoanPosition | Done | `sources/marketplace.move`: BorrowOrder (with vault_id), LendOrder, LoanPosition; getters and package mutators for partial fills. |
| **Step 2.1** RiskEngine | Done | `sources/risk_engine.move`: `compute_ltv(vault, price, expo)`, `is_liquidatable(vault, price, expo)`. Read-only, no asset movement. |
| **Step 2.2** LiquidationEngine | Done | `sources/liquidation.move`: `liquidate(...)` – RiskEngine check → Adjudicator auth → Custody release to liquidator. |
| **Step 3.1** DeepBook API (Phase 3) | Done | Pool IDs and SUI/USDC for liquidations: see `scripts/config/README.md` and [DeepBook SDK](https://docs.sui.io/standards/deepbookv3-sdk/pools). |
| **Step 3.2** DeepBookAdapter (Move) | Done | `sources/deepbook_adapter.move`: (1) **Swap**: `swap_exact_base_for_quote` and `sell_collateral_for_quote` – take Pool + Coin&lt;Base&gt; + Coin&lt;DEEP&gt;, return (leftover_base, quote_out, deep_change), emit `SwapExecuted`. (2) **Orders**: `place_limit_order` and `place_market_order` – take Pool, BalanceManager, TradeProof, order params; return `OrderInfo`. No lending logic. |
| **Step 3.3** Wire LiquidationEngine to DeepBook | Done | Custody releases collateral to liquidator; liquidator calls `sell_collateral_and_settle` (same PTB): sells collateral on DeepBook via adapter, repays vault debt (min(debt, quote_out)), sends liquidator bonus (liquidator_bonus_bps of quote) to sender, remainder to vault owner; leftover base and DEEP to sender. `user_vault::zero_collateral_after_liquidation` called in `liquidate()` after release. |
| **Step 3.4** LendingMarketplace | Done | `sources/marketplace.move`: **Does not hold funds.** Shared `LendingMarketplace` (created in `init`) holds borrow/lend orders in tables. Entries: `create_borrow_order` / `create_lend_order` (user-facing), `submit_borrow_order(vault, order)` / `submit_lend_order(order)` store orders. `fill_order<T>(..., fill_amount, lender_coin, borrower_vault, oracle, clock, ...)`: in-Move match (rate/duration compatible, fill_size = min(remaining)); RiskEngine `can_add_debt` before opening position; principal lender→borrower (coin transfer to vault owner); create `LoanPosition` → lender; update both orders' `filled_amount`; `user_vault::add_debt`; remove and delete fully-filled orders. `risk_engine::can_add_debt` added for borrow-limit check. |
| **Step 3.5** Repayment and Adjudicator | Done | **Repayment**: `marketplace::repay_position<T>(vault, position, coin)` – borrower (vault owner) passes vault and coin; position is consumed (lender sends position to borrower to repay). Principal sent to `position.lender`, `user_vault::repay_debt`, position destroyed. **When debt = 0**: `user_vault::request_repayment_auth(vault)` – owner gets `RepaymentAuth` from Adjudicator; then `custody::release_to_owner(custody_vault, repayment_auth)` returns collateral. |
| **Step 4.1** Move unit tests | Done | **OracleAdapter**: module load + error code (real Pyth types; full E2E needs PriceInfoObject). **Adjudicator**: authorize_repayment when proof matches vault_id; expected_failure when proof is for wrong vault. **Custody**: release_to_owner rejects RepaymentAuth for wrong vault (EInvalidVault). **RiskEngine**: LTV and liquidation threshold (compute_ltv, is_liquidatable, can_add_debt). Run: `sui move test` in `contracts/rain`. |

- `Move.toml` – deps: local `deepbookv3` (deepbook, token); git Pyth (mainnet), Wormhole. Named address `rain = "0x0"`.
- `sources/rain.move` – placeholder.
- `sources/oracle_adapter.move`, `adjudicator.move`, `custody.move`, `user_vault.move`, `marketplace.move`, `risk_engine.move`, `liquidation.move`, `deepbook_adapter.move` – as above.
- `tests/*_tests.move` – unit tests for each module.
- **Phase 3 flow (Step 3.3)**: In one PTB: (1) `rain::liquidation::liquidate` – custody releases `Coin<SUI>` to liquidator, vault collateral zeroed. (2) `rain::liquidation::sell_collateral_and_settle<SUI, USDC>` – liquidator passes that SUI + pool + DEEP; adapter sells for USDC; debt repaid, liquidator bonus to sender, remainder to vault owner; leftover SUI and DEEP to sender.
- **Lending flow (Step 3.4)**: Borrower: `create_borrow_order(vault_id, amount, max_interest_bps, duration_secs)` → then `submit_borrow_order(marketplace, vault, order)`. Lender: `create_lend_order(amount, min_interest_bps, duration_secs)` → then `submit_lend_order(marketplace, order)`. Any caller can `fill_order<T>(marketplace, borrow_id, lend_id, fill_amount, lender_coin, borrower_vault, price_feed_id, price_info, clock, max_age_secs)` to execute a partial fill (principal to borrower, LoanPosition to lender, vault debt updated; RiskEngine enforces borrow limit).
- **Repayment flow (Step 3.5)**: Borrower repays per position: lender sends `LoanPosition` to borrower; borrower calls `marketplace::repay_position<T>(vault, position, coin)` (principal to lender, vault debt reduced, position destroyed). When vault debt = 0: owner calls `user_vault::request_repayment_auth(vault)` to receive `RepaymentAuth`, then `custody::release_to_owner(custody_vault, repayment_auth)` to withdraw collateral.

## Build & test

```bash
cd contracts/rain
sui move build
sui move test
```

From `deepbookv3` or when using path deps, use `--skip-fetch-latest-git-deps` with build if dependencies have not changed.

If build fails with **"Error parsing ... Move.toml: expected `.`, `=`"** (Pyth and Wormhole use `Move.mainnet.toml`), run the fix script then build again:

```powershell
./scripts/fix_pyth_manifest.ps1
sui move build --allow-dirty
```

Use `--skip-fetch-latest-git-deps` if dependencies haven’t changed.

## Publish and complete (testnet / mainnet)

1. **Publish** from `contracts/rain/scripts`:
   ```powershell
   .\publish.ps1                    # testnet
   .\publish.ps1 -Env mainnet       # mainnet
   ```
   Or one-off: `sui client publish . --gas-budget 800000000 --allow-dirty -e testnet` from `contracts/rain`.

2. **If you see "Failed to fetch package Pyth"**: the on-chain Pyth dependency is missing on the target network. Use `.\publish.ps1 -SkipDependencyVerification` or publish to the network where Pyth is deployed. See `scripts/config/README.md`.

3. **After a successful publish**: the script writes `scripts/config/published.json` with `packageId` and `lendingMarketplaceId`. Set the frontend env:
   ```bash
   # frontend/.env
   NEXT_PUBLIC_RAIN_PACKAGE_ID=<packageId from published.json>
   ```
   Restart the Next app so the vault/deposit pages use the deployed package.
