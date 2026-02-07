#[test_only]
module rain::custody_tests;

use rain::adjudicator;
use rain::custody;

#[test]
fun test_custody_module_loads() {
    assert!(true, 0);
}

#[test]
fun test_create_vault_balance_zero_owner_set() {
    let ctx = &mut sui::tx_context::dummy();
    let vault = custody::create_vault_for_testing(ctx);
    assert!(custody::balance_value(&vault) == 0, 0);
    assert!(custody::owner(&vault) == sui::tx_context::sender(ctx), 0);
    sui::transfer::public_transfer(vault, sui::tx_context::sender(ctx));
}

/// Custody rejects release_to_owner when RepaymentAuth is for a different vault (invalid auth for this vault).
#[test, expected_failure(abort_code = rain::custody::EInvalidVault)]
fun test_release_to_owner_rejects_auth_for_wrong_vault() {
    let ctx = &mut sui::tx_context::dummy();
    let vault_a = custody::create_vault_for_testing(ctx);
    let mut vault_b = custody::create_vault_for_testing(ctx);
    let proof = adjudicator::create_repayment_proof_for_testing(sui::object::id(&vault_a));
    let auth = adjudicator::authorize_repayment_returning(sui::object::id(&vault_a), proof, ctx);
    sui::transfer::public_transfer(vault_a, sui::tx_context::sender(ctx));
    custody::release_to_owner(&mut vault_b, auth, ctx);
    sui::transfer::public_transfer(vault_b, sui::tx_context::sender(ctx));
}
