// Copyright (c) Rain Protocol.
// SPDX-License-Identifier: Apache-2.0

/// DeepBook adapter (Step 3.2): thin wrapper over DeepBook pool for submit order / swap and read result.
/// - Swap: sell base (e.g. SUI) for quote (e.g. USDC); no BalanceManager. Emits SwapExecuted.
/// - Orders: place_limit_order and place_market_order with Pool + BalanceManager + TradeProof; returns OrderInfo (fill info).
/// No lending logic; only "submit order / swap" and "read result."
module rain::deepbook_adapter;

use sui::clock::Clock;
use sui::coin::{Coin, value};
use sui::event;
use token::deep::DEEP;
use deepbook::balance_manager::{BalanceManager, TradeProof};
use deepbook::order_info::OrderInfo;
use deepbook::pool;

// === Events ===

/// Emitted after a swap; records amounts for indexers / liquidations.
public struct SwapExecuted has copy, drop, store {
    pool_id: ID,
    base_in: u64,
    quote_out: u64,
}

// === Swap (no BalanceManager) ===

/// Sell base (e.g. SUI collateral) for quote (e.g. USDC) on DeepBook. No BalanceManager required.
/// Caller passes Pool<BaseAsset, QuoteAsset> and DEEP for taker fees.
/// Returns (leftover_base, quote_out, deep_change). Emits SwapExecuted with amounts.
///
/// For liquidations: after rain::liquidation::liquidate sends Coin<SUI> to the liquidator,
/// call this with the SUI coin, DEEP for fees, and the SUI/USDC pool to receive Coin<USDC>.
public fun swap_exact_base_for_quote<BaseAsset, QuoteAsset>(
    pool: &mut pool::Pool<BaseAsset, QuoteAsset>,
    base_in: Coin<BaseAsset>,
    deep_in: Coin<DEEP>,
    min_quote_out: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): (Coin<BaseAsset>, Coin<QuoteAsset>, Coin<DEEP>) {
    let base_in_amount = value(&base_in);
    let (base_out, quote_out_coin, deep_out) =
        pool::swap_exact_base_for_quote(pool, base_in, deep_in, min_quote_out, clock, ctx);
    let quote_out_amount = value(&quote_out_coin);
    event::emit(SwapExecuted {
        pool_id: sui::object::id(pool),
        base_in: base_in_amount,
        quote_out: quote_out_amount,
    });
    (base_out, quote_out_coin, deep_out)
}

/// Liquidation sell: same as swap_exact_base_for_quote; use for selling seized SUI for USDC.
/// Returns (leftover_base, quote_out, deep_change) and emits SwapExecuted.
public fun sell_collateral_for_quote<BaseAsset, QuoteAsset>(
    pool: &mut pool::Pool<BaseAsset, QuoteAsset>,
    base_in: Coin<BaseAsset>,
    deep_in: Coin<DEEP>,
    min_quote_out: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): (Coin<BaseAsset>, Coin<QuoteAsset>, Coin<DEEP>) {
    swap_exact_base_for_quote(pool, base_in, deep_in, min_quote_out, clock, ctx)
}

// === Orders (BalanceManager + TradeProof) ===

/// Place a limit order on DeepBook. Returns OrderInfo (fill info: order_id, executed_quantity, cumulative_quote_quantity, status, etc.).
public fun place_limit_order<BaseAsset, QuoteAsset>(
    pool: &mut pool::Pool<BaseAsset, QuoteAsset>,
    balance_manager: &mut BalanceManager,
    trade_proof: &TradeProof,
    client_order_id: u64,
    order_type: u8,
    self_matching_option: u8,
    price: u64,
    quantity: u64,
    is_bid: bool,
    pay_with_deep: bool,
    expire_timestamp: u64,
    clock: &Clock,
    ctx: &TxContext,
): OrderInfo {
    pool::place_limit_order(
        pool,
        balance_manager,
        trade_proof,
        client_order_id,
        order_type,
        self_matching_option,
        price,
        quantity,
        is_bid,
        pay_with_deep,
        expire_timestamp,
        clock,
        ctx,
    )
}

/// Place a market order on DeepBook. Returns OrderInfo (fill info).
public fun place_market_order<BaseAsset, QuoteAsset>(
    pool: &mut pool::Pool<BaseAsset, QuoteAsset>,
    balance_manager: &mut BalanceManager,
    trade_proof: &TradeProof,
    client_order_id: u64,
    self_matching_option: u8,
    quantity: u64,
    is_bid: bool,
    pay_with_deep: bool,
    clock: &Clock,
    ctx: &TxContext,
): OrderInfo {
    pool::place_market_order(
        pool,
        balance_manager,
        trade_proof,
        client_order_id,
        self_matching_option,
        quantity,
        is_bid,
        pay_with_deep,
        clock,
        ctx,
    )
}
