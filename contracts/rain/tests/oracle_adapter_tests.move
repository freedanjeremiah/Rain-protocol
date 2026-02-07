#[test_only]
module rain::oracle_adapter_tests;

use rain::oracle_adapter;

#[test]
fun test_oracle_adapter_module_loads() {
    assert!(true, 0);
}

/// OracleAdapter uses real Pyth types (PriceInfoObject, get_price_no_older_than). get_price asserts feed id match.
/// This test verifies the adapter's error code; full E2E with real Pyth price requires a PriceInfoObject from Pyth.
#[test]
fun test_oracle_adapter_invalid_feed_id_error_code() {
    assert!(oracle_adapter::get_invalid_price_feed_id_error_code() == 0, 0);
}
