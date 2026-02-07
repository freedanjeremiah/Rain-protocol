/// Step 4.2 – Integration / E2E tests.
/// 1) Healthy flow: create vault → deposit → submit borrow/lend → match (partial fill) → vault debt = sum of positions → repay → Adjudicator → Custody release.
/// 2) Liquidation flow: vault becomes unhealthy → liquidate → Adjudicator → Custody release (sell via DeepBookAdapter not exercised in Move).
#[test_only]
module rain::integration_tests;

use sui::coin::Self;
use sui::object::id;
use sui::sui::SUI;
use sui::tx_context::{sender, dummy};
use pyth::i64;
use rain::adjudicator;
use rain::custody;
use rain::marketplace;
use rain::user_vault;

#[test]
/// E2E: create vault → deposit → submit borrow/lend → match (one partial fill) → vault debt = position principal → repay → Adjudicator → Custody release.
fun test_e2e_healthy_flow_deposit_match_repay_release() {
    let ctx = &mut dummy();
    let me = sender(ctx);

    // Create custody + user vault (80% liquidation threshold).
    let mut custody_vault = custody::create_vault_for_testing(ctx);
    let custody_id = id(&custody_vault);
    let mut vault = user_vault::create_vault_for_testing(custody_id, 8000, ctx);

    // Deposit 100 SUI collateral.
    let deposit_coin = coin::mint_for_testing<SUI>(100, ctx);
    user_vault::deposit_collateral(&mut vault, &mut custody_vault, deposit_coin, ctx);
    assert!(user_vault::collateral_balance(&vault) == 100, 0);
    assert!(custody::balance_value(&custody_vault) == 100, 1);

    // Create marketplace and orders (same sender as borrower and lender).
    let mut marketplace = marketplace::create_marketplace_for_testing(ctx);
    let borrow_order = marketplace::create_borrow_order_for_testing(me, id(&vault), 80, 500, 86400, ctx);
    let lend_order = marketplace::create_lend_order_for_testing(me, 80, 300, 86400, ctx);
    let borrow_order_id = id(&borrow_order);
    let lend_order_id = id(&lend_order);
    marketplace::submit_borrow_order(&mut marketplace, &vault, borrow_order, ctx);
    marketplace::submit_lend_order(&mut marketplace, lend_order, ctx);

    // Price 2e8, expo -8 → collateral value = 100 * 2e8 / 10^8 = 200. Fill 50 → LTV 25% < 80%.
    let price = i64::new(200000000, false);
    let expo = i64::new(8, true);
    let mut lender_coin = coin::mint_for_testing<SUI>(80, ctx);
    let position = marketplace::fill_order_for_testing(
        &mut marketplace,
        borrow_order_id,
        lend_order_id,
        50,
        &mut lender_coin,
        &mut vault,
        &price,
        &expo,
        ctx,
    );

    assert!(user_vault::debt(&vault) == 50, 2);
    assert!(marketplace::loan_position_principal(&position) == 50, 3);

    // Repay: borrower provides vault, position, and coin.
    let mut repay_coin = coin::mint_for_testing<SUI>(50, ctx);
    marketplace::repay_position(&mut vault, position, &mut repay_coin, ctx);
    assert!(user_vault::debt(&vault) == 0, 4);

    // Adjudicator → Custody release.
    let repayment_auth = user_vault::request_repayment_auth_returning(&vault, ctx);
    custody::release_to_owner(&mut custody_vault, repayment_auth, ctx);
    assert!(custody::balance_value(&custody_vault) == 0, 5);

    sui::transfer::public_transfer(custody_vault, me);
    sui::transfer::public_transfer(vault, me);
    sui::transfer::public_transfer(marketplace, me);
    sui::transfer::public_transfer(lender_coin, me);
    sui::transfer::public_transfer(repay_coin, me);
}

#[test]
/// E2E: vault unhealthy (LTV >= threshold) → Adjudicator authorizes liquidation → Custody release to liquidator.
/// Sell via DeepBookAdapter and repay debt + bonus are not exercised in this Move test (would need real pool).
fun test_e2e_liquidation_flow_release_to_liquidator() {
    let ctx = &mut dummy();
    let me = sender(ctx);

    // Custody + vault; 50% liquidation threshold.
    let mut custody_vault = custody::create_vault_for_testing(ctx);
    let custody_id = id(&custody_vault);
    let mut vault = user_vault::create_vault_for_testing(custody_id, 5000, ctx);

    // Deposit 100 SUI and mirror in vault; add debt 100 (simulate prior borrow).
    let deposit_coin = coin::mint_for_testing<SUI>(100, ctx);
    custody::deposit(&mut custody_vault, deposit_coin, ctx);
    user_vault::set_collateral_balance_for_testing(&mut vault, 100);
    user_vault::add_debt(&mut vault, 100);
    assert!(custody::balance_value(&custody_vault) == 100, 0);
    assert!(user_vault::debt(&vault) == 100, 1);

    // Price 2e8, expo -8 → collateral value = 200. LTV = 100/200 = 50% >= 50% → liquidatable.
    let price = i64::new(200000000, false);
    let expo = i64::new(8, true);
    let vault_state = adjudicator::create_vault_state(100, 100, 5000);
    let liquidation_auth = adjudicator::authorize_liquidation_returning_for_testing(
        id(&custody_vault),
        vault_state,
        &price,
        &expo,
        ctx,
    );

    custody::release_to_liquidator(&mut custody_vault, liquidation_auth, me, ctx);
    assert!(custody::balance_value(&custody_vault) == 0, 2);

    user_vault::zero_collateral_after_liquidation(&mut vault);
    sui::transfer::public_transfer(custody_vault, me);
    sui::transfer::public_transfer(vault, me);
}
