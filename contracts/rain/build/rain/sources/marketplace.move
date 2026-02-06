/// Marketplace order and position data structures. Supports partial fills:
/// filled_amount tracks sum of fills; each fill creates a LoanPosition. No matching logic yet.
module rain::marketplace;

// === Order types (partial-fill aware) ===

/// Borrow order: total amount, filled_amount updated on each partial fill. remaining = amount - filled_amount.
public struct BorrowOrder has key, store {
    id: UID,
    borrower: address,
    amount: u64,
    filled_amount: u64,
    max_interest_bps: u64,
    duration_secs: u64,
}

/// Lend order: total amount, filled_amount updated on each partial fill.
public struct LendOrder has key, store {
    id: UID,
    lender: address,
    amount: u64,
    filled_amount: u64,
    min_interest_bps: u64,
    duration_secs: u64,
}

/// One per partial fill. Vault debt = sum of principals (and interest) of all positions for that vault.
public struct LoanPosition has key, store {
    id: UID,
    borrower: address,
    lender: address,
    principal: u64,
    rate_bps: u64,
    term_secs: u64,
    vault_id: ID,
}

// === Getters (BorrowOrder) ===

public fun borrow_order_borrower(order: &BorrowOrder): address {
    order.borrower
}

public fun borrow_order_amount(order: &BorrowOrder): u64 {
    order.amount
}

public fun borrow_order_filled_amount(order: &BorrowOrder): u64 {
    order.filled_amount
}

public fun borrow_order_remaining(order: &BorrowOrder): u64 {
    order.amount - order.filled_amount
}

public fun borrow_order_max_interest_bps(order: &BorrowOrder): u64 {
    order.max_interest_bps
}

public fun borrow_order_duration_secs(order: &BorrowOrder): u64 {
    order.duration_secs
}

// === Getters (LendOrder) ===

public fun lend_order_lender(order: &LendOrder): address {
    order.lender
}

public fun lend_order_amount(order: &LendOrder): u64 {
    order.amount
}

public fun lend_order_filled_amount(order: &LendOrder): u64 {
    order.filled_amount
}

public fun lend_order_remaining(order: &LendOrder): u64 {
    order.amount - order.filled_amount
}

public fun lend_order_min_interest_bps(order: &LendOrder): u64 {
    order.min_interest_bps
}

public fun lend_order_duration_secs(order: &LendOrder): u64 {
    order.duration_secs
}

// === Getters (LoanPosition) ===

public fun loan_position_borrower(pos: &LoanPosition): address {
    pos.borrower
}

public fun loan_position_lender(pos: &LoanPosition): address {
    pos.lender
}

public fun loan_position_principal(pos: &LoanPosition): u64 {
    pos.principal
}

public fun loan_position_rate_bps(pos: &LoanPosition): u64 {
    pos.rate_bps
}

public fun loan_position_term_secs(pos: &LoanPosition): u64 {
    pos.term_secs
}

public fun loan_position_vault_id(pos: &LoanPosition): ID {
    pos.vault_id
}

// === Package-only mutators (for LendingMarketplace logic later) ===

public(package) fun borrow_order_add_filled(order: &mut BorrowOrder, fill_amount: u64) {
    order.filled_amount = order.filled_amount + fill_amount;
}

public(package) fun lend_order_add_filled(order: &mut LendOrder, fill_amount: u64) {
    order.filled_amount = order.filled_amount + fill_amount;
}

#[test_only]
public fun create_borrow_order_for_testing(
    borrower: address,
    amount: u64,
    max_interest_bps: u64,
    duration_secs: u64,
    ctx: &mut TxContext,
): BorrowOrder {
    BorrowOrder {
        id: sui::object::new(ctx),
        borrower,
        amount,
        filled_amount: 0,
        max_interest_bps,
        duration_secs,
    }
}

#[test_only]
public fun create_lend_order_for_testing(
    lender: address,
    amount: u64,
    min_interest_bps: u64,
    duration_secs: u64,
    ctx: &mut TxContext,
): LendOrder {
    LendOrder {
        id: sui::object::new(ctx),
        lender,
        amount,
        filled_amount: 0,
        min_interest_bps,
        duration_secs,
    }
}

#[test_only]
public fun create_loan_position_for_testing(
    borrower: address,
    lender: address,
    principal: u64,
    rate_bps: u64,
    term_secs: u64,
    vault_id: ID,
    ctx: &mut TxContext,
): LoanPosition {
    LoanPosition {
        id: sui::object::new(ctx),
        borrower,
        lender,
        principal,
        rate_bps,
        term_secs,
        vault_id,
    }
}
