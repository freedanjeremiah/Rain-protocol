/// UserVault: state and accounting per user. Does not hold collateral; Custody holds assets.
/// Records custody_id, collateral_balance (mirror), debt, liquidation_threshold. Debt updated by LendingMarketplace.
module rain::user_vault;

use sui::coin::{Coin, value};
use sui::sui::SUI;
use sui::tx_context::sender;
use rain::custody;
use rain::custody::CustodyVault;

// === Errors ===
const ENotOwner: u64 = 1;
const ECustodyMismatch: u64 = 2;
const ERepayExceedsDebt: u64 = 3;

/// Owned object: state for one user's position. custody_id links to CustodyVault holding collateral.
public struct UserVault has key, store {
    id: UID,
    owner: address,
    custody_id: ID,
    collateral_balance: u64,
    debt: u64,
    liquidation_threshold_bps: u64,
}

/// Create UserVault and linked CustodyVault; transfer both to caller (owner).
/// liquidation_threshold_bps: e.g. 8000 = 80%. Used by RiskEngine/Adjudicator for liquidation check.
public fun create_vault(liquidation_threshold_bps: u64, ctx: &mut TxContext) {
    let custody_vault = custody::create_vault_returning(ctx);
    let custody_id = sui::object::id(&custody_vault);
    let user_vault = UserVault {
        id: sui::object::new(ctx),
        owner: sender(ctx),
        custody_id,
        collateral_balance: 0,
        debt: 0,
        liquidation_threshold_bps,
    };
    sui::transfer::public_transfer(custody_vault, sender(ctx));
    sui::transfer::transfer(user_vault, sender(ctx));
}

/// Owner deposits SUI into linked Custody and updates vault collateral mirror.
public fun deposit_collateral(
    vault: &mut UserVault,
    custody_vault: &mut CustodyVault,
    coin: Coin<SUI>,
    ctx: &TxContext,
) {
    assert!(sender(ctx) == vault.owner, ENotOwner);
    assert!(sui::object::id(custody_vault) == vault.custody_id, ECustodyMismatch);
    let amount = value(&coin);
    custody::deposit(custody_vault, coin, ctx);
    vault.collateral_balance = vault.collateral_balance + amount;
}

/// Add debt (e.g. when a position is opened). Only package modules (e.g. LendingMarketplace) may call.
public(package) fun add_debt(vault: &mut UserVault, amount: u64) {
    vault.debt = vault.debt + amount;
}

/// Reduce debt (e.g. when repaid). Only package modules (e.g. LendingMarketplace) may call. Aborts if amount > debt.
public(package) fun repay_debt(vault: &mut UserVault, amount: u64) {
    assert!(vault.debt >= amount, ERepayExceedsDebt);
    vault.debt = vault.debt - amount;
}

/// Read custody ID (for Custody/Adjudicator flows).
public fun custody_id(vault: &UserVault): ID {
    vault.custody_id
}

/// Read collateral balance mirror (for RiskEngine / LTV).
public fun collateral_balance(vault: &UserVault): u64 {
    vault.collateral_balance
}

/// Read debt (for RiskEngine / LendingMarketplace).
public fun debt(vault: &UserVault): u64 {
    vault.debt
}

/// Read liquidation threshold in basis points.
public fun liquidation_threshold_bps(vault: &UserVault): u64 {
    vault.liquidation_threshold_bps
}

/// Read owner.
public fun owner(vault: &UserVault): address {
    vault.owner
}

/// Sync collateral_balance from Custody (call after external changes or to correct mirror).
public fun sync_collateral_from_custody(vault: &mut UserVault, custody_vault: &CustodyVault) {
    assert!(sui::object::id(custody_vault) == vault.custody_id, ECustodyMismatch);
    vault.collateral_balance = custody::balance_value(custody_vault);
}

#[test_only]
public fun create_vault_for_testing(
    custody_id: ID,
    liquidation_threshold_bps: u64,
    ctx: &mut TxContext,
): UserVault {
    UserVault {
        id: sui::object::new(ctx),
        owner: sender(ctx),
        custody_id,
        collateral_balance: 0,
        debt: 0,
        liquidation_threshold_bps,
    }
}

#[test_only]
public fun set_collateral_balance_for_testing(vault: &mut UserVault, amount: u64) {
    vault.collateral_balance = amount;
}
