/// LiquidationEngine: verify liquidatability, release collateral, and (Step 3.3) wire to DeepBook:
/// liquidator receives collateral then calls sell_collateral_and_settle to sell on DeepBook, repay vault debt, and take bonus.
module rain::liquidation;

use sui::clock::Clock;
use sui::coin::{Coin, split, value};
use sui::tx_context::sender;
use pyth::price_info::PriceInfoObject;
use token::deep::DEEP;
use deepbook::pool;
use rain::adjudicator;
use rain::custody;
use rain::custody::CustodyVault;
use rain::deepbook_adapter;
use rain::oracle_adapter;
use rain::risk_engine;
use rain::user_vault;
use rain::user_vault::UserVault;

// === Errors ===
const EVaultCustodyMismatch: u64 = 1;
const ENotLiquidatable: u64 = 2;

/// Liquidate a vault: confirm via RiskEngine, get LiquidationAuth from Adjudicator, release collateral to liquidator.
/// Collateral is sent to the transaction sender (liquidator). Selling collateral (e.g. via DeepBook) is Phase 3.
///
/// Caller must pass the UserVault and CustodyVault for the same position (custody_id must match).
/// `collateral_price_feed_id`: Pyth price feed id for collateral (e.g. SUI/USD).
/// `max_age_secs`: max allowed age of oracle price in seconds (e.g. 60).
public fun liquidate(
    user_vault: &mut UserVault,
    custody_vault: &mut CustodyVault,
    collateral_price_feed_id: vector<u8>,
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    max_age_secs: u64,
    ctx: &mut TxContext,
) {
    assert!(user_vault::custody_id(user_vault) == sui::object::id(custody_vault), EVaultCustodyMismatch);

    user_vault::sync_collateral_from_custody(user_vault, custody_vault);

    let (price, expo) = oracle_adapter::get_price(
        collateral_price_feed_id,
        price_info_object,
        clock,
        max_age_secs,
    );
    assert!(risk_engine::is_liquidatable(user_vault, &price, &expo), ENotLiquidatable);

    let vault_state = adjudicator::create_vault_state(
        user_vault::collateral_balance(user_vault),
        user_vault::debt(user_vault),
        user_vault::liquidation_threshold_bps(user_vault),
    );

    let auth = adjudicator::authorize_liquidation_returning(
        user_vault::custody_id(user_vault),
        collateral_price_feed_id,
        price_info_object,
        clock,
        vault_state,
        max_age_secs,
        ctx,
    );

    custody::release_to_liquidator(custody_vault, auth, sender(ctx), ctx);
    user_vault::zero_collateral_after_liquidation(user_vault);
    // Phase 3: liquidator receives Coin<SUI>. In same tx call sell_collateral_and_settle to sell on DeepBook,
    // repay vault debt, and receive liquidator bonus.
}

/// Sell collateral (e.g. Coin<SUI>) on DeepBook for quote (e.g. USDC), use proceeds to repay vault debt and send liquidator bonus.
/// Call this in the same PTB after liquidate(): pass the Coin<BaseAsset> received from custody and DEEP for fees.
/// - Repays min(debt, quote_out) from the vault's debt.
/// - Sends liquidator_bonus_bps of quote_out (capped at 10000 bps) to the transaction sender.
/// - Sends the remaining quote to the vault owner.
/// - Returns leftover base and DEEP to the sender.
public fun sell_collateral_and_settle<BaseAsset, QuoteAsset>(
    user_vault: &mut UserVault,
    pool: &mut pool::Pool<BaseAsset, QuoteAsset>,
    collateral: Coin<BaseAsset>,
    deep_in: Coin<DEEP>,
    min_quote_out: u64,
    liquidator_bonus_bps: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let (base_left, mut quote_coin, deep_out) = deepbook_adapter::swap_exact_base_for_quote(
        pool,
        collateral,
        deep_in,
        min_quote_out,
        clock,
        ctx,
    );
    let debt = user_vault::debt(user_vault);
    let quote_amount = value(&quote_coin);
    let repay_amount = if (debt < quote_amount) { debt } else { quote_amount };
    user_vault::repay_debt(user_vault, repay_amount);

    let bonus_bps = if (liquidator_bonus_bps > 10000) { 10000 } else { liquidator_bonus_bps };
    let bonus_raw = (((quote_amount as u128) * (bonus_bps as u128)) / 10000) as u64;
    let bonus = if (bonus_raw > quote_amount) { quote_amount } else { bonus_raw };
    let bonus_coin = split(&mut quote_coin, bonus, ctx);
    let owner = user_vault::owner(user_vault);
    sui::transfer::public_transfer(bonus_coin, sender(ctx));
    sui::transfer::public_transfer(quote_coin, owner);
    sui::transfer::public_transfer(base_left, sender(ctx));
    sui::transfer::public_transfer(deep_out, sender(ctx));
}
