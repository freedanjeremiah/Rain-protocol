#[test_only]
module rain::adjudicator_tests;

use rain::adjudicator;

#[test]
fun test_adjudicator_module_loads() {
    assert!(true, 0);
}

/// Authorize repayment only when proof.vault_id matches vault_id; consumes proof and transfers RepaymentAuth to sender.
#[test]
fun test_authorize_repayment_consumes_proof() {
    let ctx = &mut sui::tx_context::dummy();
    let vault_id = sui::object::id_from_address(@0x1);
    let proof = adjudicator::create_repayment_proof_for_testing(vault_id);
    adjudicator::authorize_repayment(vault_id, proof, ctx);
}

/// Authorize repayment must fail when proof is for a different vault (conditions do not hold).
#[test, expected_failure(abort_code = rain::adjudicator::EInvalidProof)]
fun test_authorize_repayment_fails_wrong_vault_id() {
    let ctx = &mut sui::tx_context::dummy();
    let vault_id_a = sui::object::id_from_address(@0x1);
    let vault_id_b = sui::object::id_from_address(@0x2);
    let proof = adjudicator::create_repayment_proof_for_testing(vault_id_a);
    adjudicator::authorize_repayment(vault_id_b, proof, ctx);
}
