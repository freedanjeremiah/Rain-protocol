#[test_only]
module rain::adjudicator_tests;

use rain::adjudicator;

#[test]
fun test_adjudicator_module_loads() {
    assert!(true, 0);
}

#[test]
fun test_authorize_repayment_consumes_proof() {
    let ctx = &mut sui::tx_context::dummy();
    let vault_id = sui::object::id_from_address(@0x1);
    let proof = adjudicator::create_repayment_proof_for_testing(vault_id);
    adjudicator::authorize_repayment(vault_id, proof, ctx);
}
