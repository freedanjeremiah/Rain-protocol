#[test_only]
module rain::marketplace_tests;

use rain::marketplace::{
    create_borrow_order_for_testing,
    create_lend_order_for_testing,
    create_loan_position_for_testing,
    borrow_order_borrower,
    borrow_order_amount,
    borrow_order_filled_amount,
    borrow_order_remaining,
    borrow_order_max_interest_bps,
    borrow_order_duration_secs,
    borrow_order_vault_id,
    lend_order_lender,
    lend_order_amount,
    lend_order_filled_amount,
    lend_order_remaining,
    lend_order_min_interest_bps,
    lend_order_duration_secs,
    loan_position_borrower,
    loan_position_lender,
    loan_position_principal,
    loan_position_rate_bps,
    loan_position_term_secs,
    loan_position_vault_id,
    borrow_order_add_filled,
    lend_order_add_filled,
};

#[test]
fun test_borrow_order_getters() {
    let mut ctx = sui::tx_context::dummy();
    let borrower = @0x1234;
    let vault_id = sui::object::id_from_address(@0xabcd);
    let order = create_borrow_order_for_testing(borrower, vault_id, 1000, 500, 86400, &mut ctx);
    assert!(borrow_order_borrower(&order) == borrower, 0);
    assert!(borrow_order_amount(&order) == 1000, 1);
    assert!(borrow_order_filled_amount(&order) == 0, 2);
    assert!(borrow_order_remaining(&order) == 1000, 3);
    assert!(borrow_order_max_interest_bps(&order) == 500, 4);
    assert!(borrow_order_duration_secs(&order) == 86400, 5);
    assert!(borrow_order_vault_id(&order) == vault_id, 6);
    sui::transfer::public_transfer(order, sui::tx_context::sender(&ctx));
}

#[test]
fun test_lend_order_getters() {
    let mut ctx = sui::tx_context::dummy();
    let lender = @0x5678;
    let order = create_lend_order_for_testing(lender, 2000, 300, 86400, &mut ctx);
    assert!(lend_order_lender(&order) == lender, 0);
    assert!(lend_order_amount(&order) == 2000, 1);
    assert!(lend_order_filled_amount(&order) == 0, 2);
    assert!(lend_order_remaining(&order) == 2000, 3);
    assert!(lend_order_min_interest_bps(&order) == 300, 4);
    assert!(lend_order_duration_secs(&order) == 86400, 5);
    sui::transfer::public_transfer(order, sui::tx_context::sender(&ctx));
}

#[test]
fun test_loan_position_getters() {
    let mut ctx = sui::tx_context::dummy();
    let borrower = @0x1234;
    let lender = @0x5678;
    let vault_id = sui::object::id_from_address(@0xabcd);
    let pos = create_loan_position_for_testing(
        borrower,
        lender,
        500,
        400,
        86400,
        vault_id,
        &mut ctx,
    );
    assert!(loan_position_borrower(&pos) == borrower, 0);
    assert!(loan_position_lender(&pos) == lender, 1);
    assert!(loan_position_principal(&pos) == 500, 2);
    assert!(loan_position_rate_bps(&pos) == 400, 3);
    assert!(loan_position_term_secs(&pos) == 86400, 4);
    assert!(loan_position_vault_id(&pos) == vault_id, 5);
    sui::transfer::public_transfer(pos, sui::tx_context::sender(&ctx));
}

#[test]
fun test_partial_fill_mutators() {
    let mut ctx = sui::tx_context::dummy();
    let borrower = @0x1234;
    let lender = @0x5678;
    let vault_id = sui::object::id_from_address(@0xabcd);
    let mut borrow_order = create_borrow_order_for_testing(borrower, vault_id, 1000, 500, 86400, &mut ctx);
    let mut lend_order = create_lend_order_for_testing(lender, 2000, 300, 86400, &mut ctx);
    borrow_order_add_filled(&mut borrow_order, 300);
    lend_order_add_filled(&mut lend_order, 300);
    assert!(borrow_order_filled_amount(&borrow_order) == 300, 0);
    assert!(borrow_order_remaining(&borrow_order) == 700, 1);
    assert!(lend_order_filled_amount(&lend_order) == 300, 2);
    assert!(lend_order_remaining(&lend_order) == 1700, 3);
    sui::transfer::public_transfer(borrow_order, sui::tx_context::sender(&ctx));
    sui::transfer::public_transfer(lend_order, sui::tx_context::sender(&ctx));
}
