#[test_only]
module rain::risk_engine_tests;

use pyth::i64;
use rain::risk_engine::{can_add_debt, compute_ltv, is_liquidatable};
use rain::user_vault;

#[test]
fun test_compute_ltv_zero_collateral_zero_debt() {
    let mut ctx = sui::tx_context::dummy();
    let custody_id = sui::object::id_from_address(@0x1);
    let vault = user_vault::create_vault_for_testing(custody_id, 8000, &mut ctx);
    let price = i64::new(200_000_000, false);
    let expo = i64::new(8, true);
    assert!(compute_ltv(&vault, &price, &expo) == 0, 0);
    assert!(!is_liquidatable(&vault, &price, &expo), 1);
    sui::transfer::public_transfer(vault, sui::tx_context::sender(&ctx));
}

#[test]
fun test_compute_ltv_zero_collateral_nonzero_debt() {
    let mut ctx = sui::tx_context::dummy();
    let custody_id = sui::object::id_from_address(@0x1);
    let mut vault = user_vault::create_vault_for_testing(custody_id, 8000, &mut ctx);
    user_vault::add_debt(&mut vault, 100);
    let price = i64::new(200_000_000, false);
    let expo = i64::new(8, true);
    assert!(compute_ltv(&vault, &price, &expo) == 10001, 0);
    assert!(is_liquidatable(&vault, &price, &expo), 1);
    sui::transfer::public_transfer(vault, sui::tx_context::sender(&ctx));
}

#[test]
fun test_ltv_and_liquidatable_with_collateral() {
    let mut ctx = sui::tx_context::dummy();
    let custody_id = sui::object::id_from_address(@0x1);
    // collateral_balance=100, debt=50. Price 2e8, expo -8 -> collateral_value = 100*200_000_000/10^8 = 200.
    // LTV = 50*10000/200 = 2500 bps. Threshold 8000 -> not liquidatable.
    let mut vault = user_vault::create_vault_for_testing(custody_id, 8000, &mut ctx);
    user_vault::set_collateral_balance_for_testing(&mut vault, 100);
    user_vault::add_debt(&mut vault, 50);
    let price = i64::new(200_000_000, false);
    let expo = i64::new(8, true);
    assert!(compute_ltv(&vault, &price, &expo) == 2500, 0);
    assert!(!is_liquidatable(&vault, &price, &expo), 1);
    // Same vault, threshold 2000 -> liquidatable (2500 >= 2000).
    let mut vault2 = user_vault::create_vault_for_testing(custody_id, 2000, &mut ctx);
    user_vault::set_collateral_balance_for_testing(&mut vault2, 100);
    user_vault::add_debt(&mut vault2, 50);
    assert!(compute_ltv(&vault2, &price, &expo) == 2500, 2);
    assert!(is_liquidatable(&vault2, &price, &expo), 3);
    sui::transfer::public_transfer(vault, sui::tx_context::sender(&ctx));
    sui::transfer::public_transfer(vault2, sui::tx_context::sender(&ctx));
}

/// RiskEngine can_add_debt: true when adding amount keeps LTV below threshold, false when it would exceed or cv is 0.
#[test]
fun test_can_add_debt_below_and_above_threshold() {
    let mut ctx = sui::tx_context::dummy();
    let custody_id = sui::object::id_from_address(@0x1);
    let price = i64::new(200_000_000, false);
    let expo = i64::new(8, true);
    // collateral_value = 100 * 2e8 / 10^8 = 200. Threshold 8000 (80%). Max debt for 80% LTV = 160.
    let mut vault = user_vault::create_vault_for_testing(custody_id, 8000, &mut ctx);
    user_vault::set_collateral_balance_for_testing(&mut vault, 100);
    user_vault::add_debt(&mut vault, 50);
    assert!(can_add_debt(&vault, 100, &price, &expo), 0);
    assert!(!can_add_debt(&vault, 111, &price, &expo), 1);
    assert!(!can_add_debt(&vault, 150, &price, &expo), 2);
    sui::transfer::public_transfer(vault, sui::tx_context::sender(&ctx));
}
