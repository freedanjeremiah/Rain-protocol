/// LiquidationEngine: one-entry flow to verify liquidatability, get LiquidationAuth, and release collateral.
/// Selling collateral (e.g. via DeepBook) is Phase 3; for now collateral is transferred to the liquidator.
module rain::liquidation;

use sui::clock::Clock;
use sui::tx_context::sender;
use pyth::price_info::PriceInfoObject;
use rain::adjudicator;
use rain::custody;
use rain::custody::CustodyVault;
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
    // Phase 3: liquidator receives Coin<SUI> here; sell via DeepBookAdapter / DeepBook when implemented.
}
