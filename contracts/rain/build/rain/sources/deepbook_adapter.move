// Copyright (c) Rain Protocol.
// SPDX-License-Identifier: Apache-2.0

/// DeepBook adapter: thin wrapper for selling collateral (e.g. SUI) for quote (e.g. USDC) on DeepBook.
/// Used by liquidators after receiving Coin<SUI> from rain::liquidation::liquidate.
/// Uses the same API as deepbook pool: swap_exact_base_for_quote (no BalanceManager; direct swap with DEEP for fees).
module rain::deepbook_adapter;

use sui::clock::Clock;
use sui::coin::Coin;
use token::deep::DEEP;
use deepbook::pool;

/// Sell base (e.g. SUI collateral) for quote (e.g. USDC) on DeepBook. No BalanceManager required.
/// Caller must pass the Pool<BaseAsset, QuoteAsset> (e.g. mainnet SUI/USDC pool) and DEEP for taker fees.
/// Returns (leftover_base, quote_out, deep_change). Some base may be left over if not divisible by lot size.
///
/// For liquidations: after rain::liquidation::liquidate sends Coin<SUI> to the liquidator, the liquidator
/// calls this with the SUI coin, a small DEEP coin for fees, and the SUI/USDC pool to receive USDC.
public fun swap_exact_base_for_quote<BaseAsset, QuoteAsset>(
    pool: &mut pool::Pool<BaseAsset, QuoteAsset>,
    base_in: Coin<BaseAsset>,
    deep_in: Coin<DEEP>,
    min_quote_out: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): (Coin<BaseAsset>, Coin<QuoteAsset>, Coin<DEEP>) {
    pool::swap_exact_base_for_quote(pool, base_in, deep_in, min_quote_out, clock, ctx)
}
