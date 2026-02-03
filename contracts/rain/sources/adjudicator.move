/// Adjudicator: authorizes releases from Custody. Does not hold assets.
/// Only this module creates RepaymentAuth and LiquidationAuth; Custody accepts only these.
module rain::adjudicator;

use sui::clock::Clock;
use sui::tx_context::sender;
use pyth::i64;
use pyth::price_info::PriceInfoObject;
use rain::oracle_adapter;

// === Errors ===
const EInvalidProof: u64 = 1;
const ENotLiquidatable: u64 = 2;
/// Proof that vault debt is cleared. Only a package module (e.g. UserVault) may create this.
/// Consumed by authorize_repayment.
public struct RepaymentProof has drop, store {
    vault_id: ID,
}

/// Authorization for Custody to release collateral to owner (after repayment).
/// One-time use: Custody consumes this when releasing.
public struct RepaymentAuth has key, store {
    id: UID,
    vault_id: ID,
}

/// Authorization for Custody to release collateral to liquidator.
/// One-time use: Custody consumes this when releasing.
public struct LiquidationAuth has key, store {
    id: UID,
    vault_id: ID,
}

/// Vault state snapshot for liquidation check. Collateral and debt in same unit scale.
public struct VaultState has copy, drop, store {
    collateral_amount: u64,
    debt: u64,
    /// Liquidation threshold in basis points (e.g. 8000 = 80%). Liquidatable when LTV >= this.
    liquidation_threshold_bps: u64,
}

/// Create RepaymentProof. Only callable by package modules (e.g. UserVault when debt is cleared).
public(package) fun create_repayment_proof(vault_id: ID): RepaymentProof {
    RepaymentProof { vault_id }
}

/// On valid repayment proof, create and transfer RepaymentAuth to sender.
/// Caller (e.g. LendingMarketplace/UserVault flow) must supply a proof from the module that attests debt cleared.
public fun authorize_repayment(
    vault_id: ID,
    proof: RepaymentProof,
    ctx: &mut TxContext,
) {
    assert!(proof.vault_id == vault_id, EInvalidProof);
    let RepaymentProof { vault_id: _ } = proof;
    let auth = RepaymentAuth {
        id: sui::object::new(ctx),
        vault_id,
    };
    sui::transfer::transfer(auth, sender(ctx));
}

/// Verify LTV >= liquidation threshold using oracle price and vault state; if valid, create LiquidationAuth.
/// Uses OracleAdapter for price; computes collateral_value from price/expo and checks debt/collateral_value >= threshold.
public fun authorize_liquidation(
    vault_id: ID,
    collateral_price_feed_id: vector<u8>,
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    vault_state: VaultState,
    max_age_secs: u64,
    ctx: &mut TxContext,
) {
    let (price, expo) = oracle_adapter::get_price(
        collateral_price_feed_id,
        price_info_object,
        clock,
        max_age_secs,
    );
    let collateral_value = collateral_value_from_oracle(
        vault_state.collateral_amount,
        &price,
        &expo,
    );
    assert!(collateral_value > 0, ENotLiquidatable);
    let ltv_bps = ((vault_state.debt as u128) * 10000) / (collateral_value as u128);
    assert!(ltv_bps >= (vault_state.liquidation_threshold_bps as u128), ENotLiquidatable);
    let auth = LiquidationAuth {
        id: sui::object::new(ctx),
        vault_id,
    };
    sui::transfer::transfer(auth, sender(ctx));
}

/// Compute collateral value in same scale as debt using oracle (price, expo). Uses u128 internally.
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

/// Custody (or other modules) can read vault_id from auth to verify and consume.
public fun repayment_auth_vault_id(auth: &RepaymentAuth): ID {
    auth.vault_id
}

/// Custody (or other modules) can read vault_id from auth to verify and consume.
public fun liquidation_auth_vault_id(auth: &LiquidationAuth): ID {
    auth.vault_id
}

#[test_only]
public fun create_repayment_proof_for_testing(vault_id: ID): RepaymentProof {
    create_repayment_proof(vault_id)
}
