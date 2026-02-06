/// RiskEngine: read-only LTV and liquidatability. No asset movement.
/// Uses UserVault state + oracle price (from OracleAdapter). BorrowLimit = CollateralValue * (threshold_bps/10000).
module rain::risk_engine;

use pyth::i64;
use rain::user_vault;
use rain::user_vault::UserVault;

/// Compute collateral value in same scale as debt using oracle (price, expo). Uses u128 internally.
/// Same convention as adjudicator: price/expo from OracleAdapter::get_price (Pyth).
fun collateral_value_from_oracle(
    collateral_amount: u64,
    price: &i64::I64,
    expo: &i64::I64,
): u64 {
    let price_mag = if (i64::get_is_negative(price)) {
        i64::get_magnitude_if_negative(price)
    } else {
        i64::get_magnitude_if_positive(price)
    };
    let expo_neg = i64::get_is_negative(expo);
    let expo_mag = if (expo_neg) {
        i64::get_magnitude_if_negative(expo)
    } else {
        i64::get_magnitude_if_positive(expo)
    };
    let num = (collateral_amount as u128) * (price_mag as u128);
    if (expo_neg) {
        let denom = (std::u64::pow(10, (expo_mag as u8))) as u128;
        (num / denom) as u64
    } else {
        let scale = (std::u64::pow(10, (expo_mag as u8))) as u128;
        (num * scale) as u64
    }
}

/// LTV in basis points: (debt / collateral_value) * 10000.
/// If collateral_value is 0 and debt > 0, returns 10001 (treated as above any threshold).
/// Caller passes price/expo from OracleAdapter::get_price (or equivalent).
public fun compute_ltv(
    vault: &UserVault,
    price: &i64::I64,
    expo: &i64::I64,
): u64 {
    let collateral = user_vault::collateral_balance(vault);
    let debt = user_vault::debt(vault);
    let cv = collateral_value_from_oracle(collateral, price, expo);
    if (cv == 0) {
        if (debt > 0) {
            10001
        } else {
            0
        }
    } else {
        (((debt as u128) * 10000) / (cv as u128)) as u64
    }
}

/// True when LTV >= vault's liquidation_threshold_bps (BorrowLimit = CollateralValue * threshold).
/// No asset movement; used by Adjudicator / LiquidationEngine to decide authorization.
public fun is_liquidatable(
    vault: &UserVault,
    price: &i64::I64,
    expo: &i64::I64,
): bool {
    let ltv_bps = compute_ltv(vault, price, expo);
    let threshold_bps = user_vault::liquidation_threshold_bps(vault);
    ltv_bps >= threshold_bps
}

/// True if adding `amount` to vault debt would keep LTV below liquidation threshold.
/// Used by LendingMarketplace before opening a new position.
public fun can_add_debt(
    vault: &UserVault,
    amount: u64,
    price: &i64::I64,
    expo: &i64::I64,
): bool {
    let collateral = user_vault::collateral_balance(vault);
    let debt = user_vault::debt(vault);
    let new_debt = debt + amount;
    let cv = collateral_value_from_oracle(collateral, price, expo);
    if (cv == 0) {
        false
    } else {
        let ltv_bps = (((new_debt as u128) * 10000) / (cv as u128)) as u64;
        ltv_bps < user_vault::liquidation_threshold_bps(vault)
    }
}
