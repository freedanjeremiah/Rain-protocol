#[test_only]
module rain::escrow_tests;

use sui::coin::{Self, value};
use sui::sui::SUI;
use sui::object::id;
use sui::tx_context::{sender, dummy};
use rain::escrow;
use rain::marketplace;

// === Getter tests ===

#[test]
fun test_fill_request_getters() {
    let ctx = &mut dummy();
    let me = sender(ctx);
    let borrow_id = sui::object::id_from_address(@0xB);
    let lend_id = sui::object::id_from_address(@0xC);
    let vault_id = sui::object::id_from_address(@0xD);
    let locked = coin::mint_for_testing<SUI>(500, ctx);

    let req = escrow::create_fill_request_for_testing(
        borrow_id, lend_id, 500, me, @0xA1, vault_id, 99999, locked, ctx,
    );

    assert!(escrow::borrow_order_id(&req) == borrow_id, 0);
    assert!(escrow::lend_order_id(&req) == lend_id, 1);
    assert!(escrow::fill_amount(&req) == 500, 2);
    assert!(escrow::lender(&req) == me, 3);
    assert!(escrow::borrower(&req) == @0xA1, 4);
    assert!(escrow::vault_id(&req) == vault_id, 5);
    assert!(escrow::expiry_ms(&req) == 99999, 6);
    assert!(escrow::status(&req) == 0, 7);
    assert!(escrow::locked_amount(&req) == 500, 8);

    escrow::destroy_fill_request_for_testing(req);
}

// === Cancel tests ===

#[test]
fun test_lender_cancel_after_expiry() {
    let ctx = &mut dummy();
    let me = sender(ctx);
    let borrow_id = sui::object::id_from_address(@0xB);
    let lend_id = sui::object::id_from_address(@0xC);
    let vault_id = sui::object::id_from_address(@0xD);
    let locked = coin::mint_for_testing<SUI>(1000, ctx);

    let mut req = escrow::create_fill_request_for_testing(
        borrow_id, lend_id, 1000, me, @0xA1, vault_id, 5000, locked, ctx,
    );

    // Clock past expiry
    let mut clock = sui::clock::create_for_testing(ctx);
    sui::clock::set_for_testing(&mut clock, 5000);

    escrow::lender_cancel_fill(&mut req, &clock, ctx);

    assert!(escrow::status(&req) == 2, 0); // CANCELLED
    assert!(escrow::locked_amount(&req) == 0, 1);

    sui::clock::destroy_for_testing(clock);
    escrow::destroy_fill_request_for_testing(req);
}

#[test]
#[expected_failure(abort_code = escrow::ENotExpired)]
fun test_lender_cancel_before_expiry_fails() {
    let ctx = &mut dummy();
    let me = sender(ctx);
    let borrow_id = sui::object::id_from_address(@0xB);
    let lend_id = sui::object::id_from_address(@0xC);
    let vault_id = sui::object::id_from_address(@0xD);
    let locked = coin::mint_for_testing<SUI>(1000, ctx);

    let mut req = escrow::create_fill_request_for_testing(
        borrow_id, lend_id, 1000, me, @0xA1, vault_id, 5000, locked, ctx,
    );

    // Clock before expiry
    let mut clock = sui::clock::create_for_testing(ctx);
    sui::clock::set_for_testing(&mut clock, 4999);

    escrow::lender_cancel_fill(&mut req, &clock, ctx); // should abort

    sui::clock::destroy_for_testing(clock);
    escrow::destroy_fill_request_for_testing(req);
}

#[test]
#[expected_failure(abort_code = escrow::ENotPending)]
fun test_cancel_already_cancelled_fails() {
    let ctx = &mut dummy();
    let me = sender(ctx);
    let borrow_id = sui::object::id_from_address(@0xB);
    let lend_id = sui::object::id_from_address(@0xC);
    let vault_id = sui::object::id_from_address(@0xD);
    let locked = coin::mint_for_testing<SUI>(1000, ctx);

    let mut req = escrow::create_fill_request_for_testing(
        borrow_id, lend_id, 1000, me, @0xA1, vault_id, 5000, locked, ctx,
    );

    let mut clock = sui::clock::create_for_testing(ctx);
    sui::clock::set_for_testing(&mut clock, 5000);
    escrow::lender_cancel_fill(&mut req, &clock, ctx); // first cancel succeeds

    escrow::lender_cancel_fill(&mut req, &clock, ctx); // second cancel should abort

    sui::clock::destroy_for_testing(clock);
    escrow::destroy_fill_request_for_testing(req);
}

// === Commit tests ===

#[test]
fun test_lender_commit_fill_success() {
    let ctx = &mut dummy();
    let me = sender(ctx);

    // Create marketplace with vault and orders
    let mut marketplace = marketplace::create_marketplace_for_testing(ctx);
    let custody_vault = rain::custody::create_vault_for_testing(ctx);
    let custody_id = id(&custody_vault);
    let vault = rain::user_vault::create_vault_for_testing(custody_id, 8000, ctx);

    let borrow_order = marketplace::create_borrow_order_for_testing(
        me, id(&vault), 1000, 500, 86400, ctx,
    );
    let lend_order = marketplace::create_lend_order_for_testing(me, 1000, 300, 86400, ctx);
    let bo_id = id(&borrow_order);
    let lo_id = id(&lend_order);

    marketplace::submit_borrow_order(&mut marketplace, &vault, borrow_order, ctx);
    marketplace::submit_lend_order(&mut marketplace, lend_order, ctx);

    // Commit fill
    let mut lender_coin = coin::mint_for_testing<SUI>(2000, ctx);
    let mut clock = sui::clock::create_for_testing(ctx);
    sui::clock::set_for_testing(&mut clock, 1000);

    escrow::lender_commit_fill(
        &marketplace, bo_id, lo_id, 500, &mut lender_coin, 60, &clock, ctx,
    );

    // Lender coin should be reduced by 500
    assert!(value(&lender_coin) == 1500, 0);

    sui::clock::destroy_for_testing(clock);
    sui::transfer::public_transfer(lender_coin, me);
    sui::transfer::public_transfer(marketplace, me);
    sui::transfer::public_transfer(vault, me);
    sui::transfer::public_transfer(custody_vault, me);
}

#[test]
#[expected_failure(abort_code = escrow::EFillAmountExceeds)]
fun test_lender_commit_fill_exceeds_remaining() {
    let ctx = &mut dummy();
    let me = sender(ctx);

    let mut marketplace = marketplace::create_marketplace_for_testing(ctx);
    let custody_vault = rain::custody::create_vault_for_testing(ctx);
    let custody_id = id(&custody_vault);
    let vault = rain::user_vault::create_vault_for_testing(custody_id, 8000, ctx);

    let borrow_order = marketplace::create_borrow_order_for_testing(
        me, id(&vault), 100, 500, 86400, ctx,
    );
    let lend_order = marketplace::create_lend_order_for_testing(me, 100, 300, 86400, ctx);
    let bo_id = id(&borrow_order);
    let lo_id = id(&lend_order);

    marketplace::submit_borrow_order(&mut marketplace, &vault, borrow_order, ctx);
    marketplace::submit_lend_order(&mut marketplace, lend_order, ctx);

    let mut lender_coin = coin::mint_for_testing<SUI>(2000, ctx);
    let mut clock = sui::clock::create_for_testing(ctx);
    sui::clock::set_for_testing(&mut clock, 1000);

    // Try to commit 200 when only 100 remaining
    escrow::lender_commit_fill(
        &marketplace, bo_id, lo_id, 200, &mut lender_coin, 60, &clock, ctx,
    );

    sui::clock::destroy_for_testing(clock);
    sui::transfer::public_transfer(lender_coin, me);
    sui::transfer::public_transfer(marketplace, me);
    sui::transfer::public_transfer(vault, me);
    sui::transfer::public_transfer(custody_vault, me);
}
