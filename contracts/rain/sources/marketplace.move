/// Marketplace order and position data structures. Supports partial fills:
/// submit_borrow_order / submit_lend_order store orders in shared LendingMarketplace;
/// fill_order matches and settles (principal lender→borrower, LoanPosition to lender, vault debt updated).
/// Does not hold funds; RiskEngine enforces borrow limits before opening positions.
module rain::marketplace;

use sui::clock::Clock;
use sui::coin::{Coin, split, value};
use sui::table::{Self, Table};
use sui::tx_context::sender;
use pyth::price_info::PriceInfoObject;
use rain::oracle_adapter;
use rain::risk_engine;
use rain::user_vault;
use rain::user_vault::UserVault;

// === Errors ===
const ENotBorrower: u64 = 1;
const ENotLender: u64 = 2;
const EVaultMismatch: u64 = 3;
const EOrderNotFound: u64 = 4;
const EFillAmount: u64 = 5;
const ERateMismatch: u64 = 6;
const EDurationMismatch: u64 = 7;
const EBorrowLimitExceeded: u64 = 8;
const EInsufficientCoin: u64 = 9;

// === Order types (partial-fill aware) ===

/// Borrow order: total amount, filled_amount updated on each partial fill. remaining = amount - filled_amount.
/// vault_id is the UserVault that will receive the debt on fill.
public struct BorrowOrder has key, store {
    id: UID,
    borrower: address,
    vault_id: ID,
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

public fun borrow_order_vault_id(order: &BorrowOrder): ID {
    order.vault_id
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

// === Package-only mutators and position creation ===

public(package) fun borrow_order_add_filled(order: &mut BorrowOrder, fill_amount: u64) {
    order.filled_amount = order.filled_amount + fill_amount;
}

public(package) fun lend_order_add_filled(order: &mut LendOrder, fill_amount: u64) {
    order.filled_amount = order.filled_amount + fill_amount;
}

/// Create a LoanPosition (used on each fill). Caller transfers it to the lender.
public(package) fun create_loan_position(
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

// === Shared order book ===

/// Shared order book: holds borrow and lend orders. Does not hold funds.
public struct LendingMarketplace has key, store {
    id: UID,
    borrow_orders: Table<ID, BorrowOrder>,
    lend_orders: Table<ID, LendOrder>,
}

fun init(ctx: &mut TxContext) {
    let marketplace = LendingMarketplace {
        id: sui::object::new(ctx),
        borrow_orders: table::new(ctx),
        lend_orders: table::new(ctx),
    };
    sui::transfer::share_object(marketplace);
}

// === Package-only table accessors (used by escrow) ===

/// Read-only access to borrow orders table.
public(package) fun borrow_orders(mp: &LendingMarketplace): &Table<ID, BorrowOrder> {
    &mp.borrow_orders
}

/// Read-only access to lend orders table.
public(package) fun lend_orders(mp: &LendingMarketplace): &Table<ID, LendOrder> {
    &mp.lend_orders
}

// === Public order creation (user-facing) ===

/// Create a borrow order for the given vault. Then call submit_borrow_order to list it.
public fun create_borrow_order(
    vault_id: ID,
    amount: u64,
    max_interest_bps: u64,
    duration_secs: u64,
    ctx: &mut TxContext,
): BorrowOrder {
    let sender = sender(ctx);
    BorrowOrder {
        id: sui::object::new(ctx),
        borrower: sender,
        vault_id,
        amount,
        filled_amount: 0,
        max_interest_bps,
        duration_secs,
    }
}

/// Create a lend order. Then call submit_lend_order to list it.
public fun create_lend_order(
    amount: u64,
    min_interest_bps: u64,
    duration_secs: u64,
    ctx: &mut TxContext,
): LendOrder {
    LendOrder {
        id: sui::object::new(ctx),
        lender: sender(ctx),
        amount,
        filled_amount: 0,
        min_interest_bps,
        duration_secs,
    }
}

// === Submit orders (store in shared order book) ===

/// Store a borrow order in the marketplace. Caller must be the borrower and own the vault.
public fun submit_borrow_order(
    marketplace: &mut LendingMarketplace,
    vault: &UserVault,
    order: BorrowOrder,
    _ctx: &TxContext,
) {
    assert!(user_vault::owner(vault) == order.borrower, ENotBorrower);
    assert!(sui::object::id(vault) == order.vault_id, EVaultMismatch);
    let order_id = sui::object::id(&order);
    table::add(&mut marketplace.borrow_orders, order_id, order);
}

/// Store a lend order in the marketplace. Caller must be the lender.
public fun submit_lend_order(
    marketplace: &mut LendingMarketplace,
    order: LendOrder,
    ctx: &TxContext,
) {
    assert!(sender(ctx) == order.lender, ENotLender);
    let order_id = sui::object::id(&order);
    table::add(&mut marketplace.lend_orders, order_id, order);
}

// === Fill (match and settle): principal lender→borrower, create LoanPosition, update vault debt ===

/// Core fill logic. Takes an owned Coin<T> of exactly fill_amount.
/// Called by fill_order (public) and escrow::borrower_complete_fill (package).
public(package) fun execute_fill<T>(
    marketplace: &mut LendingMarketplace,
    borrow_order_id: ID,
    lend_order_id: ID,
    fill_amount: u64,
    principal_coin: Coin<T>,
    borrower_vault: &mut UserVault,
    collateral_price_feed_id: vector<u8>,
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    max_age_secs: u64,
    ctx: &mut TxContext,
) {
    assert!(value(&principal_coin) == fill_amount, EInsufficientCoin);
    assert!(table::contains(&marketplace.borrow_orders, borrow_order_id), EOrderNotFound);
    assert!(table::contains(&marketplace.lend_orders, lend_order_id), EOrderNotFound);

    let borrow_fully_filled;
    let lend_fully_filled;
    {
        let borrow_order = table::borrow_mut(&mut marketplace.borrow_orders, borrow_order_id);
        let lend_order = table::borrow_mut(&mut marketplace.lend_orders, lend_order_id);

        let borrow_remaining = borrow_order.amount - borrow_order.filled_amount;
        let lend_remaining = lend_order.amount - lend_order.filled_amount;
        assert!(fill_amount <= borrow_remaining && fill_amount <= lend_remaining, EFillAmount);
        assert!(borrow_order.max_interest_bps >= lend_order.min_interest_bps, ERateMismatch);
        assert!(borrow_order.duration_secs == lend_order.duration_secs, EDurationMismatch);
        assert!(borrow_order.vault_id == sui::object::id(borrower_vault), EVaultMismatch);

        let (price, expo) = oracle_adapter::get_price(
            collateral_price_feed_id,
            price_info_object,
            clock,
            max_age_secs,
        );
        assert!(risk_engine::can_add_debt(borrower_vault, fill_amount, &price, &expo), EBorrowLimitExceeded);

        let borrower = user_vault::owner(borrower_vault);
        sui::transfer::public_transfer(principal_coin, borrower);

        let rate_bps = lend_order.min_interest_bps;
        let term_secs = lend_order.duration_secs;
        let position = create_loan_position(
            borrow_order.borrower,
            lend_order.lender,
            fill_amount,
            rate_bps,
            term_secs,
            borrow_order.vault_id,
            ctx,
        );
        sui::transfer::transfer(position, lend_order.lender);

        borrow_order_add_filled(borrow_order, fill_amount);
        lend_order_add_filled(lend_order, fill_amount);
        borrow_fully_filled = borrow_order.filled_amount == borrow_order.amount;
        lend_fully_filled = lend_order.filled_amount == lend_order.amount;
        user_vault::add_debt(borrower_vault, fill_amount);
    };

    if (borrow_fully_filled) {
        let removed_borrow = table::remove(&mut marketplace.borrow_orders, borrow_order_id);
        let BorrowOrder { id, .. } = removed_borrow;
        sui::object::delete(id);
    };
    if (lend_fully_filled) {
        let removed_lend = table::remove(&mut marketplace.lend_orders, lend_order_id);
        let LendOrder { id, .. } = removed_lend;
        sui::object::delete(id);
    };
}

/// Public fill: splits fill_amount from lender_coin, delegates to execute_fill.
/// Preserves original signature for backward compatibility.
public fun fill_order<T>(
    marketplace: &mut LendingMarketplace,
    borrow_order_id: ID,
    lend_order_id: ID,
    fill_amount: u64,
    lender_coin: &mut Coin<T>,
    borrower_vault: &mut UserVault,
    collateral_price_feed_id: vector<u8>,
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    max_age_secs: u64,
    ctx: &mut TxContext,
) {
    let principal = split(lender_coin, fill_amount, ctx);
    execute_fill(
        marketplace,
        borrow_order_id,
        lend_order_id,
        fill_amount,
        principal,
        borrower_vault,
        collateral_price_feed_id,
        price_info_object,
        clock,
        max_age_secs,
        ctx,
    );
}

#[test_only]
/// Create a LendingMarketplace for integration tests (not shared; test holds it).
public fun create_marketplace_for_testing(ctx: &mut TxContext): LendingMarketplace {
    LendingMarketplace {
        id: sui::object::new(ctx),
        borrow_orders: table::new(ctx),
        lend_orders: table::new(ctx),
    }
}

#[test_only]
/// Same as fill_order but uses explicit price/expo (no oracle). Returns the created LoanPosition for E2E (repay step).
public fun fill_order_for_testing<T>(
    marketplace: &mut LendingMarketplace,
    borrow_order_id: ID,
    lend_order_id: ID,
    fill_amount: u64,
    lender_coin: &mut Coin<T>,
    borrower_vault: &mut UserVault,
    price: &pyth::i64::I64,
    expo: &pyth::i64::I64,
    ctx: &mut TxContext,
): LoanPosition {
    assert!(table::contains(&marketplace.borrow_orders, borrow_order_id), EOrderNotFound);
    assert!(table::contains(&marketplace.lend_orders, lend_order_id), EOrderNotFound);

    let position;
    let borrow_fully_filled;
    let lend_fully_filled;
    {
        let borrow_order = table::borrow_mut(&mut marketplace.borrow_orders, borrow_order_id);
        let lend_order = table::borrow_mut(&mut marketplace.lend_orders, lend_order_id);

        let borrow_remaining = borrow_order.amount - borrow_order.filled_amount;
        let lend_remaining = lend_order.amount - lend_order.filled_amount;
        assert!(fill_amount <= borrow_remaining && fill_amount <= lend_remaining, EFillAmount);
        assert!(borrow_order.max_interest_bps >= lend_order.min_interest_bps, ERateMismatch);
        assert!(borrow_order.duration_secs == lend_order.duration_secs, EDurationMismatch);
        assert!(borrow_order.vault_id == sui::object::id(borrower_vault), EVaultMismatch);
        assert!(risk_engine::can_add_debt(borrower_vault, fill_amount, price, expo), EBorrowLimitExceeded);

        let principal_coin = split(lender_coin, fill_amount, ctx);
        let borrower = user_vault::owner(borrower_vault);
        sui::transfer::public_transfer(principal_coin, borrower);

        let rate_bps = lend_order.min_interest_bps;
        let term_secs = lend_order.duration_secs;
        position = create_loan_position(
            borrow_order.borrower,
            lend_order.lender,
            fill_amount,
            rate_bps,
            term_secs,
            borrow_order.vault_id,
            ctx,
        );

        borrow_order_add_filled(borrow_order, fill_amount);
        lend_order_add_filled(lend_order, fill_amount);
        borrow_fully_filled = borrow_order.filled_amount == borrow_order.amount;
        lend_fully_filled = lend_order.filled_amount == lend_order.amount;
        user_vault::add_debt(borrower_vault, fill_amount);
    };

    if (borrow_fully_filled) {
        let removed_borrow = table::remove(&mut marketplace.borrow_orders, borrow_order_id);
        let BorrowOrder { id, .. } = removed_borrow;
        sui::object::delete(id);
    };
    if (lend_fully_filled) {
        let removed_lend = table::remove(&mut marketplace.lend_orders, lend_order_id);
        let LendOrder { id, .. } = removed_lend;
        sui::object::delete(id);
    };
    position
}

#[test_only]
/// Same as execute_fill but uses explicit price/expo (no oracle). Returns the LoanPosition.
public fun execute_fill_for_testing<T>(
    marketplace: &mut LendingMarketplace,
    borrow_order_id: ID,
    lend_order_id: ID,
    fill_amount: u64,
    principal_coin: Coin<T>,
    borrower_vault: &mut UserVault,
    price: &pyth::i64::I64,
    expo: &pyth::i64::I64,
    ctx: &mut TxContext,
): LoanPosition {
    assert!(value(&principal_coin) == fill_amount, EInsufficientCoin);
    assert!(table::contains(&marketplace.borrow_orders, borrow_order_id), EOrderNotFound);
    assert!(table::contains(&marketplace.lend_orders, lend_order_id), EOrderNotFound);

    let position;
    let borrow_fully_filled;
    let lend_fully_filled;
    {
        let borrow_order = table::borrow_mut(&mut marketplace.borrow_orders, borrow_order_id);
        let lend_order = table::borrow_mut(&mut marketplace.lend_orders, lend_order_id);

        let borrow_remaining = borrow_order.amount - borrow_order.filled_amount;
        let lend_remaining = lend_order.amount - lend_order.filled_amount;
        assert!(fill_amount <= borrow_remaining && fill_amount <= lend_remaining, EFillAmount);
        assert!(borrow_order.max_interest_bps >= lend_order.min_interest_bps, ERateMismatch);
        assert!(borrow_order.duration_secs == lend_order.duration_secs, EDurationMismatch);
        assert!(borrow_order.vault_id == sui::object::id(borrower_vault), EVaultMismatch);
        assert!(risk_engine::can_add_debt(borrower_vault, fill_amount, price, expo), EBorrowLimitExceeded);

        let borrower = user_vault::owner(borrower_vault);
        sui::transfer::public_transfer(principal_coin, borrower);

        let rate_bps = lend_order.min_interest_bps;
        let term_secs = lend_order.duration_secs;
        position = create_loan_position(
            borrow_order.borrower,
            lend_order.lender,
            fill_amount,
            rate_bps,
            term_secs,
            borrow_order.vault_id,
            ctx,
        );

        borrow_order_add_filled(borrow_order, fill_amount);
        lend_order_add_filled(lend_order, fill_amount);
        borrow_fully_filled = borrow_order.filled_amount == borrow_order.amount;
        lend_fully_filled = lend_order.filled_amount == lend_order.amount;
        user_vault::add_debt(borrower_vault, fill_amount);
    };

    if (borrow_fully_filled) {
        let removed_borrow = table::remove(&mut marketplace.borrow_orders, borrow_order_id);
        let BorrowOrder { id, .. } = removed_borrow;
        sui::object::delete(id);
    };
    if (lend_fully_filled) {
        let removed_lend = table::remove(&mut marketplace.lend_orders, lend_order_id);
        let LendOrder { id, .. } = removed_lend;
        sui::object::delete(id);
    };
    position
}

// === Repayment: clear position and update vault debt ===

/// Repay one position: borrower (vault owner) provides vault and coin; position is consumed (lender must have sent it to borrower).
/// Principal is sent to position.lender; vault debt is reduced; position is destroyed.
/// Marketplace does not hold funds.
public fun repay_position<T>(
    vault: &mut UserVault,
    position: LoanPosition,
    coin: &mut Coin<T>,
    ctx: &mut TxContext,
) {
    assert!(sender(ctx) == user_vault::owner(vault), ENotBorrower);
    assert!(position.vault_id == sui::object::id(vault), EVaultMismatch);
    assert!(position.borrower == user_vault::owner(vault), ENotBorrower);
    assert!(value(coin) >= position.principal, EInsufficientCoin);

    user_vault::repay_debt(vault, position.principal);
    let principal_coin = split(coin, position.principal, ctx);
    sui::transfer::public_transfer(principal_coin, position.lender);
    let LoanPosition { id, .. } = position;
    sui::object::delete(id);
}

#[test_only]
public fun create_borrow_order_for_testing(
    borrower: address,
    vault_id: ID,
    amount: u64,
    max_interest_bps: u64,
    duration_secs: u64,
    ctx: &mut TxContext,
): BorrowOrder {
    BorrowOrder {
        id: sui::object::new(ctx),
        borrower,
        vault_id,
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
