#[test_only]
module rain::custody_tests;

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
