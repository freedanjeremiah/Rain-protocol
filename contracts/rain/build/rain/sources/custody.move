/// Custody: holds user collateral (Balance<SUI>). Releases only on Adjudicator auth or rule-based proof.
/// No LTV or liquidation logic. Per-vault owned object.
module rain::custody;

use sui::balance::{Balance, join, split};
use sui::coin::{Coin, from_balance, into_balance};
use sui::sui::SUI;
use sui::tx_context::sender;
use rain::adjudicator;
use rain::adjudicator::{RepaymentAuth, LiquidationAuth, RepaymentProof};

// === Errors ===
const ENotOwner: u64 = 1;
const EInvalidVault: u64 = 2;
const ENoBalance: u64 = 3;

/// Owned object per vault: holds collateral (Balance<SUI>). vault_id = object::id(&self).
public struct CustodyVault has key, store {
    id: UID,
    owner: address,
    balance: Balance<SUI>,
}

/// Create a new custody vault; transferred to caller (owner). vault_id = object::id of returned vault.
public fun create_vault(ctx: &mut TxContext) {
    let vault = create_vault_returning(ctx);
    sui::transfer::transfer(vault, sender(ctx));
}

/// Create a custody vault and return it (for UserVault to link). Caller must transfer to owner.
public(package) fun create_vault_returning(ctx: &mut TxContext): CustodyVault {
    CustodyVault {
        id: sui::object::new(ctx),
        owner: sender(ctx),
        balance: sui::balance::zero<SUI>(),
    }
}

/// Owner deposits SUI into this vault. Credits the vault's balance.
public fun deposit(vault: &mut CustodyVault, coin: Coin<SUI>, _ctx: &TxContext) {
    assert!(sender(_ctx) == vault.owner, ENotOwner);
    let b = into_balance(coin);
    join(&mut vault.balance, b);
}

/// Release full collateral to owner. Valid only with valid RepaymentAuth for this vault; consumes auth.
public fun release_to_owner(
    vault: &mut CustodyVault,
    repayment_auth: RepaymentAuth,
    ctx: &mut TxContext,
) {
    assert!(adjudicator::repayment_auth_vault_id(&repayment_auth) == sui::object::id(vault), EInvalidVault);
    let amount = sui::balance::value(&vault.balance);
    assert!(amount > 0, ENoBalance);
    let balance = split(&mut vault.balance, amount);
    let coin = from_balance(balance, ctx);
    sui::transfer::public_transfer(coin, vault.owner);
    adjudicator::consume_repayment_auth(repayment_auth);
}

/// Release full collateral to liquidator. Valid only with valid LiquidationAuth for this vault; consumes auth.
public fun release_to_liquidator(
    vault: &mut CustodyVault,
    liquidation_auth: LiquidationAuth,
    liquidator: address,
    ctx: &mut TxContext,
) {
    assert!(adjudicator::liquidation_auth_vault_id(&liquidation_auth) == sui::object::id(vault), EInvalidVault);
    let amount = sui::balance::value(&vault.balance);
    assert!(amount > 0, ENoBalance);
    let balance = split(&mut vault.balance, amount);
    let coin = from_balance(balance, ctx);
    sui::transfer::public_transfer(coin, liquidator);
    adjudicator::consume_liquidation_auth(liquidation_auth);
}

/// Rule-based withdraw when debt = 0: owner presents RepaymentProof (from UserVault); no Adjudicator needed.
public fun withdraw_healthy(
    vault: &mut CustodyVault,
    proof: RepaymentProof,
    ctx: &mut TxContext,
) {
    assert!(sender(ctx) == vault.owner, ENotOwner);
    assert!(adjudicator::repayment_proof_vault_id(&proof) == sui::object::id(vault), EInvalidVault);
    let amount = sui::balance::value(&vault.balance);
    assert!(amount > 0, ENoBalance);
    let balance = split(&mut vault.balance, amount);
    let coin = from_balance(balance, ctx);
    sui::transfer::public_transfer(coin, vault.owner);
    adjudicator::consume_repayment_proof(proof);
}

/// Read vault balance (for UserVault / RiskEngine).
public fun balance_value(vault: &CustodyVault): u64 {
    sui::balance::value(&vault.balance)
}

/// Read vault owner.
public fun owner(vault: &CustodyVault): address {
    vault.owner
}

#[test_only]
/// Create a vault and return it (for testing). Caller must transfer or dispose of the vault.
public fun create_vault_for_testing(ctx: &mut TxContext): CustodyVault {
    CustodyVault {
        id: sui::object::new(ctx),
        owner: sender(ctx),
        balance: sui::balance::zero<SUI>(),
    }
}
