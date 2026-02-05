#[test_only]
module rain::user_vault_tests;

use rain::user_vault;

#[test]
fun test_user_vault_module_loads() {
    assert!(true, 0);
}

#[test]
fun test_create_vault_succeeds() {
    let ctx = &mut sui::tx_context::dummy();
    user_vault::create_vault(8000, ctx);
}

#[test]
fun test_add_debt_and_repay_debt() {
    let ctx = &mut sui::tx_context::dummy();
    let custody_id = sui::object::id_from_address(@0x1);
    let mut vault = user_vault::create_vault_for_testing(custody_id, 8000, ctx);
    assert!(user_vault::debt(&vault) == 0, 0);
    user_vault::add_debt(&mut vault, 100);
    assert!(user_vault::debt(&vault) == 100, 0);
    user_vault::repay_debt(&mut vault, 40);
    assert!(user_vault::debt(&vault) == 60, 0);
    sui::transfer::public_transfer(vault, sui::tx_context::sender(ctx));
}
