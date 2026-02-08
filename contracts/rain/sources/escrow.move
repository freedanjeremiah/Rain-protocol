/// Escrow-based fill flow: lender locks funds, borrower completes fill later.
/// FillRequest is a shared object with Balance<SUI>. Status: 0=PENDING, 1=COMPLETED, 2=CANCELLED.
module rain::escrow;

use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use sui::table;
use sui::tx_context::sender;
use pyth::price_info::PriceInfoObject;
use rain::marketplace::{Self, LendingMarketplace};
use rain::user_vault::UserVault;

// === Errors (100+ to avoid collision with marketplace) ===
const ENotLender: u64 = 100;
const ENotBorrower: u64 = 101;
const ENotPending: u64 = 102;
const ENotExpired: u64 = 103;
const EAlreadyExpired: u64 = 104;
const EVaultMismatch: u64 = 105;
const EOrderNotFound: u64 = 106;
const EFillAmountExceeds: u64 = 107;
const ERateMismatch: u64 = 108;
const EInsufficientCoin: u64 = 109;

// === Status constants ===
const STATUS_PENDING: u8 = 0;
const STATUS_COMPLETED: u8 = 1;
const STATUS_CANCELLED: u8 = 2;

// === FillRequest ===

public struct FillRequest has key, store {
    id: UID,
    borrow_order_id: ID,
    lend_order_id: ID,
    fill_amount: u64,
    lender: address,
    borrower: address,
    vault_id: ID,
    expiry_ms: u64,
    locked_balance: Balance<SUI>,
    status: u8,
}

// === Events ===

public struct FillRequestCreated has copy, drop {
    fill_request_id: ID,
    borrow_order_id: ID,
    lend_order_id: ID,
    fill_amount: u64,
    lender: address,
    borrower: address,
    vault_id: ID,
    expiry_ms: u64,
}

public struct FillRequestCompleted has copy, drop {
    fill_request_id: ID,
    borrow_order_id: ID,
    lend_order_id: ID,
    fill_amount: u64,
}

public struct FillRequestCancelled has copy, drop {
    fill_request_id: ID,
    lender: address,
    amount_returned: u64,
}

// === Getters ===

public fun fill_request_id(req: &FillRequest): ID {
    sui::object::id(req)
}

public fun borrow_order_id(req: &FillRequest): ID {
    req.borrow_order_id
}

public fun lend_order_id(req: &FillRequest): ID {
    req.lend_order_id
}

public fun fill_amount(req: &FillRequest): u64 {
    req.fill_amount
}

public fun lender(req: &FillRequest): address {
    req.lender
}

public fun borrower(req: &FillRequest): address {
    req.borrower
}

public fun vault_id(req: &FillRequest): ID {
    req.vault_id
}

public fun expiry_ms(req: &FillRequest): u64 {
    req.expiry_ms
}

public fun status(req: &FillRequest): u8 {
    req.status
}

public fun locked_amount(req: &FillRequest): u64 {
    balance::value(&req.locked_balance)
}

// === Entry points ===

/// Lender commits funds to fill a borrow order. Creates a shared FillRequest.
/// Validates that both orders exist, are compatible, and have enough remaining capacity.
public fun lender_commit_fill(
    marketplace: &LendingMarketplace,
    borrow_order_id: ID,
    lend_order_id: ID,
    fill_amount: u64,
    lender_coin: &mut Coin<SUI>,
    expiry_secs: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let borrow_orders = marketplace::borrow_orders(marketplace);
    let lend_orders = marketplace::lend_orders(marketplace);

    assert!(table::contains(borrow_orders, borrow_order_id), EOrderNotFound);
    assert!(table::contains(lend_orders, lend_order_id), EOrderNotFound);

    let borrow_order = table::borrow(borrow_orders, borrow_order_id);
    let lend_order = table::borrow(lend_orders, lend_order_id);

    // Validate caller is the lender
    assert!(sender(ctx) == marketplace::lend_order_lender(lend_order), ENotLender);

    // Validate compatibility
    assert!(
        marketplace::borrow_order_max_interest_bps(borrow_order)
            >= marketplace::lend_order_min_interest_bps(lend_order),
        ERateMismatch,
    );

    // Validate remaining capacity
    let borrow_remaining = marketplace::borrow_order_remaining(borrow_order);
    let lend_remaining = marketplace::lend_order_remaining(lend_order);
    assert!(fill_amount <= borrow_remaining && fill_amount <= lend_remaining, EFillAmountExceeds);

    // Validate sufficient coin
    assert!(coin::value(lender_coin) >= fill_amount, EInsufficientCoin);

    // Split and lock funds
    let locked_coin = coin::split(lender_coin, fill_amount, ctx);
    let locked_balance = coin::into_balance(locked_coin);

    let borrower = marketplace::borrow_order_borrower(borrow_order);
    let vault_id_val = marketplace::borrow_order_vault_id(borrow_order);
    let expiry_ms = sui::clock::timestamp_ms(clock) + (expiry_secs * 1000);

    let fill_request = FillRequest {
        id: sui::object::new(ctx),
        borrow_order_id,
        lend_order_id,
        fill_amount,
        lender: sender(ctx),
        borrower,
        vault_id: vault_id_val,
        expiry_ms,
        locked_balance,
        status: STATUS_PENDING,
    };

    let fill_request_id = sui::object::id(&fill_request);

    event::emit(FillRequestCreated {
        fill_request_id,
        borrow_order_id,
        lend_order_id,
        fill_amount,
        lender: sender(ctx),
        borrower,
        vault_id: vault_id_val,
        expiry_ms,
    });

    sui::transfer::share_object(fill_request);
}

/// Borrower completes the fill: drains escrow, calls marketplace::execute_fill,
/// which transfers principal to borrower, creates LoanPosition for lender, updates debt.
public fun borrower_complete_fill(
    marketplace: &mut LendingMarketplace,
    fill_request: &mut FillRequest,
    borrower_vault: &mut UserVault,
    collateral_price_feed_id: vector<u8>,
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    max_age_secs: u64,
    ctx: &mut TxContext,
) {
    assert!(fill_request.status == STATUS_PENDING, ENotPending);
    assert!(sui::clock::timestamp_ms(clock) < fill_request.expiry_ms, EAlreadyExpired);
    assert!(sender(ctx) == fill_request.borrower, ENotBorrower);
    assert!(sui::object::id(borrower_vault) == fill_request.vault_id, EVaultMismatch);

    // Drain balance into a coin
    let amount = balance::value(&fill_request.locked_balance);
    let principal_coin = coin::from_balance(
        balance::split(&mut fill_request.locked_balance, amount),
        ctx,
    );

    // Delegate to marketplace::execute_fill
    marketplace::execute_fill(
        marketplace,
        fill_request.borrow_order_id,
        fill_request.lend_order_id,
        fill_request.fill_amount,
        principal_coin,
        borrower_vault,
        collateral_price_feed_id,
        price_info_object,
        clock,
        max_age_secs,
        ctx,
    );

    fill_request.status = STATUS_COMPLETED;

    event::emit(FillRequestCompleted {
        fill_request_id: sui::object::id(fill_request),
        borrow_order_id: fill_request.borrow_order_id,
        lend_order_id: fill_request.lend_order_id,
        fill_amount: fill_request.fill_amount,
    });
}

/// Lender cancels an expired fill request and reclaims locked funds.
public fun lender_cancel_fill(
    fill_request: &mut FillRequest,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(fill_request.status == STATUS_PENDING, ENotPending);
    assert!(sender(ctx) == fill_request.lender, ENotLender);
    assert!(sui::clock::timestamp_ms(clock) >= fill_request.expiry_ms, ENotExpired);

    let amount = balance::value(&fill_request.locked_balance);
    let coin = coin::from_balance(
        balance::split(&mut fill_request.locked_balance, amount),
        ctx,
    );
    sui::transfer::public_transfer(coin, fill_request.lender);

    fill_request.status = STATUS_CANCELLED;

    event::emit(FillRequestCancelled {
        fill_request_id: sui::object::id(fill_request),
        lender: fill_request.lender,
        amount_returned: amount,
    });
}

// === Test helpers ===

#[test_only]
public fun create_fill_request_for_testing(
    borrow_order_id: ID,
    lend_order_id: ID,
    fill_amount: u64,
    lender_addr: address,
    borrower_addr: address,
    vault_id: ID,
    expiry_ms: u64,
    locked_coin: Coin<SUI>,
    ctx: &mut TxContext,
): FillRequest {
    FillRequest {
        id: sui::object::new(ctx),
        borrow_order_id,
        lend_order_id,
        fill_amount,
        lender: lender_addr,
        borrower: borrower_addr,
        vault_id,
        expiry_ms,
        locked_balance: coin::into_balance(locked_coin),
        status: STATUS_PENDING,
    }
}

#[test_only]
public fun destroy_fill_request_for_testing(req: FillRequest) {
    let FillRequest { id, locked_balance, .. } = req;
    sui::object::delete(id);
    balance::destroy_for_testing(locked_balance);
}
